"""Bulk application operations."""
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from ... import models
from ...core.audit import write_audit
from ..database import get_db
from ...core.permissions import require_roles
from ..email import sender as email_sender
from ...schemas import BulkActionIn
from .applications import STAGE_ORDER, _record_stage, _reject_core



def _message(db, app, user, subject, body):
    candidate = db.get(models.Candidate, app.candidate_id)
    db.add(models.CandidateCommunication(candidate_id=app.candidate_id, application_id=app.id, sender_id=user.id, channel="IN_APP+EMAIL", subject=subject, body=body, delivery_status="SIMULATED"))
    if candidate and candidate.user_id:
        db.add(models.Notification(user_id=candidate.user_id, user_type="CANDIDATE", kind="CANDIDATE_MESSAGE", title=subject, body=body, link=f"/applications/{app.id}"))
    email = candidate.contact_email if candidate else ""
    if not email and candidate and candidate.user_id:
        candidate_user = db.get(models.CandidateAccount, candidate.user_id); email = candidate_user.email if candidate_user else ""
    if email: db.add(models.EmailLog(kind="BULK_NOTIFICATION", to_email=email, subject=subject, body=body, delivery_status="SIMULATED"))


def bulk_actions(payload: BulkActionIn, user=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    existing = db.query(models.IdempotencyRecord).filter_by(actor_id=user.id, key=payload.idempotency_key, operation=payload.action).first()
    if existing: return existing.response_data
    results = []
    for app_id in payload.application_ids:
        try:
            with db.begin_nested():
                app = db.get(models.Application, app_id)
                if not app: raise ValueError("申请不存在")
                if payload.action == "ADVANCE":
                    if app.status != "ACTIVE" or app.current_stage not in STAGE_ORDER: raise ValueError("当前状态不可推进")
                    target = payload.target_stage
                    if not target:
                        idx = STAGE_ORDER.index(app.current_stage)
                        if idx >= len(STAGE_ORDER) - 1: raise ValueError("已处于最终阶段")
                        target = STAGE_ORDER[idx + 1]
                    if target == "HIRED": raise ValueError("录用必须通过 Offer 接受完成")
                    if target not in STAGE_ORDER or target == app.current_stage: raise ValueError("目标阶段无效")
                    _record_stage(db, app, target, user, payload.reason or "批量推进"); app.current_stage = target
                elif payload.action == "REJECT":
                    if not payload.reason.strip(): raise ValueError("拒绝原因不能为空")
                    _reject_core(db, app, user, payload.reason)
                else:
                    if not payload.subject.strip() or not payload.body.strip(): raise ValueError("通知主题和正文不能为空")
                    _message(db, app, user, payload.subject.strip(), payload.body.strip())
                db.flush()
            results.append({"application_id": str(app_id), "success": True})
        except Exception as exc:
            results.append({"application_id": str(app_id), "success": False, "error": str(exc)})
    response = {"action": payload.action, "success_count": sum(1 for r in results if r["success"]), "failure_count": sum(1 for r in results if not r["success"]), "results": results}
    db.add(models.IdempotencyRecord(actor_id=user.id, key=payload.idempotency_key, operation=payload.action, response_data=response))
    write_audit(db, actor=user, action=f"BULK_{payload.action}", entity_type="ApplicationBatch", entity_id=payload.idempotency_key, after=response)
    db.commit(); return response

