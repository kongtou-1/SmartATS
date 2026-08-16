"""Email sender for the MVP.

Per the agreed plan, email is NOT sent via real SMTP. Each message is logged to
the backend log and persisted to the `email_logs` table so it can be inspected.
Swap this module for a real SMTP sender later without changing callers.
"""
import logging

from sqlalchemy.orm import Session

from ... import models

logger = logging.getLogger("hr.email")

# Email kinds (md §11). Email is simulated (log + persisted), never sent via SMTP.
KIND_APPLICATION_RECEIVED = "APPLICATION_RECEIVED"
KIND_INTERVIEW_INVITE = "INTERVIEW_INVITE"
KIND_INTERVIEW_CANCEL = "INTERVIEW_CANCEL"
KIND_FINAL_RESULT = "FINAL_RESULT"


def _fmt_time(value) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    try:
        return value.strftime("%Y-%m-%d %H:%M")
    except Exception:
        return str(value)


def interview_cancel_template(job_title: str, scheduled_at) -> tuple[str, str]:
    return (
        f"面试取消通知 - {job_title}",
        f"您好，原定于 {_fmt_time(scheduled_at)} 的「{job_title}」面试已取消。"
        "如后续需要重新安排，我们会另行通知，感谢您的理解。",
    )


def final_result_template(job_title: str, hired: bool) -> tuple[str, str]:
    if hired:
        return (
            f"录用通知 - {job_title}",
            f"恭喜！您应聘的「{job_title}」岗位已通过全部评估流程，我们将尽快与您联系后续入职事宜。",
        )
    return (
        f"应聘结果通知 - {job_title}",
        f"感谢您应聘「{job_title}」。很遗憾本次未能进入下一环节，"
        "期待未来有更合适的机会与您合作。",
    )


def send_email(db: Session, to_email: str, subject: str, body: str, kind: str) -> None:
    logger.info("[EMAIL:%s] to=%s subject=%s\n%s", kind, to_email, subject, body)
    db.add(models.EmailLog(kind=kind, to_email=to_email, subject=subject, body=body))
    db.commit()

