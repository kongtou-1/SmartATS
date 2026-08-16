"""Recruitment dynamics / announcements (incl. flow issues 流程问题).

Public read (PUBLISHED only) + HR/admin CRUD with a DRAFT -> PUBLISHED -> CLOSED
state machine mirroring Job.
"""
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ...core.permissions import require_roles
from ...models import Announcement, AdminAccount
from ...schemas import AnnouncementInput, AnnouncementOut



# ---------- Public ----------
def list_announcements(type: str = Query(default=""), db: Session = Depends(get_db)):
    q = db.query(Announcement).filter(Announcement.status == "PUBLISHED")
    if type:
        q = q.filter(Announcement.type == type)
    q = q.order_by(Announcement.pinned.desc(), Announcement.published_at.desc())
    return [AnnouncementOut.model_validate(a) for a in q.all()]


def get_announcement(announcement_id: str, db: Session = Depends(get_db)):
    a = db.get(Announcement, _as_uuid(announcement_id))
    if a is None or a.status != "PUBLISHED":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="动态不存在")
    return AnnouncementOut.model_validate(a)


# ---------- Admin ----------
def admin_list_announcements(
    type: str = Query(default=""),
    _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
):
    q = db.query(Announcement)
    if type:
        q = q.filter(Announcement.type == type)
    q = q.order_by(Announcement.pinned.desc(), Announcement.created_at.desc())
    return [AnnouncementOut.model_validate(a) for a in q.all()]


def admin_create_announcement(
    payload: AnnouncementInput,
    user: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
):
    a = Announcement(
        type=payload.type,
        title=payload.title,
        content=payload.content,
        pinned=payload.pinned,
        status="DRAFT",
        created_by=user.id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return AnnouncementOut.model_validate(a)


def admin_get_announcement(
    announcement_id: str,
    _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
):
    a = db.get(Announcement, _as_uuid(announcement_id))
    if a is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="动态不存在")
    return AnnouncementOut.model_validate(a)


def admin_update_announcement(
    announcement_id: str,
    payload: AnnouncementInput,
    _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
):
    a = db.get(Announcement, _as_uuid(announcement_id))
    if a is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="动态不存在")
    a.type = payload.type
    a.title = payload.title
    a.content = payload.content
    a.pinned = payload.pinned
    db.commit()
    db.refresh(a)
    return AnnouncementOut.model_validate(a)


def admin_delete_announcement(
    announcement_id: str,
    _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
):
    a = db.get(Announcement, _as_uuid(announcement_id))
    if a is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="动态不存在")
    db.delete(a)
    db.commit()


def admin_publish_announcement(
    announcement_id: str,
    _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
):
    a = db.get(Announcement, _as_uuid(announcement_id))
    if a is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="动态不存在")
    a.status = "PUBLISHED"
    a.published_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(a)
    return AnnouncementOut.model_validate(a)


def admin_close_announcement(
    announcement_id: str,
    _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
):
    a = db.get(Announcement, _as_uuid(announcement_id))
    if a is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="动态不存在")
    a.status = "CLOSED"
    db.commit()
    db.refresh(a)
    return AnnouncementOut.model_validate(a)


def _as_uuid(value):
    import uuid

    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的 ID")

