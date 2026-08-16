"""Periodic task: send in-app reminders ~15 minutes before an interview starts.

Recipients (de-duplicated by (account_id, user_type)):
  - HR:        the application owner (applications.owner_id, role HR, ACTIVE)
  - Interviewer: interviews.interviewer_id (ACTIVE)
  - 招聘主管:   all admin accounts with role DIRECTION_OWNER (ACTIVE)
  - admin:     all admin accounts with role SUPER_ADMIN (ACTIVE)
  - Candidate: the candidate's linked C-end account (candidates.user_id)

Accounts live in two isolated tables, so each recipient is tagged with the
Notification.user_type ("ADMIN" / "CANDIDATE") it belongs to.

Idempotency is guaranteed by the `reminder_sent` flag on the Interview row.
"""
from datetime import datetime, timedelta, timezone

from .. import models
from ..services.database import SessionLocal
from .celery_app import celery_app

# Shanghai is UTC+8 with no DST; fixed offset is sufficient for display.
_TZ_SH = timezone(timedelta(hours=8))


def _active_admins(db):
    return db.query(models.AdminAccount).filter(models.AdminAccount.delete_at.is_(None))


def _resolve_recipient_ids(db, interview: "models.Interview") -> set:
    """Return the de-duplicated set of (account_id, user_type) pairs to remind."""
    ids: set = set()
    application = db.get(models.Application, interview.application_id)
    if application is None:
        return ids

    # 1) HR — the application owner
    if application.owner_id is not None:
        owner = db.get(models.AdminAccount, application.owner_id)
        if owner is not None and owner.delete_at is None and owner.role == "HR" and owner.status == "ACTIVE":
            ids.add((owner.id, "ADMIN"))

    # 2) Interviewer
    interviewer = db.get(models.AdminAccount, interview.interviewer_id)
    if interviewer is not None and interviewer.delete_at is None and interviewer.status == "ACTIVE":
        ids.add((interviewer.id, "ADMIN"))

    # 3) Recruiting managers — all DIRECTION_OWNER
    for u in _active_admins(db).filter_by(role="DIRECTION_OWNER", status="ACTIVE"):
        ids.add((u.id, "ADMIN"))

    # 4) Admins — all SUPER_ADMIN
    for u in _active_admins(db).filter_by(role="SUPER_ADMIN", status="ACTIVE"):
        ids.add((u.id, "ADMIN"))

    # 5) Candidate — C-end account
    candidate = db.get(models.Candidate, application.candidate_id)
    if candidate is not None and candidate.user_id is not None:
        ids.add((candidate.user_id, "CANDIDATE"))

    return ids


@celery_app.task(name="interviews.send_reminders")
def send_interview_reminders():
    now = datetime.now(timezone.utc)
    # Fire as soon as an interview is <= 15 minutes away.
    window = now + timedelta(minutes=15)
    # Grace window: if beat was down, still deliver a late reminder once
    # (but ignore interviews that started more than 30 minutes ago).
    floor = now - timedelta(minutes=30)

    with SessionLocal() as db:
        due = (
            db.query(models.Interview)
            .filter(
                models.Interview.status == "SCHEDULED",
                models.Interview.reminder_sent.is_(False),
                models.Interview.scheduled_at <= window,
                models.Interview.scheduled_at >= floor,
            )
            .all()
        )
        count = 0
        for iv in due:
            application = db.get(models.Application, iv.application_id)
            job = db.get(models.Job, application.job_id) if application else None
            job_title = job.title if job else ""
            when = (
                iv.scheduled_at.astimezone(_TZ_SH).strftime("%Y-%m-%d %H:%M")
                if iv.scheduled_at
                else ""
            )
            for uid, user_type in _resolve_recipient_ids(db, iv):
                db.add(
                    models.Notification(
                        user_id=uid,
                        user_type=user_type,
                        kind="INTERVIEW_REMINDER",
                        title=f"面试提醒：{job_title}",
                        body=f"将于 {when} 开始（{iv.method or '待定'}），请提前准备。",
                        link=f"/interviews/{iv.id}",
                    )
                )
            iv.reminder_sent = True
            count += 1
        db.commit()
        return count
