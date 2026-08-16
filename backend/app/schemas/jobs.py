"""Pydantic contracts for this business domain."""
from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field



class JobInput(BaseModel):
    title: str
    location: str
    description: str
    requirements: str
    category_code: Optional[str] = None
    job_type: Literal["INTERN", "SOCIAL", "CAMPUS"]
    headcount: int = Field(default=1, ge=0)
    salary_negotiable: bool = False
    salary_min_k: Optional[int] = None
    salary_max_k: Optional[int] = None
    department: str = ""
    experience_req: Optional[str] = None
    education_req: Optional[str] = None
    urgency: Literal["HIGH", "MEDIUM", "LOW"] = "MEDIUM"



class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    location: str
    description: str
    requirements: str
    category_code: Optional[str] = None
    category_name: Optional[str] = None
    job_type: str = Field(default="SOCIAL")
    status: str
    headcount: int = 1
    salary_negotiable: bool = False
    salary_min_k: Optional[int] = None
    salary_max_k: Optional[int] = None
    department: str = ""
    experience_req: Optional[str] = None
    education_req: Optional[str] = None
    urgency: str = "MEDIUM"
    created_by: Optional[UUID] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime



class JobWithStats(JobOut):
    """Job enriched with live application / pipeline counts for admin views."""

    applications_total: int = 0
    stage_counts: dict[str, int] = {}



class JobCategoryInput(BaseModel):
    code: str
    name: str
    parent_code: Optional[str] = None
    sort_order: int = 0
    owner_id: Optional[UUID] = None



class JobCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    name: str
    parent_code: Optional[str] = None
    sort_order: int
    owner_id: Optional[UUID] = None
    owner_name: Optional[str] = None
    owner_title: Optional[str] = None
    open_job_count: int = 0
    total_headcount: int = 0
    child_count: int = 0
    created_at: datetime
    updated_at: datetime
