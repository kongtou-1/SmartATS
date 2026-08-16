"""Account + candidate profile models.

Accounts are split into two isolated tables:
  - `candidate_accounts` : C-end (job-seeker) accounts
  - `admin_accounts`     : management-end accounts (HR / interviewer / super admin / direction owner)

Both carry a `delete_at` soft-delete column (NULL = active).
"""
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, Integer, String, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from ..services.database import Base
from ..core.security import new_uuid
from .base import SoftDeleteMixin, TimestampMixin


def _active_email_index(table_name: str) -> Index:
    """Email is unique only among *live* rows.

    Soft-deleting an account releases its email so a new account can reuse it,
    which keeps the DB constraint consistent with the service layer (every
    lookup filters `delete_at IS NULL`). A plain unique index would keep the
    address reserved forever and surface as a 500 on insert.
    """
    return Index(
        f"uq_{table_name}_email_active",
        "email",
        unique=True,
        postgresql_where=text("delete_at IS NULL"),
        sqlite_where=text("delete_at IS NULL"),
    )


class CandidateAccount(Base, TimestampMixin, SoftDeleteMixin):
    """C-end (job-seeker) account."""

    __tablename__ = "candidate_accounts"
    __table_args__ = (_active_email_index("candidate_accounts"),)

    ACCOUNT_TYPE = "candidate"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(128), default="")
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")  # ACTIVE | DISABLED

    @property
    def account_type(self) -> str:
        return self.ACCOUNT_TYPE


class AdminAccount(Base, TimestampMixin, SoftDeleteMixin):
    """Management-end account (HR / INTERVIEWER / SUPER_ADMIN / DIRECTION_OWNER)."""

    __tablename__ = "admin_accounts"
    __table_args__ = (_active_email_index("admin_accounts"),)

    ACCOUNT_TYPE = "admin"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(128), default="")
    title: Mapped[str] = mapped_column(String(128), default="")
    role: Mapped[str] = mapped_column(String(32), default="HR")
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")  # ACTIVE | DISABLED

    @property
    def account_type(self) -> str:
        return self.ACCOUNT_TYPE


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("candidate_accounts.id"), unique=True, index=True, nullable=True
    )
    name: Mapped[str] = mapped_column(String(128), default="")
    phone: Mapped[str] = mapped_column(String(64), default="")
    normalized_phone: Mapped[str] = mapped_column(String(64), default="", index=True)
    contact_email: Mapped[str] = mapped_column(String(255), default="")
    normalized_email: Mapped[str] = mapped_column(String(255), default="", index=True)
    city: Mapped[str] = mapped_column(String(128), default="")
    identity_type: Mapped[str] = mapped_column(String(32), default="")
    identity_number_encrypted: Mapped[str] = mapped_column(Text, default="")
    identity_number_last4: Mapped[str] = mapped_column(String(4), default="")
    preferred_locations: Mapped[list] = mapped_column(JSON, default=list)
    education: Mapped[list] = mapped_column(JSON, default=list)
    internships: Mapped[list] = mapped_column(JSON, default=list)
    work_experiences: Mapped[list] = mapped_column(JSON, default=list)
    projects: Mapped[list] = mapped_column(JSON, default=list)
    languages: Mapped[list] = mapped_column(JSON, default=list)
    certificates: Mapped[list] = mapped_column(JSON, default=list)
    self_evaluation: Mapped[str] = mapped_column(Text, default="")
    profile_version: Mapped[int] = mapped_column(Integer, default=0)
    profile_saved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    years_experience: Mapped[int] = mapped_column(Integer, default=0)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("admin_accounts.id"), nullable=True, index=True
    )
    source_channel_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("source_channels.id"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # --- Talent pool (人才库) fields ---
    # Soft delete: NULL = active. "移出人才库" sets this; recoverable via restore.
    delete_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    # True when the candidate was rejected at some stage and is currently parked
    # in the talent pool (has no ACTIVE/ON_HOLD/HIRED application).
    in_talent_pool: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    pool_entered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Stage at which the candidate was rejected (SCREENING/FIRST_INTERVIEW/...).
    pool_entered_from_stage: Mapped[str | None] = mapped_column(String(32), nullable=True)
    pool_reject_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    pool_entered_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("admin_accounts.id"), nullable=True, index=True
    )


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidates.id"), index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(512))
    parse_status: Mapped[str] = mapped_column(String(32), default="PENDING")
    parsed_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
