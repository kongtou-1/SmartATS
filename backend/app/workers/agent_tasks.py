"""Async job-matching scoring (agent)."""
from __future__ import annotations

import logging
import uuid

from ..agents.base import get_matcher
from ..services.database import SessionLocal
from ..models import AgentResult, Application, Job, Resume
from .celery_app import celery_app

logger = logging.getLogger("hr.workers.agent")


@celery_app.task(name="analyze_application", bind=True, max_retries=2, default_retry_delay=5)
def analyze_application_task(self, application_id: str):
    db = SessionLocal()
    try:
        app = db.get(Application, uuid.UUID(str(application_id)))
        if app is None or app.status != "ACTIVE":
            return

        job = db.get(Job, app.job_id)
        resume = db.get(Resume, app.resume_id)
        if job is None or resume is None:
            logger.warning("analyze_application: missing job/resume for %s", application_id)
            return

        result = get_matcher().score(
            job.title, job.description, job.requirements, resume.parsed_data or {}
        )

        agent = db.query(AgentResult).filter_by(application_id=app.id).first()
        if agent is None:
            agent = AgentResult(application_id=app.id)
            db.add(agent)
        agent.score = result["score"]
        agent.summary = result["summary"]
        agent.strengths = result["strengths"]
        agent.gaps = result["gaps"]
        agent.recommendation = result["recommendation"]
        agent.status = result["status"]
        agent.raw_result = result
        agent.error_message = None
        db.flush()
        app.ai_score = result["score"]
        db.commit()
        logger.info("analyze_application: %s scored %s", application_id, result["score"])
    except Exception as exc:  # pragma: no cover - depends on live services
        db.rollback()
        logger.exception("analyze_application failed for %s: %s", application_id, exc)
        raise
    finally:
        db.close()
