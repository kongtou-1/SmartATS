"""Applications: candidate apply/my/detail/withdraw + admin list/detail/stage + agent."""
import uuid
from urllib.parse import quote
from fastapi import Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from ...agents.base import get_matcher
from ..database import get_db
from ...core.permissions import get_current_candidate, get_current_candidate_account, require_roles
from ..email import sender as email_sender
from ... import models
from ...models import AdminAccount, AgentResult, Application, ApplicationStageHistory, Candidate, CandidateAccount, Interview, InterviewFeedback, Job, Resume
from ..talent.candidates import validate_profile_for_application
from ...storage import storage
from ...workers.agent_tasks import analyze_application_task
from ...workers.email_tasks import send_email_task
from ...utils.presenters import (
    build_admin_application_detail,
    build_application_out,
    build_candidate_application_detail,
)
from ...schemas import (
    AdminApplicationDetailOut,
    AdminApplicationOut,
    AgentResultOut,
    ApplicationCreateIn,
    ApplicationOut,
    CandidateApplicationDetail,
    StageReasonIn,
    StageTransitionIn,
)


STAGE_ORDER = ["APPLIED", "SCREENING", "SCREENING_PASSED", "FIRST_INTERVIEW", "SECOND_INTERVIEW", "FINAL_REVIEW", "HIRED"]
_INTERVIEWABLE_STAGES = {"FIRST_INTERVIEW", "SECOND_INTERVIEW", "FINAL_REVIEW"}
_STAGE_TO_ROUND = {"FIRST_INTERVIEW": "FIRST", "SECOND_INTERVIEW": "SECOND", "FINAL_REVIEW": "HR"}
_UNSET = object()


def _candidate_email(db: Session, app: Application) -> str:
    candidate = db.get(Candidate, app.candidate_id)
    if candidate is None:
        return ""
    user = db.get(CandidateAccount, candidate.user_id)
    return user.email if user else ""


def _record_stage(
    db: Session,
    app: Application,
    to_stage: str | None,
    changed_by,
    reason: str,
    *,
    from_stage=_UNSET,
):
    db.add(
        ApplicationStageHistory(
            application_id=app.id,
            from_stage=app.current_stage if from_stage is _UNSET else from_stage,
            to_stage=to_stage,
            changed_by=changed_by.id if changed_by else None,
            reason=reason,
        )
    )


