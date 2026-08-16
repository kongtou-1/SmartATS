"""Offer lifecycle orchestration."""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends, HTTPException, Response
from sqlalchemy.orm import Session

from ... import models
from ...core.audit import actor_type_of, write_audit
from ..database import get_db
from ...core.config import CANDIDATE_PORTAL_URL
from ...core.permissions import get_current_candidate, get_current_candidate_account, require_roles
from ...schemas import OfferDecisionIn, OfferIn, OfferOut, OfferResponseIn
from ..documents.offer_pdf import generate_offer_pdf
from ...storage import storage

ACTIVE = {"DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT"}


def now(): return datetime.now(timezone.utc)
def utc(v): return v.replace(tzinfo=timezone.utc) if v.tzinfo is None else v.astimezone(timezone.utc)


def build(db, offer):
    c, j = db.get(models.Candidate, offer.candidate_id), db.get(models.Job, offer.job_id)
    return OfferOut(
        id=offer.id, application_id=offer.application_id, candidate_id=offer.candidate_id, job_id=offer.job_id,
        status=offer.status, salary_description=offer.salary_description, work_location=offer.work_location,
        expected_start_date=offer.expected_start_date, expires_at=offer.expires_at, probation=offer.probation,
        extra_terms=offer.extra_terms, current_version=offer.current_version, candidate_name=c.name if c else "",
        job_title=j.title if j else "", created_by=offer.created_by, approved_by=offer.approved_by,
        created_at=offer.created_at, updated_at=offer.updated_at,
    )


def validate_input(db, payload, current=None):
    app = db.get(models.Application, payload.application_id)
    if not app: raise HTTPException(404, "申请不存在")
    # 终面（FINAL_REVIEW）或面试通过（HIRED）阶段均可发放 Offer
    if app.current_stage not in ("FINAL_REVIEW", "HIRED") or app.status not in ("ACTIVE", "HIRED"):
        raise HTTPException(400, "只能为终面或面试通过阶段的申请创建 Offer")
    if utc(payload.expires_at) <= now(): raise HTTPException(400, "Offer 有效期必须晚于当前时间")
    existing = db.query(models.Offer).filter(models.Offer.application_id == app.id, models.Offer.status.in_(ACTIVE)).first()
    if existing and (not current or existing.id != current.id): raise HTTPException(409, "该申请已有有效 Offer")
    return app


