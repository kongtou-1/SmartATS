"""Domain SQLAlchemy models."""
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, Uuid, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from ..services.database import Base
from ..core.security import new_uuid



class DataJob(Base):
    __tablename__ = "data_jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    kind: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="PENDING")
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("admin_accounts.id"), index=True)
    input_key: Mapped[str] = mapped_column(String(512), default="")
    output_key: Mapped[str] = mapped_column(String(512), default="")
    summary: Mapped[dict] = mapped_column(JSON, default=dict)
    error_message: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())



class CalendarBusyBlock(Base):
    __tablename__ = "calendar_busy_blocks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    interviewer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("admin_accounts.id"), index=True)
    source: Mapped[str] = mapped_column(String(32), default="MANUAL")
    external_uid: Mapped[str] = mapped_column(String(255), default="")
    title: Mapped[str] = mapped_column(String(255), default="忙碌")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("admin_accounts.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())



class CalendarSubscription(Base):
    __tablename__ = "calendar_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("admin_accounts.id"), unique=True, index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())



class Offer(Base):
    __tablename__ = "offers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    application_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("applications.id"), index=True)
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidates.id"), index=True)
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jobs.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="DRAFT", index=True)
    salary_description: Mapped[str] = mapped_column(Text)
    work_location: Mapped[str] = mapped_column(String(255))
    expected_start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    probation: Mapped[str] = mapped_column(String(255), default="")
    extra_terms: Mapped[str] = mapped_column(Text, default="")
    current_version: Mapped[int] = mapped_column(Integer, default=0)
    response_token_hash: Mapped[str] = mapped_column(String(128), default="", index=True)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    response_reason: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("admin_accounts.id"))
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("admin_accounts.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())



class OfferApproval(Base):
    __tablename__ = "offer_approvals"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    offer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("offers.id"), index=True)
    approver_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("admin_accounts.id"), index=True)
    decision: Mapped[str] = mapped_column(String(32))
    comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())



class OfferVersion(Base):
    __tablename__ = "offer_versions"
    __table_args__ = (UniqueConstraint("offer_id", "version", name="uq_offer_version"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    offer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("offers.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    pdf_storage_key: Mapped[str] = mapped_column(String(512), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
