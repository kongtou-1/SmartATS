"""Interviews: HR/admin management + interviewer self-view and feedback."""
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ...core.permissions import get_current_user, require_roles
from ...core.audit import write_audit
from ..email import sender as email_sender
from ...workers.email_tasks import send_email_task
from ... import models
from ...models import AdminAccount, Application, Candidate, CandidateAccount, Interview, InterviewFeedback, Job
from ...utils.presenters import build_interview_detail
from ...schemas import (
    FeedbackInput,
    FeedbackConfirmIn,
    InterviewDetailOut,
    InterviewFeedbackOut,
    InterviewInput,
    InterviewOut,
)
from .applications import (
    STAGE_ORDER,
    _transition_application,
    _next_stage,
    _hold_application,
    _reject_application,
)



def _candidate_email_for_app(db: Session, app: Application) -> str:
    candidate = db.get(Candidate, app.candidate_id)
    if candidate is None:
        return ""
    user = db.get(CandidateAccount, candidate.user_id)
    return user.email if user else ""


_ROUND_STAGE = {
    "FIRST": "FIRST_INTERVIEW",
    "SECOND": "SECOND_INTERVIEW",
    "HR": "FINAL_REVIEW",
}

# Shanghai is UTC+8 with no DST; fixed offset is sufficient for display.
_TZ_SH = timezone(timedelta(hours=8))


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _validate_interview_input(
    db: Session,
    payload: InterviewInput,
    *,
    current: Interview | None = None,
) -> tuple[Application, AdminAccount]:
    app = db.get(Application, _as_uuid(payload.application_id))
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申请不存在")
    if app.status != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅进行中的申请可以安排面试")

    required_stage = _ROUND_STAGE[payload.round_type]
    if app.current_stage != required_stage:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"当前申请阶段为 {app.current_stage}，不能安排 {payload.round_type} 面试",
        )

    interviewer = db.get(AdminAccount, _as_uuid(payload.interviewer_id))
    if (
        interviewer is None
        or interviewer.delete_at is not None
        or interviewer.role != "INTERVIEWER"
        or interviewer.status != "ACTIVE"
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请选择有效且启用的面试官")

    start = _as_utc(payload.scheduled_at)
    if start <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="面试时间必须晚于当前时间")
    end = start + timedelta(minutes=payload.duration_minutes)

    scheduled = db.query(Interview).filter(Interview.status == "SCHEDULED").all()
    for other in scheduled:
        if current is not None and other.id == current.id:
            continue
        other_start = _as_utc(other.scheduled_at)
        other_end = other_start + timedelta(minutes=other.duration_minutes)
        if start < other_end and end > other_start:
            if other.interviewer_id == interviewer.id:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该面试官在所选时段已有面试")
            other_app = db.get(Application, other.application_id)
            if other_app is not None and other_app.candidate_id == app.candidate_id:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该候选人在所选时段已有面试")

    busy = (
        db.query(models.CalendarBusyBlock)
        .filter(
            models.CalendarBusyBlock.interviewer_id == interviewer.id,
            models.CalendarBusyBlock.starts_at < end,
            models.CalendarBusyBlock.ends_at > start,
        )
        .first()
    )
    if busy is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该面试官在所选时段忙碌")

    duplicate = (
        db.query(Interview)
        .filter_by(application_id=app.id, round_type=payload.round_type, status="SCHEDULED")
        .first()
    )
    if duplicate is not None and (current is None or duplicate.id != current.id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该申请已有同轮次的待进行面试")
    return app, interviewer


# ---------- Admin ----------
def create_interview(
    payload: InterviewInput,
    user: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
):
    app, interviewer = _validate_interview_input(db, payload)
    interview = Interview(
        application_id=app.id,
        interviewer_id=interviewer.id,
        round_type=payload.round_type,
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes,
        method=payload.method,
        meeting_url=payload.meeting_url,
        status="SCHEDULED",
        note=payload.note,
        created_by=user.id,
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)

    job = db.get(Job, app.job_id)
    candidate_email = _candidate_email_for_app(db, app)
    if candidate_email:
        subject = f"面试邀请 - {job.title if job else ''}"
        body = (
            f"您好，您投递的岗位「{job.title if job else ''}」已进入面试环节。\n"
            f"时间：{payload.scheduled_at}\n方式：{payload.method}\n"
            f"链接：{payload.meeting_url}\n备注：{payload.note}"
        )
        send_email_task.delay(candidate_email, subject, body, "INTERVIEW_INVITE")
    return build_interview_detail(db, interview)


def list_interviews(_: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    interviews = db.query(Interview).order_by(Interview.scheduled_at.desc()).all()
    return [build_interview_detail(db, i) for i in interviews]


def get_interview(interview_id: str, _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    interview = db.get(Interview, _as_uuid(interview_id))
    if interview is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="面试不存在")
    return build_interview_detail(db, interview)


def update_interview(interview_id: str, payload: InterviewInput, _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    interview = db.get(Interview, _as_uuid(interview_id))
    if interview is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="面试不存在")
    if interview.status != "SCHEDULED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅待进行的面试可以修改")
    if _as_uuid(payload.application_id) != interview.application_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不能修改面试所属申请")
    _, interviewer = _validate_interview_input(db, payload, current=interview)
    interview.interviewer_id = interviewer.id
    interview.round_type = payload.round_type
    interview.scheduled_at = payload.scheduled_at
    interview.duration_minutes = payload.duration_minutes
    interview.method = payload.method
    interview.meeting_url = payload.meeting_url
    interview.note = payload.note
    db.commit()
    return build_interview_detail(db, interview)


def cancel_interview(interview_id: str, _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    interview = db.get(Interview, _as_uuid(interview_id))
    if interview is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="面试不存在")
    if interview.status != "SCHEDULED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅可取消待进行的面试")
    interview.status = "CANCELLED"
    db.commit()

    app = db.get(Application, interview.application_id)
    job = db.get(Job, app.job_id) if app else None
    candidate_email = _candidate_email_for_app(db, app) if app else ""
    if candidate_email:
        subject, body = email_sender.interview_cancel_template(
            job.title if job else "", interview.scheduled_at
        )
        send_email_task.delay(candidate_email, subject, body, email_sender.KIND_INTERVIEW_CANCEL)
    return build_interview_detail(db, interview)