# ---------- Candidate ----------
def create_application(payload: ApplicationCreateIn, user: CandidateAccount = Depends(get_current_candidate_account), db: Session = Depends(get_db)):
    candidate = get_current_candidate(user, db)
    job = db.get(Job, payload.job_id)
    if job is None or job.status != "PUBLISHED":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="岗位不存在或未发布")
    resume = db.get(Resume, payload.resume_id)
    if resume is None or resume.candidate_id != candidate.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请选择本人已上传的简历")
    profile_snapshot = validate_profile_for_application(candidate)
    existing = (
        db.query(Application)
        .filter(
            Application.candidate_id == candidate.id,
            Application.job_id == job.id,
            Application.status.in_(["ACTIVE", "ON_HOLD"]),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="你已投递过该岗位")

    app = Application(
        candidate_id=candidate.id,
        job_id=job.id,
        resume_id=resume.id,
        current_stage="APPLIED",
        status="ACTIVE",
        owner_id=candidate.owner_id,
        source_channel_id=candidate.source_channel_id,
        candidate_profile_snapshot=profile_snapshot,
        job_type_snapshot=job.job_type,
    )
    if candidate.source_channel_id:
        source = db.get(models.SourceChannel, candidate.source_channel_id)
        if source:
            app.source_code_snapshot = source.code
            app.source_name_snapshot = source.name
    db.add(app)
    db.flush()
    db.add(
        ApplicationStageHistory(
            application_id=app.id,
            from_stage=None,
            to_stage="APPLIED",
            changed_by=user.id,
            reason="候选人提交申请",
        )
    )
    db.commit()
    db.refresh(app)

    # AI scoring is now async (Celery); the result appears once analyze_application finishes.
    analyze_application_task.delay(str(app.id))

    send_email_task.delay(
        user.email,
        f"投递成功 - {job.title}",
        f"您已成功投递岗位「{job.title}」，我们将尽快审核您的简历。",
        "APPLICATION_RECEIVED",
    )
    return build_application_out(db, app)


def my_applications(user: CandidateAccount = Depends(get_current_candidate_account), db: Session = Depends(get_db)):
    candidate = get_current_candidate(user, db)
    apps = (
        db.query(Application)
        .filter_by(candidate_id=candidate.id)
        .order_by(Application.applied_at.desc())
        .all()
    )
    return [build_application_out(db, a) for a in apps]


def get_my_application(application_id: str, user: CandidateAccount = Depends(get_current_candidate_account), db: Session = Depends(get_db)):
    candidate = get_current_candidate(user, db)
    app = db.get(Application, _as_uuid(application_id))
    if app is None or app.candidate_id != candidate.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申请不存在")
    return build_candidate_application_detail(db, app)


def withdraw_application(application_id: str, user: CandidateAccount = Depends(get_current_candidate_account), db: Session = Depends(get_db)):
    candidate = get_current_candidate(user, db)
    app = db.get(Application, _as_uuid(application_id))
    if app is None or app.candidate_id != candidate.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申请不存在")
    if app.status not in {"ACTIVE", "ON_HOLD"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前状态不可撤回")
    _record_stage(db, app, "WITHDRAWN", user, "候选人主动撤回申请")
    app.current_stage = "WITHDRAWN"
    app.status = "WITHDRAWN"
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Admin ----------
_DEGREE_LABELS = {
    "ASSOCIATE": "大专",
    "BACHELOR": "本科",
    "MASTER": "硕士",
    "DOCTOR": "博士",
    "OTHER_POST_SECONDARY": "其他",
    "OTHER": "其他",
}


def _snapshot_extras(app: Application, db: Session) -> dict:
    """Best-effort snapshot fields for kanban / matrix card rendering.

    - latest_company: 优先 work_experiences → 兜底 internships
    - latest_school / degree: education 列表第一条
    - skills: 从 Resume.parsed_data.skills 截前 4 个
    - next_interview_*: SCHEDULED 中 scheduled_at 最近的一场
    """
    snap = app.candidate_profile_snapshot or {}
    work = (snap.get("work_experiences") or []) + (snap.get("internships") or [])
    edu = snap.get("education") or []
    latest_company = (work[0].get("company") or "") if work else ""
    latest_school = (edu[0].get("school") or "") if edu else ""
    latest_degree_raw = (edu[0].get("degree") or "") if edu else ""
    latest_degree = _DEGREE_LABELS.get(latest_degree_raw, latest_degree_raw)

    skills: list[str] = []
    resume = db.get(Resume, app.resume_id) if app.resume_id else None
    if resume and isinstance(resume.parsed_data, dict):
        for s in (resume.parsed_data.get("skills") or [])[:4]:
            if isinstance(s, str) and s.strip():
                skills.append(s.strip())

    next_iv: Interview | None = (
        db.query(Interview)
        .filter(Interview.application_id == app.id, Interview.status == "SCHEDULED")
        .order_by(Interview.scheduled_at.asc())
        .first()
    )
    next_interview_at = next_iv.scheduled_at if next_iv else None
    next_interview_round = next_iv.round_type if next_iv else ""
    next_interviewer_name = ""
    if next_iv:
        interviewer = db.get(AdminAccount, next_iv.interviewer_id)
        next_interviewer_name = interviewer.name if interviewer else ""

    return {
        "latest_company": latest_company,
        "latest_school": latest_school,
        "latest_degree": latest_degree,
        "skills": skills,
        "next_interview_at": next_interview_at,
        "next_interview_round": next_interview_round,
        "next_interviewer_name": next_interviewer_name,
    }


def list_applications(
    job_id: str | None = Query(default=None),
    stage: str | None = Query(default=None),
    _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
):
    q = db.query(Application)
    if job_id:
        q = q.filter(Application.job_id == _as_uuid(job_id))
    if stage:
        q = q.filter(Application.current_stage == stage)
    apps = q.order_by(Application.applied_at.desc()).all()
    out = []
    for a in apps:
        candidate = db.get(Candidate, a.candidate_id)
        job = db.get(Job, a.job_id)
        offer = (
            db.query(models.Offer)
            .filter(models.Offer.application_id == a.id)
            .order_by(models.Offer.created_at.desc())
            .first()
        )
        offer_status = offer.status if offer else None
        out.append(
            AdminApplicationOut(
                id=str(a.id),
                candidate_id=str(a.candidate_id),
                job_id=str(a.job_id),
                current_stage=a.current_stage,
                status=a.status,
                ai_score=a.ai_score,
                applied_at=a.applied_at,
                candidate_name=candidate.name if candidate else "",
                job_title=job.title if job else "",
                offer_status=offer_status,
                **_snapshot_extras(a, db),
            )
        )
    return out


def get_application(application_id: str, _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    app = db.get(Application, _as_uuid(application_id))
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申请不存在")
    return build_admin_application_detail(db, app)


def _enforce_interview_feedback(db: Session, app: Application, action: str = "transition"):
    """需求：处于面试阶段时，必须先有该轮次面试的已提交面评，否则阻断「推进/淘汰」阶段动作。

    action:
      - "advance" / "reject"：推进或淘汰，必须已提交该轮面评（HR 决策需基于面试官建议）。
      - "hold"：暂缓，不要求面评，直接放行。
      - "return"：向后退回（如终面退回初筛），放行（非「推进/淘汰」语义）。
      - "transition"：通用跳转，按方向判定——向前推进按 advance 处理，向后按 return 处理。
    对历史/种子中 status 已为 COMPLETED 的面试直接放行（祖父规则）；
    对 PENDING_HR_REVIEW 且有面评的面试，顺带置为 COMPLETED（视作隐式确认）。
    """
    if app.current_stage not in _INTERVIEWABLE_STAGES:
        return
    if action in ("hold", "return"):
        return
    round_type = _STAGE_TO_ROUND[app.current_stage]
    iv = (
        db.query(Interview)
        .filter_by(application_id=app.id, round_type=round_type)
        .order_by(Interview.scheduled_at.desc())
        .first()
    )
    if iv is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该阶段尚未安排对应轮次面试，无法推进招聘阶段，请先在面试管理中安排对应轮次面试",
        )
    if iv.status == "COMPLETED":
        return
    fb = db.query(InterviewFeedback).filter_by(interview_id=iv.id).first()
    if fb is None:
        detail = (
            "该面试尚未提交考官面评，无法推进招聘阶段"
            if iv.status == "SCHEDULED"
            else "该面试面评待 HR 确认，请先在面试管理中确认面评"
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
    if iv.status == "PENDING_HR_REVIEW":
        iv.status = "COMPLETED"


def _transition_application(
    db: Session,
    app: Application,
    target_stage: str,
    user: AdminAccount,
    reason: str,
):
    advancing = target_stage in STAGE_ORDER and app.current_stage in STAGE_ORDER and (
        STAGE_ORDER.index(target_stage) > STAGE_ORDER.index(app.current_stage)
    )
    _enforce_interview_feedback(db, app, "advance" if advancing else "return")
    if app.status != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅进行中的申请可以调整阶段")
    if app.current_stage not in STAGE_ORDER or target_stage not in STAGE_ORDER:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="非法招聘阶段")
    if target_stage == "HIRED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="录用必须由候选人接受 Offer 完成")
    if app.current_stage == target_stage:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="目标阶段不能与当前阶段相同")
    _record_stage(db, app, target_stage, user, reason.strip())
    app.current_stage = target_stage
    if target_stage == "HIRED":
        app.status = "HIRED"
    db.commit()

    if target_stage == "HIRED":
        job = db.get(Job, app.job_id)
        candidate_email = _candidate_email(db, app)
        if candidate_email:
            subject, body = email_sender.final_result_template(job.title if job else "", hired=True)
            send_email_task.delay(candidate_email, subject, body, email_sender.KIND_FINAL_RESULT)
    return build_admin_application_detail(db, app)


def transition_stage(
    application_id: str,
    payload: StageTransitionIn,
    user: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
):
    app = db.get(Application, _as_uuid(application_id))
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申请不存在")
    return _transition_application(db, app, payload.target_stage, user, payload.reason)


def next_stage(
    application_id: str,
    payload: StageReasonIn,
    user: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
):
    app = db.get(Application, _as_uuid(application_id))
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申请不存在")
    return _next_stage(db, app, user, payload.reason)


def _next_stage(db: Session, app: Application, user: AdminAccount, reason: str):
    _enforce_interview_feedback(db, app, "advance")
    if app.status != "ACTIVE" or app.current_stage not in STAGE_ORDER:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前状态不可推进")
    idx = STAGE_ORDER.index(app.current_stage)
    if idx >= len(STAGE_ORDER) - 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="已处于最终阶段，无法继续推进")
    return _transition_application(db, app, STAGE_ORDER[idx + 1], user, reason)


