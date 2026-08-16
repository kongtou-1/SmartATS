"""Pydantic contracts for this business domain."""
from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field



class OfferIn(BaseModel):
    application_id: UUID
    salary_description: str = Field(min_length=1, max_length=4000)
    work_location: str = Field(min_length=1, max_length=255)
    expected_start_date: datetime
    expires_at: datetime
    probation: str = ""
    extra_terms: str = ""



class OfferDecisionIn(BaseModel):
    comment: str = ""



class OfferResponseIn(BaseModel):
    decision: Literal["ACCEPT", "DECLINE"]
    reason: str = ""



class OfferOut(BaseModel):
    id: UUID
    application_id: UUID
    candidate_id: UUID
    job_id: UUID
    status: str
    salary_description: str
    work_location: str
    expected_start_date: datetime
    expires_at: datetime
    probation: str
    extra_terms: str
    current_version: int
    candidate_name: str = ""
    job_title: str = ""
    created_by: UUID
    approved_by: UUID | None
    created_at: datetime
    updated_at: datetime
