"""Async resume parsing.

Reads the uploaded file from object storage, runs the resume parser, persists
the structured result, then triggers scoring for any active applications that
reference this resume.
"""
from __future__ import annotations

import logging
import uuid

from ..agents.base import get_parser
from ..services.database import SessionLocal
from ..models import Application, Resume
from ..storage import storage
from .celery_app import celery_app

logger = logging.getLogger("hr.workers.resume")


@celery_app.task(name="parse_resume", bind=True, max_retries=2, default_retry_delay=5)
def parse_resume_task(self, resume_id: str, candidate_name: str = ""):
    db = SessionLocal()
    try:
        resume = db.get(Resume, uuid.UUID(str(resume_id)))
        if resume is None:
            logger.warning("parse_resume: resume %s not found", resume_id)
            return

        raw = storage.read_file(resume.storage_key)
        parsed = get_parser().parse(raw, resume.file_name, candidate_name=candidate_name)

        resume.parsed_data = parsed
        resume.parse_status = "DONE"
        resume.error_message = None
        db.commit()
        logger.info("parse_resume: resume %s parsed OK", resume_id)

        # Re-score any active applications that depend on this resume.
        apps = db.query(Application).filter_by(resume_id=resume.id, status="ACTIVE").all()
        if apps:
            from .agent_tasks import analyze_application_task

            for app in apps:
                analyze_application_task.delay(str(app.id))
    except Exception as exc:  # pragma: no cover - depends on live services
        db.rollback()
        resume = db.get(Resume, uuid.UUID(str(resume_id)))
        if resume is not None:
            resume.parse_status = "ERROR"
            resume.error_message = str(exc)[:500]
            db.commit()
        logger.exception("parse_resume failed for %s: %s", resume_id, exc)
        raise
    finally:
        db.close()
