"""Authentication dependencies and role-based access control.

RBAC is fixed in code per hr_ats_agent_mvp_v1.md §14 (no dynamic permission tables in MVP).

Accounts live in two isolated tables (`candidate_accounts` / `admin_accounts`).
The JWT `typ` claim decides which table the subject is resolved from. Rows whose
`delete_at` is set are treated as non-existent (soft-deleted).
"""
import uuid
from typing import Union

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from ..services.database import get_db
from .security import TOKEN_TYPE_ADMIN, TOKEN_TYPE_CANDIDATE, decode_access_token
from .. import models

_bearer = HTTPBearer(auto_error=False)

# Either account type; management-only routes should depend on get_current_admin.
Account = Union["models.CandidateAccount", "models.AdminAccount"]

_ACCOUNT_MODELS = {
    TOKEN_TYPE_CANDIDATE: models.CandidateAccount,
    TOKEN_TYPE_ADMIN: models.AdminAccount,
}

_CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="未登录或登录已过期",
    headers={"WWW-Authenticate": "Bearer"},
)


def _as_uuid(value: str):
    try:
        return uuid.UUID(value)
    except Exception:
        return value


def _resolve_account(db: Session, token: str) -> Account:
    try:
        payload = decode_access_token(token)
    except Exception:
        raise _CREDENTIALS_EXC

    subject = payload.get("sub")
    account_type = payload.get("typ") or TOKEN_TYPE_CANDIDATE
    model = _ACCOUNT_MODELS.get(account_type)
    if not subject or model is None:
        raise _CREDENTIALS_EXC

    account = db.get(model, _as_uuid(subject))
    if account is None or account.delete_at is not None:
        raise _CREDENTIALS_EXC
    if account.status == "DISABLED":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已被禁用")
    return account


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Account:
    """Resolve the caller from either account table (candidate or admin)."""
    if creds is None or not creds.credentials:
        raise _CREDENTIALS_EXC
    return _resolve_account(db, creds.credentials)


def get_current_admin(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> "models.AdminAccount":
    """Management-end only: rejects C-end tokens with 403."""
    if creds is None or not creds.credentials:
        raise _CREDENTIALS_EXC
    account = _resolve_account(db, creds.credentials)
    if not isinstance(account, models.AdminAccount):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限访问管理端接口")
    return account


def get_current_candidate_account(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> "models.CandidateAccount":
    """C-end only: rejects management tokens with 403."""
    if creds is None or not creds.credentials:
        raise _CREDENTIALS_EXC
    account = _resolve_account(db, creds.credentials)
    if not isinstance(account, models.CandidateAccount):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="该接口仅限求职者账号访问")
    return account


def require_roles(*roles: str):
    """Dependency factory: management account whose role is in `roles`, else 403."""

    def _dep(account: "models.AdminAccount" = Depends(get_current_admin)) -> "models.AdminAccount":
        if account.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限执行此操作")
        return account

    return _dep


def get_current_candidate(user: Account, db: Session) -> "models.Candidate":
    """Look up the candidate profile owned by a C-end account."""
    candidate = db.query(models.Candidate).filter(models.Candidate.user_id == user.id).first()
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="候选人资料不存在")
    return candidate