def hold_application(
    application_id: str,
    payload: StageReasonIn,
    user: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
):
    app = db.get(Application, _as_uuid(application_id))
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申请不存在")
    return _hold_application(db, app, user, payload.reason)


def _hold_application(db: Session, app: Application, user: AdminAccount, reason: str):
    _enforce_interview_feedback(db, app, "hold")
    if app.status != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅进行中的申请可以暂缓")
    _record_stage(db, app, None, user, reason.strip())
    app.status = "ON_HOLD"
    db.commit()
    return build_admin_application_detail(db, app)


def resume_application(
    application_id: str,
    payload: StageReasonIn,
    user: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
):
    app = db.get(Application, _as_uuid(application_id))
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申请不存在")
    if app.status != "ON_HOLD":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅暂缓中的申请可以恢复")
    _record_stage(db, app, app.current_stage, user, payload.reason.strip(), from_stage=None)
    app.status = "ACTIVE"
    db.commit()
    return build_admin_application_detail(db, app)


def reject_application(
    application_id: str,
    payload: StageReasonIn,
    user: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
):
    app = db.get(Application, _as_uuid(application_id))
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申请不存在")
    return _reject_application(db, app, user, payload.reason)


def _reject_core(db: Session, app: Application, user: AdminAccount, reason: str):
    """Reject an application and park the candidate in the talent pool (no commit)."""
    _enforce_interview_feedback(db, app, "reject")
    if app.status not in {"ACTIVE", "ON_HOLD"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该申请已结束")
    from_stage = app.current_stage
    _record_stage(db, app, "REJECTED", user, reason.strip())
    app.current_stage = "REJECTED"
    app.status = "REJECTED"
    candidate = db.get(Candidate, app.candidate_id)
    if candidate is not None:
        from ..talent.pool import enter_talent_pool

        enter_talent_pool(db, candidate, from_stage, reason, user)


def _reject_application(db: Session, app: Application, user: AdminAccount, reason: str):
    _reject_core(db, app, user, reason)
    db.commit()

    job = db.get(Job, app.job_id)
    candidate_email = _candidate_email(db, app)
    if candidate_email:
        subject, body = email_sender.final_result_template(job.title if job else "", hired=False)
        send_email_task.delay(candidate_email, subject, body, email_sender.KIND_FINAL_RESULT)
    return build_admin_application_detail(db, app)


def agent_result(application_id: str, _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    app = db.get(Application, _as_uuid(application_id))
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申请不存在")
    agent = db.query(AgentResult).filter_by(application_id=app.id).first()
    if agent is None:
        # Trigger scoring (in case it was missed) and return a PENDING placeholder.
        analyze_application_task.delay(str(app.id))
        return AgentResultOut(
            id=uuid.uuid4(),
            application_id=app.id,
            score=0.0,
            summary="AI 分析生成中…",
            strengths=[],
            gaps=[],
            recommendation="CONSIDER",
            status="PENDING",
        )
    return AgentResultOut.model_validate(agent)


def agent_rerun(application_id: str, _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    app = db.get(Application, _as_uuid(application_id))
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申请不存在")
    job = db.get(Job, app.job_id)
    resume = db.query(Resume).filter_by(id=app.resume_id).first()
    if job is None or resume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="缺少岗位或简历数据")
    # Re-run scoring asynchronously; return current (or PENDING) result immediately.
    agent = db.query(AgentResult).filter_by(application_id=app.id).first()
    analyze_application_task.delay(str(app.id))
    if agent is None:
        return AgentResultOut(
            id=uuid.uuid4(),
            application_id=app.id,
            score=0.0,
            summary="AI 分析生成中…",
            strengths=[],
            gaps=[],
            recommendation="CONSIDER",
            status="PENDING",
        )
    return AgentResultOut.model_validate(agent)


def download_resume(
    application_id: str,
    _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
):
    app = db.get(Application, _as_uuid(application_id))
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申请不存在")
    resume = db.get(Resume, app.resume_id) if app.resume_id else None
    if resume is None or not resume.storage_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="简历文件不存在")
    try:
        data = storage.read_file(resume.storage_key)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="简历文件读取失败")
    filename = resume.file_name or "resume.pdf"
    # RFC 5987: 中文文件名用 filename*=UTF-8'' 编码，避免 latin-1 header 编码报错
    disposition = f"attachment; filename=\"resume.pdf\"; filename*=UTF-8''{quote(filename)}"
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": disposition},
    )


def _as_uuid(value):
    import uuid

    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的 ID")

