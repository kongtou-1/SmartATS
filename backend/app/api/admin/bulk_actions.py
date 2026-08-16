"""Admin API route registration for bulk_actions."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.recruitment import bulk_actions as service

router = APIRouter(prefix='/api/v1/admin/applications', tags=['bulk-actions'])

router.post('/bulk-actions')(service.bulk_actions)
