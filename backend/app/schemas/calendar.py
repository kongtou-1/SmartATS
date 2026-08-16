"""Pydantic contracts for this business domain."""
from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field



class BusyBlockIn(BaseModel):
    interviewer_id: UUID
    title: str = "忙碌"
    starts_at: datetime
    ends_at: datetime
