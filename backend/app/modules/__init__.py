"""Deprecated aliases for the former flat ``app.modules`` package.

All implementations now live in domain packages under :mod:`app.services`.
The aliases below preserve old imports while keeping this directory to one
source file. New code must not import from here.
"""
from __future__ import annotations

import sys

from ..api.admin import (
    announcements as admin_announcements,
    applications as admin_applications,
    audit_logs as admin_audit_logs,
    bulk_actions as admin_bulk_actions,
    calendar as admin_calendar,
    categories as admin_categories,
    data_jobs as admin_data_jobs,
    interviews as admin_interviews,
    jobs as admin_jobs,
    notifications as admin_notifications,
    offers as admin_offers,
    reports as admin_reports,
    talents as admin_talents,
    users as admin_users,
)
from ..api.user import (
    announcements as user_announcements,
    applications as user_applications,
    auth as user_auth,
    calendar as user_calendar,
    candidates as user_candidates,
    categories as user_categories,
    interviews as user_interviews,
    jobs as user_jobs,
    notifications as user_notifications,
    offers as user_offers,
)
from ..services.account import auth, notifications, users
from ..services.content import announcements
from ..services.operations import audit_logs, calendar, data_jobs, reports
from ..services.recruitment import applications, bulk_actions, categories, interviews, jobs, offers
from ..services.talent import candidates, talents
from ..utils import presenters as _helpers


_ROUTERS = {
    auth: {"router": user_auth.router},
    notifications: {
        "router": user_notifications.router,
        "admin_router": admin_notifications.admin_router,
    },
    users: {
        "router": admin_users.router,
        "interviewers_router": admin_users.interviewers_router,
    },
    announcements: {
        "public_router": user_announcements.public_router,
        "admin_router": admin_announcements.admin_router,
    },
    applications: {
        "candidate_router": user_applications.candidate_router,
        "admin_router": admin_applications.admin_router,
    },
    audit_logs: {"router": admin_audit_logs.router},
    bulk_actions: {"router": admin_bulk_actions.router},
    calendar: {
        "router": admin_calendar.router,
        "public_router": user_calendar.public_router,
    },
    candidates: {"router": user_candidates.router},
    categories: {
        "public_router": user_categories.public_router,
        "admin_router": admin_categories.admin_router,
    },
    data_jobs: {"router": admin_data_jobs.router},
    interviews: {
        "admin_router": admin_interviews.admin_router,
        "interviewer_router": user_interviews.interviewer_router,
    },
    jobs: {
        "public_router": user_jobs.public_router,
        "admin_router": admin_jobs.admin_router,
    },
    offers: {
        "admin_router": admin_offers.admin_router,
        "candidate_router": user_offers.candidate_router,
        "public_router": user_offers.public_router,
    },
    reports: {"router": admin_reports.router},
    talents: {"router": admin_talents.router},
}

for service, routers in _ROUTERS.items():
    for name, router in routers.items():
        setattr(service, name, router)

for name in (
    "announcements", "applications", "audit_logs", "auth", "bulk_actions",
    "calendar", "candidates", "categories", "data_jobs", "interviews", "jobs",
    "notifications", "offers", "reports", "talents", "users", "_helpers",
):
    sys.modules[f"{__name__}.{name}"] = globals()[name]

__all__ = [
    "announcements", "applications", "audit_logs", "auth", "bulk_actions",
    "calendar", "candidates", "categories", "data_jobs", "interviews", "jobs",
    "notifications", "offers", "reports", "talents", "users",
]
