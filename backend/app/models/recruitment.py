"""Domain SQLAlchemy models."""
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, Uuid, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column

from ..services.database import Base
from ..core.security import new_uuid



class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    title: Mapped[str] = mapped_column(String(255))
    location: Mapped[str] = mapped_column(String(128), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    requirements: Mapped[str] = mapped_column(Text, default="")
    category_code: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    job_type: Mapped[str] = mapped_column(String(32), default="SOCIAL", index=True)
    status: Mapped[str] = mapped_column(String(32), default="DRAFT")  # DRAFT|PUBLISHED|CLOSED
    headcount: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    salary_negotiable: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    salary_min_k: Mapped[int | None] = mapped_column(Integer, nullable=True)
    salary_max_k: Mapped[int | None] = mapped_column(Integer, nullable=True)
    department: Mapped[str] = mapped_column(String(128), default="", server_default="")
    experience_req: Mapped[str | None] = mapped_column(String(32), nullable=True)
    education_req: Mapped[str | None] = mapped_column(String(32), nullable=True)
    urgency: Mapped[str] = mapped_column(String(32), default="MEDIUM", server_default="MEDIUM")
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("admin_accounts.id"), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )



class Application(Base):
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidates.id"), index=True)
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jobs.id"), index=True)
    resume_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("resumes.id"), index=True)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("admin_accounts.id"), nullable=True, index=True)
    source_channel_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("source_channels.id"), nullable=True, index=True
    )
    source_code_snapshot: Mapped[str] = mapped_column(String(64), default="UNKNOWN")
    source_name_snapshot: Mapped[str] = mapped_column(String(128), default="未知")
    candidate_profile_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    job_type_snapshot: Mapped[str | None] = mapped_column(String(32), nullable=True)
    current_stage: Mapped[str] = mapped_column(String(32), default="APPLIED")
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")  # ACTIVE|ON_HOLD|HIRED|REJECTED|WITHDRAWN
    ai_score: Mapped[float | None] = mapped_column(nullable=True)
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )



class ApplicationStageHistory(Base):
    __tablename__ = "application_stage_history"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    application_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("applications.id"), index=True)
    from_stage: Mapped[str | None] = mapped_column(String(32), nullable=True)
    to_stage: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # Polymorphic: written by AdminAccount OR CandidateAccount, so no single-table FK.
    changed_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())



class AgentResult(Base):
    __tablename__ = "agent_results"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("applications.id"), unique=True, index=True
    )
    score: Mapped[float] = mapped_column(default=0.0)
    summary: Mapped[str] = mapped_column(Text, default="")
    strengths: Mapped[list] = mapped_column(JSON, default=list)
    gaps: Mapped[list] = mapped_column(JSON, default=list)
    recommendation: Mapped[str] = mapped_column(String(32), default="CONSIDER")
    raw_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="PENDING")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
