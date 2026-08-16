"""Domain SQLAlchemy models."""
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, Uuid, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from ..services.database import Base
from ..core.security import new_uuid



class Interview(Base):
    __tablename__ = "interviews"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    application_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("applications.id"), index=True)
    interviewer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("admin_accounts.id"), index=True)
    round_type: Mapped[str] = mapped_column(String(32), default="FIRST")  # FIRST|SECOND|HR
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    method: Mapped[str] = mapped_column(String(128), default="")
    meeting_url: Mapped[str] = mapped_column(String(512), default="")
    status: Mapped[str] = mapped_column(String(32), default="SCHEDULED")  # SCHEDULED|COMPLETED|CANCELLED
    note: Mapped[str] = mapped_column(Text, default="")
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("admin_accounts.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )



class InterviewFeedback(Base):
    __tablename__ = "interview_feedbacks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    interview_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("interviews.id"), unique=True, index=True
    )
    interviewer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("admin_accounts.id"))
    professional_score: Mapped[int] = mapped_column(Integer, default=0)
    project_score: Mapped[int] = mapped_column(Integer, default=0)
    communication_score: Mapped[int] = mapped_column(Integer, default=0)
    strengths: Mapped[str] = mapped_column(Text, default="")
    weaknesses: Mapped[str] = mapped_column(Text, default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    recommendation: Mapped[str] = mapped_column(String(32), default="HOLD")  # PASS|HOLD|FAIL
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