def list_offers(status: str = "", _=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    q = db.query(models.Offer)
    if status: q = q.filter_by(status=status)
    return [build(db, o) for o in q.order_by(models.Offer.created_at.desc()).all()]


def create_offer(payload: OfferIn, user=Depends(require_roles("HR", "SUPER_ADMIN")), db: Session = Depends(get_db)):
    app = validate_input(db, payload)
    offer = models.Offer(application_id=app.id, candidate_id=app.candidate_id, job_id=app.job_id, status="DRAFT", created_by=user.id, **payload.model_dump(exclude={"application_id"}))
    db.add(offer); db.flush(); write_audit(db, actor=user, action="OFFER_CREATE", entity_type="Offer", entity_id=offer.id, after=payload.model_dump()); db.commit(); db.refresh(offer); return build(db, offer)


def get_offer(offer_id: UUID, _=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    offer = db.get(models.Offer, offer_id)
    if not offer: raise HTTPException(404, "Offer 不存在")
    return build(db, offer)


def update_offer(offer_id: UUID, payload: OfferIn, user=Depends(require_roles("HR")), db: Session = Depends(get_db)):
    offer = db.get(models.Offer, offer_id)
    if not offer: raise HTTPException(404, "Offer 不存在")
    if offer.created_by != user.id or offer.status not in {"DRAFT", "REJECTED_APPROVAL", "APPROVED"}: raise HTTPException(400, "当前 Offer 不可编辑")
    validate_input(db, payload, offer)
    for k, v in payload.model_dump(exclude={"application_id"}).items(): setattr(offer, k, v)
    offer.status = "DRAFT"; write_audit(db, actor=user, action="OFFER_UPDATE", entity_type="Offer", entity_id=offer.id, after=payload.model_dump()); db.commit(); db.refresh(offer); return build(db, offer)


def submit_offer(offer_id: UUID, user=Depends(require_roles("HR")), db: Session = Depends(get_db)):
    offer = db.get(models.Offer, offer_id)
    if not offer or offer.created_by != user.id: raise HTTPException(404, "Offer 不存在")
    if offer.status not in {"DRAFT", "REJECTED_APPROVAL"}: raise HTTPException(400, "当前状态不可提交审批")
    offer.status = "PENDING_APPROVAL"
    admins = db.query(models.AdminAccount).filter_by(role="SUPER_ADMIN", status="ACTIVE").filter(models.AdminAccount.delete_at.is_(None))
    for admin in admins:
        db.add(models.Notification(user_id=admin.id, user_type="ADMIN", kind="OFFER_APPROVAL", title="新的 Offer 待审批", body=f"{build(db, offer).candidate_name} - {build(db, offer).job_title}", link=f"/offers/{offer.id}"))
    write_audit(db, actor=user, action="OFFER_SUBMIT", entity_type="Offer", entity_id=offer.id); db.commit(); db.refresh(offer); return build(db, offer)


def approve_offer(offer_id: UUID, payload: OfferDecisionIn, user=Depends(require_roles("SUPER_ADMIN")), db: Session = Depends(get_db)):
    offer = db.get(models.Offer, offer_id)
    if not offer or offer.status != "PENDING_APPROVAL": raise HTTPException(400, "当前 Offer 不可审批")
    c, j = db.get(models.Candidate, offer.candidate_id), db.get(models.Job, offer.job_id)
    version = offer.current_version + 1
    snapshot = {"candidate_name": c.name if c else "", "job_title": j.title if j else "", "salary_description": offer.salary_description, "work_location": offer.work_location, "expected_start_date": offer.expected_start_date.date().isoformat(), "expires_at": utc(offer.expires_at).isoformat(), "probation": offer.probation, "extra_terms": offer.extra_terms, "version": version}
    raw = generate_offer_pdf(snapshot); key = storage.save_file(f"offers/offer-{offer.id}-v{version}.pdf", raw)
    db.add(models.OfferVersion(offer_id=offer.id, version=version, snapshot=snapshot, pdf_storage_key=key))
    db.add(models.OfferApproval(offer_id=offer.id, approver_id=user.id, decision="APPROVED", comment=payload.comment))
    offer.status = "APPROVED"; offer.approved_by = user.id; offer.current_version = version
    write_audit(db, actor=user, action="OFFER_APPROVE", entity_type="Offer", entity_id=offer.id, after={"version": version}); db.commit(); db.refresh(offer); return build(db, offer)


def reject_offer(offer_id: UUID, payload: OfferDecisionIn, user=Depends(require_roles("SUPER_ADMIN")), db: Session = Depends(get_db)):
    if not payload.comment.strip(): raise HTTPException(400, "驳回原因不能为空")
    offer = db.get(models.Offer, offer_id)
    if not offer or offer.status != "PENDING_APPROVAL": raise HTTPException(400, "当前 Offer 不可驳回")
    db.add(models.OfferApproval(offer_id=offer.id, approver_id=user.id, decision="REJECTED", comment=payload.comment)); offer.status = "REJECTED_APPROVAL"
    db.add(models.Notification(user_id=offer.created_by, user_type="ADMIN", kind="OFFER_REJECTED", title="Offer 审批被驳回", body=payload.comment, link=f"/offers/{offer.id}"))
    write_audit(db, actor=user, action="OFFER_REJECT_APPROVAL", entity_type="Offer", entity_id=offer.id); db.commit(); db.refresh(offer); return build(db, offer)


def send_offer(offer_id: UUID, user=Depends(require_roles("HR")), db: Session = Depends(get_db)):
    offer = db.get(models.Offer, offer_id)
    if not offer or offer.status != "APPROVED": raise HTTPException(400, "仅已审批 Offer 可以发送")
    raw_token = secrets.token_urlsafe(32); offer.response_token_hash = hashlib.sha256(raw_token.encode()).hexdigest(); offer.status = "SENT"
    c = db.get(models.Candidate, offer.candidate_id); title = "录用通知书"; body = f"您有一份新的 Offer，请在 {utc(offer.expires_at).isoformat()} 前处理。"
    db.add(models.CandidateCommunication(candidate_id=offer.candidate_id, application_id=offer.application_id, sender_id=user.id, channel="IN_APP+EMAIL", subject=title, body=body, delivery_status="SIMULATED"))
    if c and c.user_id: db.add(models.Notification(user_id=c.user_id, user_type="CANDIDATE", kind="OFFER_SENT", title=title, body=body, link=f"/offers/{offer.id}"))
    email = c.contact_email if c else ""
    if not email and c and c.user_id:
        cu = db.get(models.CandidateAccount, c.user_id); email = cu.email if cu else ""
    response_url = f"{CANDIDATE_PORTAL_URL}/offer-response/{raw_token}"
    db.add(models.EmailLog(kind="OFFER_SENT", to_email=email, subject=title, body=f"{body}\n响应链接：{response_url}", delivery_status="SIMULATED"))
    write_audit(db, actor=user, action="OFFER_SEND", entity_type="Offer", entity_id=offer.id, after={"delivery_status": "SIMULATED"}); db.commit()
    return {"offer": build(db, offer), "simulated_response_url": response_url}


def respond(db, offer, decision, reason, actor=None):
    claimed = db.query(models.Offer).filter(models.Offer.id == offer.id, models.Offer.status == "SENT", models.Offer.expires_at > now()).update({models.Offer.status: "RESPONDING", models.Offer.response_token_hash: ""}, synchronize_session=False)
    if claimed != 1:
        db.rollback(); db.refresh(offer)
        if offer.status == "SENT" and utc(offer.expires_at) <= now():
            offer.status = "EXPIRED"; offer.response_token_hash = ""; db.commit(); raise HTTPException(410, "Offer 已过期")
        raise HTTPException(409, "Offer 已处理或正在处理")
    app = db.get(models.Application, offer.application_id)
    if not app or app.status != "ACTIVE" or app.current_stage != "FINAL_REVIEW":
        db.rollback(); raise HTTPException(409, "关联申请状态已变化，无法响应 Offer")
    offer.responded_at = now(); offer.response_token_hash = ""; offer.response_reason = reason
    if decision == "ACCEPT":
        offer.status = "ACCEPTED"; app.current_stage = "HIRED"; app.status = "HIRED"
        db.add(models.ApplicationStageHistory(application_id=app.id, from_stage="FINAL_REVIEW", to_stage="HIRED", changed_by=getattr(actor, "id", None), reason="候选人接受 Offer"))
    else:
        offer.status = "DECLINED"; app.current_stage = "REJECTED"; app.status = "REJECTED"
        db.add(models.ApplicationStageHistory(application_id=app.id, from_stage="FINAL_REVIEW", to_stage="REJECTED", changed_by=getattr(actor, "id", None), reason=reason or "候选人拒绝 Offer"))
    write_audit(db, actor=actor, actor_type=actor_type_of(actor) if actor else "CANDIDATE_LINK", action=f"OFFER_{offer.status}", entity_type="Offer", entity_id=offer.id); db.commit(); db.refresh(offer); return build(db, offer)


def my_offers(user=Depends(get_current_candidate_account), db: Session = Depends(get_db)):
    c = get_current_candidate(user, db)
    visible = ["SENT", "ACCEPTED", "DECLINED", "EXPIRED", "VOIDED"]
    return [build(db, o) for o in db.query(models.Offer).filter(models.Offer.candidate_id == c.id, models.Offer.status.in_(visible)).order_by(models.Offer.created_at.desc()).all()]


def candidate_respond(offer_id: UUID, payload: OfferResponseIn, user=Depends(get_current_candidate_account), db: Session = Depends(get_db)):
    c = get_current_candidate(user, db); offer = db.get(models.Offer, offer_id)
    if not offer or offer.candidate_id != c.id: raise HTTPException(404, "Offer 不存在")
    return respond(db, offer, payload.decision, payload.reason, user)


def candidate_pdf(offer_id: UUID, user=Depends(get_current_candidate_account), db: Session = Depends(get_db)):
    c = get_current_candidate(user, db); offer = db.get(models.Offer, offer_id)
    if not offer or offer.candidate_id != c.id or offer.status not in {"SENT", "ACCEPTED", "DECLINED", "EXPIRED"} or not offer.current_version: raise HTTPException(404, "PDF 不存在")
    version = db.query(models.OfferVersion).filter_by(offer_id=offer.id, version=offer.current_version).one()
    return Response(content=storage.read_file(version.pdf_storage_key), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="offer-v{version.version}.pdf"'})


def inspect_token(token: str, db: Session = Depends(get_db)):
    offer = db.query(models.Offer).filter_by(response_token_hash=hashlib.sha256(token.encode()).hexdigest()).first()
    if not offer: raise HTTPException(404, "链接无效")
    if offer.status != "SENT": raise HTTPException(404, "链接无效")
    if utc(offer.expires_at) <= now(): raise HTTPException(410, "Offer 已过期")
    return {"offer": build(db, offer), "response_required": offer.status == "SENT"}


def public_pdf(token: str, db: Session = Depends(get_db)):
    offer = db.query(models.Offer).filter_by(response_token_hash=hashlib.sha256(token.encode()).hexdigest()).first()
    if not offer or offer.status != "SENT" or not offer.current_version: raise HTTPException(404, "PDF 不存在或链接已失效")
    if utc(offer.expires_at) <= now(): raise HTTPException(410, "Offer 已过期")
    version = db.query(models.OfferVersion).filter_by(offer_id=offer.id, version=offer.current_version).one()
    return Response(content=storage.read_file(version.pdf_storage_key), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="offer-v{version.version}.pdf"'})


def public_respond(token: str, payload: OfferResponseIn, db: Session = Depends(get_db)):
    offer = db.query(models.Offer).filter_by(response_token_hash=hashlib.sha256(token.encode()).hexdigest()).first()
    if not offer: raise HTTPException(404, "链接无效")
    return respond(db, offer, payload.decision, payload.reason)


def download_pdf(offer_id: UUID, _=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    offer = db.get(models.Offer, offer_id)
    if not offer or not offer.current_version: raise HTTPException(404, "PDF 不存在")
    version = db.query(models.OfferVersion).filter_by(offer_id=offer.id, version=offer.current_version).one()
    return Response(content=storage.read_file(version.pdf_storage_key), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="offer-v{version.version}.pdf"'})

