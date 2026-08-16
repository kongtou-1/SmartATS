"""User API route registration for interviews."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.recruitment import interviews as service

interviewer_router = APIRouter(prefix='/api/v1/interviewer/interviews', tags=['interviewer'])

interviewer_router.get('', response_model=list[InterviewDetailOut])(service.my_interviews)
interviewer_router.get('/{interview_id}', response_model=InterviewDetailOut)(service.my_interview)
interviewer_router.post('/{interview_id}/feedback', response_model=InterviewFeedbackOut)(service.submit_feedback)
