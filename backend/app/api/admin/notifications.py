"""Admin API route registration for notifications."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.account import notifications as service

admin_router = APIRouter(prefix='/api/v1/admin/notifications', tags=['communications'])

admin_router.get('/{candidate_id}/communications')(service.communications)
