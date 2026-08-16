"""Authentication: register / login / current user.

Accounts are isolated in two tables. Registration always creates a C-end account.
Login looks the email up in `admin_accounts` first, then `candidate_accounts`, and
stamps the resolved account type into the JWT `typ` claim. Soft-deleted rows
(`delete_at IS NOT NULL`) are invisible to both paths.
"""
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ...core.permissions import Account, get_current_user
from ...core.security import (
    TOKEN_TYPE_ADMIN,
    TOKEN_TYPE_CANDIDATE,
    create_access_token,
    hash_password,
    verify_password,
)
from ...models import AdminAccount, Candidate, CandidateAccount
from ...schemas import AdminAccountOut, AuthResponse, CandidateAccountOut, LoginIn, RegisterIn


def serialize_account(account: Account):
    """Pick the right response schema for whichever account table the row came from."""
    if isinstance(account, AdminAccount):
        return AdminAccountOut.model_validate(account)
    return CandidateAccountOut.model_validate(account)


def _email_taken(db: Session, email: str) -> bool:
    """An email may exist at most once across both account tables."""
    normalized = email.strip()
    in_candidates = (
        db.query(CandidateAccount)
        .filter(CandidateAccount.email == normalized, CandidateAccount.delete_at.is_(None))
        .first()
    )
    if in_candidates:
        return True
    return (
        db.query(AdminAccount)
        .filter(AdminAccount.email == normalized, AdminAccount.delete_at.is_(None))
        .first()
        is not None
    )


def register(payload: RegisterIn, db: Session = Depends(get_db)):
    if _email_taken(db, payload.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该邮箱已注册")
    account = CandidateAccount(
        email=payload.email.strip(),
        password_hash=hash_password(payload.password),
        name=payload.name,
        status="ACTIVE",
    )
    db.add(account)
    db.flush()  # populate account.id
    db.add(Candidate(
        user_id=account.id,
        name=payload.name,
        contact_email=payload.email.strip(),
        normalized_email=payload.email.strip().lower(),
    ))
    db.commit()
    db.refresh(account)
    return AuthResponse(
        access_token=create_access_token(str(account.id), TOKEN_TYPE_CANDIDATE),
        token_type="bearer",
        user=serialize_account(account),
    )


def login(payload: LoginIn, db: Session = Depends(get_db)):
    email = payload.email.strip()
    account = None
    account_type = TOKEN_TYPE_CANDIDATE

    # scope 限定登录入口所属的端；不传则先查管理端再查求职者端（兼容旧客户端）。
    if payload.scope != TOKEN_TYPE_CANDIDATE:
        account = (
            db.query(AdminAccount)
            .filter(AdminAccount.email == email, AdminAccount.delete_at.is_(None))
            .first()
        )
        if account is not None:
            account_type = TOKEN_TYPE_ADMIN
    if account is None and payload.scope != TOKEN_TYPE_ADMIN:
        account = (
            db.query(CandidateAccount)
            .filter(CandidateAccount.email == email, CandidateAccount.delete_at.is_(None))
            .first()
        )
        account_type = TOKEN_TYPE_CANDIDATE

    if account is None or not verify_password(payload.password, account.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="邮箱或密码错误")
    if account.status == "DISABLED":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已被禁用")
    return AuthResponse(
        access_token=create_access_token(str(account.id), account_type),
        token_type="bearer",
        user=serialize_account(account),
    )


def me(user: Account = Depends(get_current_user)):
    return serialize_account(user)
