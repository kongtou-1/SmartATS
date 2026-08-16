"""Pydantic contracts for this business domain."""
from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field



class NotificationOut(BaseModel):
    id: UUID
    kind: str
    title: str
    body: str
    link: str
    read_at: datetime | None
    created_at: datetime
