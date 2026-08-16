"""User notification and candidate communication services.

`Notification.user_id` is a polymorphic reference: it may point at
`candidate_accounts.id` or `admin_accounts.id`. `user_type` disambiguates, and every
read below is scoped by both columns so the two ends can never see each other's rows.
"""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from ... import models
from ..database import get_db
from ...core.permissions import get_current_user, require_roles
from ...schemas import NotificationOut


def notification_scope(account) -> str:
    """Map an account instance to its Notification.user_type value."""
    return "ADMIN" if isinstance(account, models.AdminAccount) else "CANDIDATE"


def _owned(db: Session, user):
    return db.query(models.Notification).filter(
        models.Notification.user_id == user.id,
        models.Notification.user_type == notification_scope(user),
    )


def list_notifications(unread_only: bool = False, user=Depends(get_current_user), db: Session = Depends(get_db)):
    q = _owned(db, user)
    if unread_only: q = q.filter(models.Notification.read_at.is_(None))
    return q.order_by(models.Notification.created_at.desc()).limit(200).all()


def unread_count(user=Depends(get_current_user), db: Session = Depends(get_db)):
    return {"count": _owned(db, user).filter(models.Notification.read_at.is_(None)).count()}


def mark_all_read(user=Depends(get_current_user), db: Session = Depends(get_db)):
    _owned(db, user).filter(models.Notification.read_at.is_(None)).update({"read_at": datetime.now(timezone.utc)})
    db.commit(); return {"ok": True}


def mark_read(notification_id: UUID, user=Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.get(models.Notification, notification_id)
    if not row or row.user_id != user.id or row.user_type != notification_scope(user):
        raise HTTPException(404, "通知不存在")
    row.read_at = datetime.now(timezone.utc); db.commit(); return {"ok": True}


def communications(candidate_id: UUID, _=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    rows = db.query(models.CandidateCommunication).filter_by(candidate_id=candidate_id).order_by(models.CandidateCommunication.created_at.desc()).all()
    return [{"id": r.id, "application_id": r.application_id, "sender_id": r.sender_id, "channel": r.channel, "subject": r.subject, "body": r.body, "delivery_status": r.delivery_status, "created_at": r.created_at} for r in rows]