def remind_interviewer(
    interview_id: str,
    user: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
):
    """HR/管理员手动提醒面试官（催促其参加面试或提交面评）。

    与自动提醒(Celery beat 提前 15 分钟)复用同一 INTERVIEW_REMINDER 通知通道，
    仅向面试官本人推送 in-app 通知，不重复发送邮件。
    """
    interview = db.get(Interview, _as_uuid(interview_id))
    if interview is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="面试不存在")
    if interview.status not in ("SCHEDULED", "PENDING_HR_REVIEW"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="仅待进行或待确认面评的面试可提醒",
        )

    interviewer = db.get(AdminAccount, interview.interviewer_id)
    if (
        interviewer is None
        or interviewer.delete_at is not None
        or interviewer.status != "ACTIVE"
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="面试官无效或未启用")

    app = db.get(Application, interview.application_id)
    job = db.get(Job, app.job_id) if app else None
    job_title = job.title if job else ""
    when = (
        interview.scheduled_at.astimezone(_TZ_SH).strftime("%Y-%m-%d %H:%M")
        if interview.scheduled_at
        else ""
    )
    need_feedback = interview.status == "PENDING_HR_REVIEW"
    body = (
        f"HR 提醒：您负责的面试将于 {when} 开始（{interview.method or '待定'}），岗位：{job_title}。"
        + ("请尽快登录提交考官面评。" if need_feedback else "请提前做好准备。")
    )
    db.add(
        models.Notification(
            user_id=interviewer.id,
            user_type="ADMIN",
            kind="INTERVIEW_REMINDER",
            title=f"面试提醒：{job_title}",
            body=body,
            link=f"/interviews/{interview.id}",
        )
    )
    db.commit()
    return {"ok": True, "notified": [str(interviewer.id)], "need_feedback": need_feedback}


# ---------- Interviewer ----------
def my_interviews(user: AdminAccount = Depends(require_roles("INTERVIEWER")), db: Session = Depends(get_db)):
    interviews = (
        db.query(Interview)
        .filter_by(interviewer_id=user.id)
        .order_by(Interview.scheduled_at.desc())
        .all()
    )
    return [build_interview_detail(db, i) for i in interviews]


def my_interview(interview_id: str, user: AdminAccount = Depends(require_roles("INTERVIEWER")), db: Session = Depends(get_db)):
    interview = db.get(Interview, _as_uuid(interview_id))
    if interview is None or interview.interviewer_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="面试不存在")
    return build_interview_detail(db, interview)


