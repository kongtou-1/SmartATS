"""Shared SQLAlchemy mixins for timestamp and soft-delete columns."""
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column


class TimestampMixin:
    """Adds created_at / updated_at columns (UTC, server-side defaults)."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SoftDeleteMixin:
    """Adds a nullable delete_at column for soft deletion.

    NULL  -> active
    NOT NULL -> logically deleted (treated as gone by all queries / auth).
    """

    delete_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
