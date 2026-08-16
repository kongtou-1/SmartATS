"""Async email sending.

Keeps the MVP behaviour (log + persist to email_logs, no real SMTP) but runs it
in the background so API requests return immediately.
"""
from __future__ import annotations

import logging

from ..services.database import SessionLocal
from ..services.email import sender as email_sender
from .celery_app import celery_app

logger = logging.getLogger("hr.workers.email")


@celery_app.task(name="send_email")
def send_email_task(to_email: str, subject: str, body: str, kind: str):
    db = SessionLocal()
    try:
        email_sender.send_email(db, to_email=to_email, subject=subject, body=body, kind=kind)
        logger.info("send_email(%s): queued %s -> %s", kind, to_email, subject)
    finally:
        db.close()
