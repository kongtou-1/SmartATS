"""Pydantic contracts for this business domain."""
from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .jobs import JobOut



class EducationItem(BaseModel):
    school: str = ""
    degree: str = ""
    major: str = ""
    start: str = ""
    end: str = ""



class WorkItem(BaseModel):
    company: str = ""
    title: str = ""
    start: str = ""
    end: str = ""
    description: str = ""



class ProjectItem(BaseModel):
    name: str = ""
    role: str = ""
    description: str = ""



class ResumeParsedData(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    education: List[EducationItem] = []
    work_experience: List[WorkItem] = []
    projects: List[ProjectItem] = []
    skills: List[str] = []



class ResumeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    candidate_id: UUID
    file_name: str
    storage_key: str
    parse_status: str
    parsed_data: Optional[ResumeParsedData] = None
    created_at: datetime
    updated_at: datetime



class AgentResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    application_id: UUID
    score: float
    summary: str
    strengths: List[str] = []
    gaps: List[str] = []
    recommendation: str
    status: str



class ApplicationCreateIn(BaseModel):
    job_id: UUID
    resume_id: UUID



class StageTransitionIn(BaseModel):
    target_stage: Literal[
        "APPLIED",
        "SCREENING",
        "SCREENING_PASSED",
        "FIRST_INTERVIEW",
        "SECOND_INTERVIEW",
        "FINAL_REVIEW",
        "HIRED",
    ]
    reason: str = Field(min_length=1, max_length=1000)



class StageReasonIn(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)



class CandidateStageHistoryOut(BaseModel):
    id: UUID
    from_stage: Optional[str] = None
    to_stage: Optional[str] = None
    action: str
    created_at: datetime



class AdminStageHistoryOut(CandidateStageHistoryOut):
    reason: str
    changed_by: Optional[UUID] = None
    changed_by_name: str = ""



class ApplicationOut(BaseModel):
    """Candidate-facing application summary. Per MVP §4.5 candidates must NOT
    see AI scores / internal notes, so ai_score and agent_result are omitted."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    candidate_id: UUID
    job_id: UUID
    resume_id: UUID
    current_stage: str
    status: str
    applied_at: datetime
    job: Optional[JobOut] = None
    stage_history: List[CandidateStageHistoryOut] = []



class CandidateApplicationDetail(BaseModel):
    """Application merged with its interviews (candidate GET /applications/{id}).

    Per MVP §4.5 the candidate view intentionally excludes ai_score and
    agent_result (no AI score / internal notes leak to the candidate).
    """

    id: UUID
    candidate_id: UUID
    job_id: UUID
    resume_id: UUID
    current_stage: str
    status: str
    applied_at: datetime
    job: Optional[JobOut] = None
    interviews: List["InterviewOut"] = []
    stage_history: List[CandidateStageHistoryOut] = []



class InterviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    application_id: UUID
    interviewer_id: UUID
    round_type: str
    scheduled_at: datetime
    duration_minutes: int
    method: str
    meeting_url: str
    status: str
    note: str
    interviewer_name: Optional[str] = None
    candidate_name: Optional[str] = None
    job_title: Optional[str] = None



class InterviewFeedbackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    interview_id: UUID
    interviewer_id: UUID
    professional_score: int
    project_score: int
    communication_score: int
    strengths: str
    weaknesses: str
    summary: str
    recommendation: str



class InterviewDetailOut(InterviewOut):
    candidate_name: str = ""
    job_title: str = ""
    interviewer_name: str = ""
    feedback: Optional[InterviewFeedbackOut] = None



class FeedbackInput(BaseModel):
    professional_score: int = Field(ge=1, le=5)
    project_score: int = Field(ge=1, le=5)
    communication_score: int = Field(ge=1, le=5)
    strengths: str
    weaknesses: str
    summary: str = Field(min_length=1, max_length=4000)
    recommendation: Literal["PASS", "HOLD", "FAIL"]


class FeedbackConfirmIn(BaseModel):
    """HR 确认面试官面评时的决策输入。

    mode:
      - ADOPT: 采纳面试官建议（PASS→推进 / FAIL→淘汰 / HOLD→暂缓）
      - ADVANCE: 自行决定推进到指定 target_stage
      - REJECT: 自行决定淘汰
      - HOLD: 自行决定暂缓
      - CONFIRM_ONLY: 仅确认面评，不改变候选人阶段
    """

    mode: Literal["ADOPT", "ADVANCE", "REJECT", "HOLD", "CONFIRM_ONLY"] = "ADOPT"
    target_stage: Optional[str] = None
    reason: str = Field(min_length=1, max_length=1000)



class InterviewInput(BaseModel):
    application_id: UUID
    interviewer_id: UUID
    round_type: Literal["FIRST", "SECOND", "HR"]
    scheduled_at: datetime
    duration_minutes: int = Field(default=60, ge=15, le=240)
    method: str = Field(min_length=1, max_length=128)
    meeting_url: str = ""
    note: str = ""



class AdminApplicationOut(BaseModel):
    """HR-facing application row. Enriched with light-weight snapshot fields
    (latest company / school / degree, top skills, next interview) so the
    kanban & matrix views can render rich candidate cards without an extra
    detail call per row."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    candidate_id: UUID
    job_id: UUID
    current_stage: str
    status: str
    ai_score: Optional[float] = None
    applied_at: datetime
    candidate_name: str = ""
    job_title: str = ""

    # Snapshot enrichments for kanban / matrix (best-effort, empty when missing)
    latest_company: str = ""
    latest_school: str = ""
    latest_degree: str = ""
    skills: List[str] = []
    next_interview_at: Optional[datetime] = None
    next_interview_round: str = ""
    next_interviewer_name: str = ""
    # 关联的 Offer 状态（若有）：用于前端标记「已发 Offer」并隐藏发 Offer 按钮、
    # 以及在 Offer 审批通过后从候选人看板移除。
    offer_status: Optional[str] = None



class AdminCandidateInfo(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    city: str = ""



class AdminApplicationDetailOut(BaseModel):
    id: UUID
    candidate_id: UUID
    job_id: UUID
    resume_id: UUID
    current_stage: str
    status: str
    ai_score: Optional[float] = None
    applied_at: datetime
    candidate: AdminCandidateInfo
    job: JobOut
    resume: Optional[ResumeOut] = None
    agent_result: Optional[AgentResultOut] = None
    interviews: List[InterviewDetailOut] = []
    stage_history: List[AdminStageHistoryOut] = []
    candidate_profile_snapshot: Optional[dict] = None
    job_type_snapshot: Optional[str] = None
