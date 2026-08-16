"""Pydantic contracts for this business domain."""
from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field



class AnnouncementInput(BaseModel):
    type: str = "NOTICE"  # NOTICE | DYNAMIC | FLOW_ISSUE
    title: str
    content: str = ""
    pinned: bool = False



class AnnouncementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: str
    title: str
    content: str
    status: str
    pinned: bool
    published_at: Optional[datetime] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
