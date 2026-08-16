"""User API route registration for notifications."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.account import notifications as service

router = APIRouter(prefix='/api/v1/notifications', tags=['notifications'])

router.get('', response_model=list[NotificationOut])(service.list_notifications)
router.get('/unread-count')(service.unread_count)
router.post('/read-all')(service.mark_all_read)
router.post('/{notification_id}/read')(service.mark_read)
