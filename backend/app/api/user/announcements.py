"""User API route registration for announcements."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.content import announcements as service

public_router = APIRouter(prefix='/api/v1/announcements', tags=['announcements'])

public_router.get('', response_model=list[AnnouncementOut])(service.list_announcements)
public_router.get('/{announcement_id}', response_model=AnnouncementOut)(service.get_announcement)
