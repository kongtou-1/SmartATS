"""Admin API route registration for users."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.account import users as service

router = APIRouter(prefix='/api/v1/admin/users', tags=['admin-users'])
interviewers_router = APIRouter(prefix='/api/v1/admin/interviewers', tags=['admin-interviewers'])
direction_owners_router = APIRouter(prefix='/api/v1/admin/direction-owners', tags=['admin-direction-owners'])

interviewers_router.get('', response_model=list[AdminAccountOut])(service.list_interviewers)
direction_owners_router.get('', response_model=list[AdminAccountOut])(service.list_direction_owners)
router.get('', response_model=list[AdminAccountOut])(service.list_users)
router.post('', response_model=AdminAccountOut, status_code=status.HTTP_201_CREATED)(service.create_user)
router.put('/{user_id}', response_model=AdminAccountOut)(service.update_user)
router.delete('/{user_id}', response_model=AdminAccountOut)(service.delete_user)
