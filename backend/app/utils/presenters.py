"""Shared response assembly helpers (avoid duplicating join logic across routers)."""
from sqlalchemy.orm import Session

from .. import models
from ..schemas import (
    AdminApplicationDetailOut,
    AdminCandidateInfo,
    AdminStageHistoryOut,
    AgentResultOut,
    ApplicationOut,
    CandidateApplicationDetail,
    CandidateStageHistoryOut,
    InterviewDetailOut,
    InterviewFeedbackOut,
    InterviewOut,
    JobOut,
    ResumeOut,
)


_STAGE_ORDER = ["APPLIED", "SCREENING", "SCREENING_PASSED", "FIRST_INTERVIEW", "SECOND_INTERVIEW", "FINAL_REVIEW", "HIRED"]


def _history_action(from_stage: str | None, to_stage: str | None, *, is_first: bool) -> str:
    if from_stage is None and to_stage is not None:
        return "APPLY" if is_first else "RESUME"
    if from_stage is not None and to_stage is None:
        return "HOLD"
    if to_stage == "REJECTED":
        return "REJECT"
    if to_stage == "WITHDRAWN":
        return "WITHDRAW"
    if from_stage in _STAGE_ORDER and to_stage in _STAGE_ORDER:
        return "ADVANCE" if _STAGE_ORDER.index(to_stage) > _STAGE_ORDER.index(from_stage) else "RETURN"
    return "TRANSITION"


def _stage_history(db: Session, application_id, *, admin: bool):
    rows = (
        db.query(models.ApplicationStageHistory)
        .filter_by(application_id=application_id)
        .order_by(models.ApplicationStageHistory.created_at.asc())
        .all()
    )
    output = []
    for index, row in enumerate(rows):
        common = dict(
            id=row.id,
            from_stage=row.from_stage,
            to_stage=row.to_stage,
            action=_history_action(row.from_stage, row.to_stage, is_first=index == 0),
            created_at=row.created_at,
        )
        if admin:
            output.append(
                AdminStageHistoryOut(
                    **common,
                    reason=row.reason or "",
                    changed_by=row.changed_by,
                    changed_by_name=_actor_name(db, row.changed_by),
                )
            )
        else:
            output.append(CandidateStageHistoryOut(**common))
    return output


def _actor_name(db: Session, actor_id) -> str:
    """Resolve a display name for a polymorphic actor id.

    `ApplicationStageHistory.changed_by` may reference either account table (a
    candidate can withdraw their own application), so try both before falling back.
    """
    if not actor_id:
        return "系统"
    actor = db.get(models.AdminAccount, actor_id) or db.get(models.CandidateAccount, actor_id)
    return actor.name if actor else "系统"


def _user_email(db: Session, user_id) -> str:
    """C-end account email for a candidate profile's `user_id`."""
    user = db.get(models.CandidateAccount, user_id) if user_id else None
    return user.email if user else ""


def build_interview_detail(db: Session, interview: models.Interview) -> InterviewDetailOut:
    app = db.get(models.Application, interview.application_id)
    candidate = db.get(models.Candidate, app.candidate_id) if app else None
    job = db.get(models.Job, app.job_id) if app else None
    interviewer = db.get(models.AdminAccount, interview.interviewer_id)
    feedback = (
        db.query(models.InterviewFeedback).filter_by(interview_id=interview.id).first()
    )
    out = InterviewDetailOut.model_validate(interview)
    out.candidate_name = candidate.name if candidate else ""
    out.job_title = job.title if job else ""
    out.interviewer_name = interviewer.name if interviewer else ""
    out.feedback = InterviewFeedbackOut.model_validate(feedback) if feedback else None
    return out


def build_admin_application_detail(db: Session, app: models.Application) -> AdminApplicationDetailOut:
    candidate = db.get(models.Candidate, app.candidate_id)
    job = db.get(models.Job, app.job_id)
    resume = db.get(models.Resume, app.resume_id)
    agent = db.query(models.AgentResult).filter_by(application_id=app.id).first()
    interviews = (
        db.query(models.Interview).filter_by(application_id=app.id).all()
    )
    candidate_email = _user_email(db, candidate.user_id) if candidate else ""
    return AdminApplicationDetailOut(
        id=str(app.id),
        candidate_id=str(app.candidate_id),
        job_id=str(app.job_id),
        resume_id=str(app.resume_id),
        current_stage=app.current_stage,
        status=app.status,
        ai_score=app.ai_score,
        applied_at=app.applied_at,
        candidate=AdminCandidateInfo(
            name=candidate.name if candidate else "",
            email=candidate_email,
            phone=candidate.phone if candidate else "",
            city=candidate.city if candidate else "",
        ),
        job=JobOut.model_validate(job) if job else None,
        resume=ResumeOut.model_validate(resume) if resume else None,
        agent_result=AgentResultOut.model_validate(agent) if agent else None,
        interviews=[build_interview_detail(db, i) for i in interviews],
        stage_history=_stage_history(db, app.id, admin=True),
        candidate_profile_snapshot=app.candidate_profile_snapshot,
        job_type_snapshot=app.job_type_snapshot,
    )


def build_candidate_application_detail(db: Session, app: models.Application) -> CandidateApplicationDetail:
    job = db.get(models.Job, app.job_id)
    agent = db.query(models.AgentResult).filter_by(application_id=app.id).first()
    interviews = db.query(models.Interview).filter_by(application_id=app.id).all()
    interview_outs = []
    for i in interviews:
        o = InterviewOut.model_validate(i)
        interviewer = db.get(models.AdminAccount, i.interviewer_id)
        o.interviewer_name = interviewer.name if interviewer else ""
        interview_outs.append(o)
    return CandidateApplicationDetail(
        id=str(app.id),
        candidate_id=str(app.candidate_id),
        job_id=str(app.job_id),
        resume_id=str(app.resume_id),
        current_stage=app.current_stage,
        status=app.status,
        applied_at=app.applied_at,
        job=JobOut.model_validate(job) if job else None,
        interviews=interview_outs,
        stage_history=_stage_history(db, app.id, admin=False),
    )


def build_application_out(db: Session, app: models.Application) -> ApplicationOut:
    job = db.get(models.Job, app.job_id)
    out = ApplicationOut.model_validate(app)
    out.job = JobOut.model_validate(job) if job else None
    out.stage_history = _stage_history(db, app.id, admin=False)
    return out
