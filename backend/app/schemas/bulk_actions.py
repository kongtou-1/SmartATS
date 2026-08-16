"""Pydantic contracts for this business domain."""
from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field



class BulkActionIn(BaseModel):
    application_ids: list[UUID] = Field(min_length=1, max_length=500)
    action: Literal["ADVANCE", "REJECT", "NOTIFY"]
    target_stage: str | None = None
    reason: str = ""
    subject: str = ""
    body: str = ""
    idempotency_key: str = Field(min_length=8, max_length=128)
