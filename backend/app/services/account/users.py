"""Management-end account administration (super admin only).

Operates exclusively on `admin_accounts`. C-end accounts live in a separate table and
are never returned here. Deletion is soft: `delete_at` is stamped and the row is
filtered out of every listing afterwards.
"""
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ...core.permissions import require_roles
from ...core.security import hash_password
from ...models import AdminAccount, CandidateAccount
from ...schemas import AdminAccountOut, UserCreateIn, UserUpdateIn


# 管理端账号不含 CANDIDATE，求职者账号一律走 candidate_accounts
_VALID_ROLES = {"SUPER_ADMIN", "HR", "INTERVIEWER", "DIRECTION_OWNER"}


def _active(db: Session):
    """Base query excluding soft-deleted management accounts."""
    return db.query(AdminAccount).filter(AdminAccount.delete_at.is_(None))


def _ensure_email_free(db: Session, email: str, exclude_admin_id=None) -> None:
    """An email may exist at most once across *both* account tables.

    Login resolves `admin_accounts` first, so letting a management account reuse a
    job-seeker's address would silently shadow the C-end account. Soft-deleted rows
    are ignored — their address is released.
    """
    normalized = email.strip()
    clash = _active(db).filter(AdminAccount.email == normalized)
    if exclude_admin_id is not None:
        clash = clash.filter(AdminAccount.id != exclude_admin_id)
    if clash.first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该邮箱已存在")
    taken_by_candidate = (
        db.query(CandidateAccount)
        .filter(CandidateAccount.email == normalized, CandidateAccount.delete_at.is_(None))
        .first()
    )
    if taken_by_candidate:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该邮箱已被求职者账号占用")


def list_direction_owners(_: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    users = (
        _active(db)
        .filter(AdminAccount.role == "DIRECTION_OWNER", AdminAccount.status == "ACTIVE")
        .order_by(AdminAccount.name)
        .all()
    )
    return [AdminAccountOut.model_validate(u) for u in users]


def list_interviewers(_: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    users = (
        _active(db)
        .filter(AdminAccount.role == "INTERVIEWER", AdminAccount.status == "ACTIVE")
        .order_by(AdminAccount.created_at.desc())
        .all()
    )
    return [AdminAccountOut.model_validate(u) for u in users]


def list_users(_: AdminAccount = Depends(require_roles("SUPER_ADMIN")), db: Session = Depends(get_db)):
    users = _active(db).order_by(AdminAccount.created_at.desc()).all()
    return [AdminAccountOut.model_validate(u) for u in users]


def create_user(payload: UserCreateIn, _: AdminAccount = Depends(require_roles("SUPER_ADMIN")), db: Session = Depends(get_db)):
    if payload.role not in _VALID_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="非法角色")
    _ensure_email_free(db, payload.email)
    user = AdminAccount(
        email=payload.email,
        password_hash=hash_password(payload.password),
        name=payload.name,
        title=payload.title or "",
        role=payload.role,
        status="ACTIVE",
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # 并发下撞 uq_admin_accounts_email_active
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该邮箱已存在")
    db.refresh(user)
    return AdminAccountOut.model_validate(user)


def update_user(user_id: str, payload: UserUpdateIn, _: AdminAccount = Depends(require_roles("SUPER_ADMIN")), db: Session = Depends(get_db)):
    user = _get_active_or_404(db, user_id)
    if payload.email is not None:
        _ensure_email_free(db, payload.email, exclude_admin_id=user.id)
        user.email = payload.email
    if payload.name is not None:
        user.name = payload.name
    if payload.title is not None:
        user.title = payload.title
    if payload.role is not None:
        if payload.role not in _VALID_ROLES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="非法角色")
        user.role = payload.role
    if payload.status is not None:
        user.status = payload.status
    if payload.password:
        user.password_hash = hash_password(payload.password)
    db.commit()
    db.refresh(user)
    return AdminAccountOut.model_validate(user)


def delete_user(
    user_id: str,
    actor: AdminAccount = Depends(require_roles("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    """Soft-delete a management account by stamping `delete_at`."""
    user = _get_active_or_404(db, user_id)
    if user.id == actor.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不能删除自己的账号")
    user.delete_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return AdminAccountOut.model_validate(user)


def _get_active_or_404(db: Session, user_id: str) -> AdminAccount:
    user = db.get(AdminAccount, _as_uuid(user_id))
    if user is None or user.delete_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    return user


def _as_uuid(value):
    import uuid

    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的 ID")
