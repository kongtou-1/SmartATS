"""User API route registration for candidates."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.talent import candidates as service

router = APIRouter(prefix='/api/v1/candidate', tags=['candidate'])

router.get('/profile', response_model=ProfileOut)(service.get_profile)
router.put('/profile', response_model=ProfileOut)(service.update_profile)
router.get('/resume', response_model=ResumeOut | None)(service.get_resume)
router.post('/resume', response_model=ResumeOut, status_code=status.HTTP_201_CREATED)(service.upload_resume)
