"""Pydantic contracts for this business domain."""
from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field



class SourceChannelIn(BaseModel):
    code: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=128)
    enabled: bool = True
    sort_order: int = 0



class TagIn(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    color: str = "#2563eb"
    enabled: bool = True



class CandidateTagAssignIn(BaseModel):
    tag_id: UUID



class TalentIn(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    phone: str = ""
    contact_email: str = ""
    city: str = ""
    years_experience: int = Field(default=0, ge=0, le=80)
    source_channel_id: UUID | None = None
    owner_id: UUID | None = None
    skills: list[str] = []
    tag_ids: list[UUID] = []



class TalentMergeIn(BaseModel):
    source_candidate_id: UUID


class TalentReactivateIn(BaseModel):
    """Re-engage a parked talent by starting a fresh application for a job."""
    job_id: UUID
    note: str | None = None



class NoteIn(BaseModel):
    content: str = Field(min_length=1, max_length=10000)



class TalentOut(BaseModel):
    id: UUID
    user_id: UUID | None
    name: str
    phone: str
    contact_email: str
    city: str
    years_experience: int
    owner_id: UUID | None
    owner_name: str = ""
    source_channel_id: UUID | None
    source_name: str = ""
    skills: list[str] = []
    tags: list[dict] = []
    latest_application: dict | None = None
    # Talent pool (人才库) fields
    in_talent_pool: bool = False
    pool_entered_at: datetime | None = None
    pool_entered_from_stage: str | None = None
    pool_reject_reason: str | None = None
    pool_entered_by_id: UUID | None = None
    created_at: datetime
    updated_at: datetime



class PageOut(BaseModel):
    items: list[TalentOut]
    page: int
    page_size: int
    total: int


class SourceChannelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    name: str
    enabled: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    color: str
    enabled: bool
    created_at: datetime
    updated_at: datetime
