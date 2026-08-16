"""User API route registration for applications."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.recruitment import applications as service

candidate_router = APIRouter(prefix='/api/v1/applications', tags=['applications'])

candidate_router.post('', response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)(service.create_application)
candidate_router.get('/my', response_model=list[ApplicationOut])(service.my_applications)
candidate_router.get('/{application_id}', response_model=CandidateApplicationDetail)(service.get_my_application)
candidate_router.post('/{application_id}/withdraw', status_code=status.HTTP_204_NO_CONTENT)(service.withdraw_application)
