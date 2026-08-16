"""Recruitment reporting operations."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends, Query, Response, HTTPException
from sqlalchemy.orm import Session

from ... import models
from ..database import get_db
from ...core.permissions import require_roles
from ..documents.excel_io import build_table

STAGES = ["APPLIED", "SCREENING", "SCREENING_PASSED", "FIRST_INTERVIEW", "SECOND_INTERVIEW", "OFFERS_SENT", "HIRED"]
HISTORY_STAGES = [s for s in STAGES if s != "OFFERS_SENT"]
DISPLAY_LABELS = {
    "APPLIED": "简历投递量",
    "SCREENING": "简历初筛",
    "SCREENING_PASSED": "初筛通过",
    "FIRST_INTERVIEW": "安排专业面试",
    "SECOND_INTERVIEW": "面试通过",
    "OFFERS_SENT": "发出 Offer",
    "HIRED": "最终入职",
}


def base_apps(db, start=None, end=None, job_id=None, source_id=None, owner_id=None):
    q = db.query(models.Application)
    if start: q = q.filter(models.Application.applied_at >= start)
    if end: q = q.filter(models.Application.applied_at < end)
    if job_id: q = q.filter(models.Application.job_id == job_id)
    if source_id: q = q.filter(models.Application.source_channel_id == source_id)
    if owner_id: q = q.filter(models.Application.owner_id == owner_id)
    return q.all()


def funnel(start: datetime | None = None, end: datetime | None = None, job_id: UUID | None = None, source_id: UUID | None = None, owner_id: UUID | None = None, _=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    apps = base_apps(db, start, end, job_id, source_id, owner_id); ids = [a.id for a in apps]
    histories = db.query(models.ApplicationStageHistory).filter(models.ApplicationStageHistory.application_id.in_(ids)).order_by(models.ApplicationStageHistory.created_at).all() if ids else []
    reached = defaultdict(set); durations = defaultdict(list); by_app = defaultdict(list)
    for h in histories:
        by_app[h.application_id].append(h)
        if h.to_stage in HISTORY_STAGES: reached[h.to_stage].add(h.application_id)

    # OFFERS_SENT: derived from Offer table (distinct app_id, non-DRAFT),
    # same definition as channels().offers_sent — keeps both views aligned.
    if ids:
        offer_app_ids = {r[0] for r in db.query(models.Offer.application_id)
                            .filter(models.Offer.application_id.in_(ids),
                                    models.Offer.status.in_(["SENT", "ACCEPTED", "DECLINED", "EXPIRED"]))
                            .distinct().all()}
    else:
        offer_app_ids = set()
    reached["OFFERS_SENT"] = offer_app_ids

    for rows in by_app.values():
        first = {}
        for h in rows:
            if h.to_stage in HISTORY_STAGES and h.to_stage not in first: first[h.to_stage] = h.created_at
        for i, stage in enumerate(HISTORY_STAGES[:-1]):
            if stage in first and HISTORY_STAGES[i + 1] in first: durations[stage].append((first[HISTORY_STAGES[i + 1]] - first[stage]).total_seconds() / 3600)

    # APPLIED 兜底: 若 seed 漏写 None→APPLIED 历史，强制 APPLIED = 总申请数，避免首行为 0
    if not reached.get("APPLIED"):
        reached["APPLIED"] = set(ids)

    total = len(apps)
    items = []
    for i, stage in enumerate(STAGES):
        count = len(reached[stage]); prev = len(reached[STAGES[i - 1]]) if i else count
        items.append({
            "stage": stage,
            "display_label": DISPLAY_LABELS[stage],
            "count": count,
            "percent_of_total": round(count / total, 4) if total else 0,
            "conversion_rate": round(count / prev, 4) if prev else 0,
            "average_hours": round(sum(durations[stage]) / len(durations[stage]), 2) if durations[stage] else 0,
        })
    return {"total": total, "rejected": sum(a.status == "REJECTED" for a in apps), "stages": items}


def channels(start: datetime | None = None, end: datetime | None = None, _=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    groups = defaultdict(list)
    for a in base_apps(db, start, end): groups[(a.source_code_snapshot or "UNKNOWN", a.source_name_snapshot or "未知")].append(a)
    out = []
    for (code, name), apps in groups.items():
        ids = [a.id for a in apps]; interviews = db.query(models.Interview).filter(models.Interview.application_id.in_(ids)).count() if ids else 0
        sent = db.query(models.Offer).filter(models.Offer.application_id.in_(ids), models.Offer.status.in_(["SENT", "ACCEPTED", "DECLINED", "EXPIRED"])).count() if ids else 0
        accepted = db.query(models.Offer).filter(models.Offer.application_id.in_(ids), models.Offer.status == "ACCEPTED").count() if ids else 0
        out.append({"code": code, "name": name, "applications": len(apps), "interviewed": interviews, "offers_sent": sent, "offers_accepted": accepted, "hire_rate": round(accepted / len(apps), 4) if apps else 0})
    return out


def job_cycles(_=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc); out = []
    for job in db.query(models.Job).filter(models.Job.published_at.is_not(None)).all():
        offer = (db.query(models.Offer).join(models.Application, models.Application.id == models.Offer.application_id)
                 .filter(models.Application.job_id == job.id, models.Offer.status == "ACCEPTED").order_by(models.Offer.responded_at).first())
        # 已接受的 Offer 也可能没有 responded_at（导入/补录数据），回退到更新时间再回退到 now，避免 None 崩溃
        completed_at = (offer.responded_at or offer.updated_at) if offer else None
        endpoint = completed_at or now; start = job.published_at
        if start.tzinfo is None: start = start.replace(tzinfo=timezone.utc)
        if endpoint.tzinfo is None: endpoint = endpoint.replace(tzinfo=timezone.utc)
        out.append({"job_id": job.id, "job_title": job.title, "published_at": job.published_at, "completed_at": completed_at, "days": round((endpoint - start).total_seconds() / 86400, 1), "status": "COMPLETED" if offer else "OPEN"})
    return out


def workload(start: datetime | None = None, end: datetime | None = None, _=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    hrs = db.query(models.AdminAccount).filter(models.AdminAccount.role.in_(["HR", "SUPER_ADMIN"]), models.AdminAccount.delete_at.is_(None)).all(); out = []
    for user in hrs:
        hq = db.query(models.ApplicationStageHistory).filter_by(changed_by=user.id)
        iq = db.query(models.Interview).filter_by(created_by=user.id)
        cq = db.query(models.CandidateCommunication).filter_by(sender_id=user.id)
        oq = db.query(models.Offer).filter_by(created_by=user.id)
        if start:
            hq, iq, cq, oq = hq.filter(models.ApplicationStageHistory.created_at >= start), iq.filter(models.Interview.created_at >= start), cq.filter(models.CandidateCommunication.created_at >= start), oq.filter(models.Offer.created_at >= start)
        if end:
            hq, iq, cq, oq = hq.filter(models.ApplicationStageHistory.created_at < end), iq.filter(models.Interview.created_at < end), cq.filter(models.CandidateCommunication.created_at < end), oq.filter(models.Offer.created_at < end)
        out.append({"user_id": user.id, "name": user.name, "owned_talents": db.query(models.Candidate).filter_by(owner_id=user.id).count(), "active_applications": db.query(models.Application).filter_by(owner_id=user.id, status="ACTIVE").count(), "stage_actions": hq.count(), "interviews": iq.count(), "messages": cq.count(), "offers": oq.count(), "hires": oq.filter(models.Offer.status == "ACCEPTED").count()})
    return out


def export_report(report_name: str, _=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    if report_name == "channels":
        data = channels(_=_, db=db); headers=["渠道","投递","面试","Offer发送","Offer接受","录用率"]; rows = [[x["name"], x["applications"], x["interviewed"], x["offers_sent"], x["offers_accepted"], x["hire_rate"]] for x in data]
    elif report_name == "job-cycles":
        data = job_cycles(_=_, db=db); headers=["岗位","发布时间","完成时间","周期天数","状态"]; rows = [[x["job_title"], x["published_at"], x["completed_at"] or "", x["days"], x["status"]] for x in data]
    elif report_name == "workload":
        data = workload(_=_, db=db); headers=["HR","负责人才","进行中申请","阶段操作","面试","通知","Offer","录用"]; rows = [[x["name"], x["owned_talents"], x["active_applications"], x["stage_actions"], x["interviews"], x["messages"], x["offers"], x["hires"]] for x in data]
    else:
        data = funnel(_=_, db=db); headers=["阶段","人数","转化率","平均停留小时"]; rows = [[x["display_label"], x["count"], x["conversion_rate"], x["average_hours"]] for x in data["stages"]]
    return Response(content=build_table("招聘报表", headers, rows), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="report-{report_name}.xlsx"'})

