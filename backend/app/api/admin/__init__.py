"""Aggregate router for the admin API."""
from fastapi import APIRouter

from . import announcements, applications, audit_logs, bulk_actions, calendar, categories, dashboard, data_jobs, interviews, jobs, notifications, offers, reports, talents, users

router = APIRouter()
router.include_router(announcements.admin_router)
router.include_router(applications.admin_router)
router.include_router(audit_logs.router)
router.include_router(bulk_actions.router)
router.include_router(calendar.router)
router.include_router(categories.admin_router)
router.include_router(dashboard.admin_router)
router.include_router(data_jobs.router)
router.include_router(interviews.admin_router)
router.include_router(jobs.admin_router)
router.include_router(notifications.admin_router)
router.include_router(offers.admin_router)
router.include_router(reports.router)
router.include_router(talents.router)
router.include_router(users.router)
router.include_router(users.interviewers_router)
router.include_router(users.direction_owners_router)

__all__ = ["router"]
