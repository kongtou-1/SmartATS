"""Celery application.

Broker and result backend are both Redis (see REDIS_URL in core.config).
Run a worker from the backend directory:

    # Linux / macOS
    celery -A app.workers.celery_app worker -l info

    # Windows (prefork is unstable on Windows -> use solo pool)
    celery -A app.workers.celery_app worker -l info --pool=solo
"""
from __future__ import annotations

from celery import Celery

from ..core.config import REDIS_URL

celery_app = Celery(
    "hr_ats",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "app.workers.resume_tasks",
        "app.workers.agent_tasks",
        "app.workers.email_tasks",
        "app.workers.offer_tasks",
        "app.workers.data_tasks",
        "app.workers.interview_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_track_started=True,
    beat_schedule={
        "expire-offers-hourly": {"task": "offers.expire", "schedule": 3600.0},
        "interview-reminders": {"task": "interviews.send_reminders", "schedule": 60.0},
    },
)
