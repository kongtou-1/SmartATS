"""Aggregate router for the user API."""
from fastapi import APIRouter

from . import announcements, applications, auth, calendar, candidates, categories, interviews, jobs, notifications, offers

router = APIRouter()
router.include_router(announcements.public_router)
router.include_router(applications.candidate_router)
router.include_router(auth.router)
router.include_router(calendar.public_router)
router.include_router(candidates.router)
router.include_router(categories.public_router)
router.include_router(interviews.interviewer_router)
router.include_router(jobs.public_router)
router.include_router(notifications.router)
router.include_router(offers.candidate_router)
router.include_router(offers.public_router)

__all__ = ["router"]
