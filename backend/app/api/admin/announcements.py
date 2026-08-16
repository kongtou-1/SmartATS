"""Admin API route registration for announcements."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.content import announcements as service

admin_router = APIRouter(prefix='/api/v1/admin/announcements', tags=['admin-announcements'])

admin_router.get('', response_model=list[AnnouncementOut])(service.admin_list_announcements)
admin_router.post('', response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED)(service.admin_create_announcement)
admin_router.get('/{announcement_id}', response_model=AnnouncementOut)(service.admin_get_announcement)
admin_router.put('/{announcement_id}', response_model=AnnouncementOut)(service.admin_update_announcement)
admin_router.delete('/{announcement_id}', status_code=status.HTTP_204_NO_CONTENT)(service.admin_delete_announcement)
admin_router.post('/{announcement_id}/publish', response_model=AnnouncementOut)(service.admin_publish_announcement)
admin_router.post('/{announcement_id}/close', response_model=AnnouncementOut)(service.admin_close_announcement)
