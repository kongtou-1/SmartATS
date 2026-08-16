"""Admin dashboard aggregate endpoint."""
from datetime import datetime, time, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ...core.permissions import require_roles
from ...models import Application, Interview, Job, Offer, AdminAccount
from ...schemas.dashboard import (
    DashboardInterviewItem,
    DashboardStats,
    DashboardSummaryOut,
    DashboardUrgentJobItem,
)
from ...services.database import get_db
from ...utils.presenters import build_interview_detail

admin_router = APIRouter(prefix='/api/v1/admin/dashboard', tags=['admin-dashboard'])

_ROUND_LABELS = {
    "FIRST": "专业初试",
    "SECOND": "技术复试",
    "HR": "HR终面",
}


def _today_window():
    """Return start/end of the current calendar day in UTC.

    Uses the server's local timezone so "today" matches what HR sees in the UI.
    """
    local_tz = datetime.now().astimezone().tzinfo
    today = datetime.now(local_tz).date()
    start = datetime.combine(today, time.min, tzinfo=local_tz).astimezone(timezone.utc)
    end = datetime.combine(today, time.max, tzinfo=local_tz).astimezone(timezone.utc)
    return start, end


def _greeting(hour: int) -> str:
    if hour < 12:
        return "早上好"
    if hour < 14:
        return "中午好"
    if hour < 19:
        return "下午好"
    return "晚上好"


def _format_salary(job: Job) -> str:
    if job.salary_negotiable:
        return "面议"
    if job.salary_min_k is None and job.salary_max_k is None:
        return "—"
    if job.salary_min_k is None:
        return f"{job.salary_max_k}k"
    if job.salary_max_k is None:
        return f"{job.salary_min_k}k"
    return f"{job.salary_min_k}k-{job.salary_max_k}k"


def _format_time_range(scheduled_at: datetime, duration_minutes: int) -> str:
    from datetime import timedelta

    start = scheduled_at
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    local_tz = datetime.now().astimezone().tzinfo
    local_start = start.astimezone(local_tz)
    local_end = local_start + timedelta(minutes=duration_minutes)
    return f"{local_start.strftime('%H:%M')} - {local_end.strftime('%H:%M')}"


@admin_router.get('/summary', response_model=DashboardSummaryOut)
def dashboard_summary(
    user: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR", "INTERVIEWER")),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    local_hour = datetime.now().astimezone().hour
    start_utc, end_utc = _today_window()
    is_interviewer = user.role == "INTERVIEWER"

    # 1. 待处理简历：处于初筛/筛选阶段且未结束的申请
    pending_resume_count = (
        db.query(Application)
        .filter(
            Application.status == "ACTIVE",
            Application.current_stage.in_(["APPLIED", "SCREENING"]),
        )
        .count()
    )

    # 2. 今日待面试（面试官视角仅看指派给自己的面试）
    today_interviews_q = db.query(Interview).filter(
        Interview.status == "SCHEDULED",
        Interview.scheduled_at >= start_utc,
        Interview.scheduled_at <= end_utc,
    )
    if is_interviewer:
        today_interviews_q = today_interviews_q.filter(Interview.interviewer_id == user.id)
    today_interviews = today_interviews_q.order_by(Interview.scheduled_at.asc()).all()

    # 3. 已发 Offer 跟踪：已发送且候选人未回应
    pending_offer_count = (
        db.query(Offer)
        .filter(
            Offer.status == "SENT",
            Offer.responded_at.is_(None),
            Offer.expires_at > now,
        )
        .count()
    )

    # 4. 在招职位 & HC
    active_jobs = db.query(Job).filter(Job.status == "PUBLISHED").all()
    active_job_count = len(active_jobs)
    open_headcount = sum((j.headcount or 1) for j in active_jobs)

    # 5. 急聘职位：发布中且 urgency=HIGH，按投递量降序
    urgent_jobs_query = (
        db.query(Job)
        .filter(Job.status == "PUBLISHED", Job.urgency == "HIGH")
        .order_by(Job.published_at.desc())
        .limit(5)
        .all()
    )

    # application totals for urgent jobs
    job_ids = [j.id for j in urgent_jobs_query]
    totals = {
        job_id: count
        for job_id, count in (
            db.query(Application.job_id, func.count())
            .filter(Application.job_id.in_(job_ids))
            .group_by(Application.job_id)
            .all()
        )
    }

    interview_items = []
    for iv in today_interviews:
        detail = build_interview_detail(db, iv)
        interview_items.append(
            DashboardInterviewItem(
                id=iv.id,
                application_id=iv.application_id,
                candidate_name=detail.candidate_name,
                job_title=detail.job_title,
                interviewer_name=detail.interviewer_name,
                round_type=iv.round_type,
                round_label=_ROUND_LABELS.get(iv.round_type, iv.round_type),
                scheduled_at=iv.scheduled_at,
                duration_minutes=iv.duration_minutes,
                time_range=_format_time_range(iv.scheduled_at, iv.duration_minutes),
                method=iv.method or "线上",
                meeting_url=iv.meeting_url or "",
            )
        )

    urgent_job_items = [
        DashboardUrgentJobItem(
            id=j.id,
            title=j.title,
            department=j.department or "",
            salary_min_k=j.salary_min_k,
            salary_max_k=j.salary_max_k,
            salary_negotiable=j.salary_negotiable,
            salary_text=_format_salary(j),
            headcount=j.headcount or 1,
            applications_total=totals.get(j.id, 0),
        )
        for j in urgent_jobs_query
    ]

    # 顶部欢迎文案
    weekday_labels = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
    local_now = datetime.now().astimezone()
    today_text = (
        f"{local_now.strftime('%Y年%m月%d日')} {weekday_labels[local_now.weekday()]}"
    )
    if is_interviewer:
        status_text = (
            f"今日共有 {len(today_interviews)} 场面试等待您的评估，加油！"
        )
    else:
        status_text = (
            f"今日共有 {len(today_interviews)} 场面试待开展、"
            f"{pending_resume_count} 份新投递简历待初筛，"
            f"目前全公司共有 {active_job_count} 个在招职位（{open_headcount} HC）正在推进。"
        )

    return DashboardSummaryOut(
        greeting=f"{_greeting(local_hour)}，",
        today_text=today_text,
        recruiting_status=status_text,
        stats=DashboardStats(
            pending_resume_count=pending_resume_count,
            today_interview_count=len(today_interviews),
            pending_offer_count=pending_offer_count,
            active_job_count=active_job_count,
            open_headcount=open_headcount,
        ),
        interviews=interview_items,
        urgent_jobs=urgent_job_items,
    )
