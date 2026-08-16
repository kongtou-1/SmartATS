"""Admin API route registration for calendar."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.operations import calendar as service

router = APIRouter(prefix='/api/v1/admin/calendar', tags=['calendar'])

router.get('')(service.events)
router.post('/busy-blocks', status_code=201)(service.add_busy)
router.delete('/busy-blocks/{block_id}', status_code=204)(service.delete_busy)
router.get('/interviewers/{interviewer_id}/availability')(service.availability)
router.post('/ics/import')(service.import_ics)
router.post('/subscription')(service.create_subscription)
router.delete('/subscription')(service.revoke_subscription)
