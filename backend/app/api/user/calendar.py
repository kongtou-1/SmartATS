"""User API route registration for calendar."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.operations import calendar as service

public_router = APIRouter(prefix='/api/v1/calendar', tags=['calendar-feed'])

public_router.get('/feed/{token}')(service.calendar_feed)
