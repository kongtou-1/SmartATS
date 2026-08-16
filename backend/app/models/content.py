"""Domain SQLAlchemy models."""
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, Uuid, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from ..services.database import Base
from ..core.security import new_uuid



class EmailLog(Base):
    """Extension table: every "sent" email is persisted (MVP does not use real SMTP)."""

    __tablename__ = "email_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    kind: Mapped[str] = mapped_column(String(64))  # APPLICATION_RECEIVED | INTERVIEW_INVITE | INTERVIEW_CANCEL | FINAL_RESULT
    to_email: Mapped[str] = mapped_column(String(255))
    subject: Mapped[str] = mapped_column(String(512))
    body: Mapped[str] = mapped_column(Text, default="")
    delivery_status: Mapped[str] = mapped_column(String(32), default="SIMULATED")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())



class JobCategory(Base):
    """Configurable job direction / category (e.g. 研发/运营/产品/市场/职能).

    Supports a one/two-level hierarchy via `parent_code` (a string reference to
    another category's `code`, NOT a FK, to keep deletion/renaming simple).
    """

    __tablename__ = "job_categories"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(128))
    parent_code: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("admin_accounts.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )



class Announcement(Base):
    """Recruitment dynamics / announcements (incl. flow issues 流程问题).

    Mirrors the Job status machine: DRAFT -> PUBLISHED -> CLOSED.
    `type` distinguishes NOTICE / DYNAMIC / FLOW_ISSUE.
    """

    __tablename__ = "announcements"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    type: Mapped[str] = mapped_column(String(32), default="NOTICE", index=True)  # NOTICE|DYNAMIC|FLOW_ISSUE
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="DRAFT")  # DRAFT|PUBLISHED|CLOSED
    pinned: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("admin_accounts.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
