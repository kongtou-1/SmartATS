"""Dashboard aggregate response contracts."""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DashboardInterviewItem(BaseModel):
    id: UUID
    application_id: UUID
    candidate_name: str = ""
    job_title: str = ""
    interviewer_name: str = ""
    round_type: str
    round_label: str = ""
    scheduled_at: datetime
    duration_minutes: int
    time_range: str = ""
    method: str = ""
    meeting_url: str = ""


class DashboardUrgentJobItem(BaseModel):
    id: UUID
    title: str
    department: str = ""
    salary_min_k: Optional[int] = None
    salary_max_k: Optional[int] = None
    salary_negotiable: bool = False
    salary_text: str = ""
    headcount: int = 1
    applications_total: int = 0


class DashboardStats(BaseModel):
    pending_resume_count: int = 0
    today_interview_count: int = 0
    pending_offer_count: int = 0
    active_job_count: int = 0
    open_headcount: int = 0


class DashboardSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    greeting: str = ""
    today_text: str = ""
    recruiting_status: str = "招聘进行中"
    stats: DashboardStats
    interviews: List[DashboardInterviewItem]
    urgent_jobs: List[DashboardUrgentJobItem]