def submit_feedback(interview_id: str, payload: FeedbackInput, user: AdminAccount = Depends(require_roles("INTERVIEWER")), db: Session = Depends(get_db)):
    interview = db.get(Interview, _as_uuid(interview_id))
    if interview is None or interview.interviewer_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="面试不存在")
    if interview.status == "COMPLETED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="面评已由 HR 确认，无法修改")
    if interview.status not in ("SCHEDULED", "PENDING_HR_REVIEW"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该面试当前不可填写面评")
    if _as_utc(interview.scheduled_at) > datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="面试开始前不能提交面评")
    feedback = db.query(InterviewFeedback).filter_by(interview_id=interview.id).first()
    if feedback is not None:
        # 面试官一旦提交即锁定，不可再修改（避免反复涂改评价）
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="面评已提交，不可修改")
    feedback = InterviewFeedback(interview_id=interview.id, interviewer_id=user.id)
    db.add(feedback)
    feedback.interviewer_id = user.id
    feedback.professional_score = payload.professional_score
    feedback.project_score = payload.project_score
    feedback.communication_score = payload.communication_score
    feedback.strengths = payload.strengths
    feedback.weaknesses = payload.weaknesses
    feedback.summary = payload.summary
    feedback.recommendation = payload.recommendation
    interview.status = "PENDING_HR_REVIEW"
    db.commit()
    db.refresh(feedback)
    return InterviewFeedbackOut.model_validate(feedback)


def confirm_feedback(
    interview_id: str,
    payload: FeedbackConfirmIn,
    user: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
) -> InterviewDetailOut:
    """HR/管理员确认面试官面评，并将面试官的「是否通过」建议落地为实际阶段决策。

    面试官提交面评后面试进入 PENDING_HR_REVIEW，其 recommendation 仅为参考；
    只有此处（或被门禁覆盖的通用阶段动作）能将决策真正作用于候选人阶段。
    """
    interview = db.get(Interview, _as_uuid(interview_id))
    if interview is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="面试不存在")
    if interview.status == "COMPLETED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该面评已由 HR 确认，无法重复确认")

    feedback = db.query(InterviewFeedback).filter_by(interview_id=interview.id).first()
    if feedback is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="面试尚未提交面评，无法确认")

    app = db.get(Application, interview.application_id)
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申请不存在")

    before_stage = app.current_stage
    before_status = app.status
    recommendation = feedback.recommendation
    mode = payload.mode
    reason = (payload.reason or "").strip()

    if mode == "ADOPT":
        if recommendation == "PASS":
            idx = STAGE_ORDER.index(app.current_stage)
            next_stage = STAGE_ORDER[idx + 1] if idx < len(STAGE_ORDER) - 1 else None
            if next_stage is None or next_stage == "HIRED":
                # 录用必须经候选人接受 Offer 完成，降级为仅确认
                mode = "CONFIRM_ONLY"
                reason = reason or "采纳面试官建议(PASS)，但录用需走 Offer 流程，仅确认面评"
            else:
                reason = reason or f"采纳面试官建议(PASS)：推进至{next_stage}"
                _next_stage(db, app, user, reason)
        elif recommendation == "FAIL":
            reason = reason or "采纳面试官建议(FAIL)：淘汰"
            _reject_application(db, app, user, reason)
        else:  # HOLD
            reason = reason or "采纳面试官建议(HOLD)：暂缓"
            _hold_application(db, app, user, reason)
    elif mode == "ADVANCE":
        if not payload.target_stage:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请选择目标阶段")
        reason = reason or f"HR 决策：推进至{payload.target_stage}"
        _transition_application(db, app, payload.target_stage, user, reason)
    elif mode == "REJECT":
        reason = reason or "HR 决策：淘汰"
        _reject_application(db, app, user, reason)
    elif mode == "HOLD":
        reason = reason or "HR 决策：暂缓"
        _hold_application(db, app, user, reason)
    # CONFIRM_ONLY: 仅确认面评，不改变候选人阶段

    interview.status = "COMPLETED"
    db.commit()

    write_audit(
        db,
        actor=user,
        action="HR_CONFIRM_FEEDBACK",
        entity_type="Interview",
        entity_id=str(interview.id),
        before={"interview_status": "PENDING_HR_REVIEW", "app_stage": before_stage, "app_status": before_status},
        after={"interview_status": "COMPLETED", "decision": mode, "recommendation": recommendation,
               "app_stage": app.current_stage, "app_status": app.status},
        commit=True,
    )
    db.refresh(interview)
    return build_interview_detail(db, interview)


def _as_uuid(value):
    import uuid

    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的 ID")

