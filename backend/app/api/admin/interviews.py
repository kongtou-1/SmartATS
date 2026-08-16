"""Admin API route registration for interviews."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.recruitment import interviews as service

admin_router = APIRouter(prefix='/api/v1/admin/interviews', tags=['admin-interviews'])

admin_router.post('', response_model=InterviewOut, status_code=status.HTTP_201_CREATED)(service.create_interview)
admin_router.get('', response_model=list[InterviewDetailOut])(service.list_interviews)
admin_router.get('/{interview_id}', response_model=InterviewDetailOut)(service.get_interview)
admin_router.put('/{interview_id}', response_model=InterviewOut)(service.update_interview)
admin_router.post('/{interview_id}/cancel', response_model=InterviewOut)(service.cancel_interview)
admin_router.post('/{interview_id}/confirm', response_model=InterviewDetailOut)(service.confirm_feedback)
admin_router.post('/{interview_id}/remind')(service.remind_interviewer)
