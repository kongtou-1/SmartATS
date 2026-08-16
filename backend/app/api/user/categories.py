"""User API route registration for categories."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.recruitment import categories as service

public_router = APIRouter(prefix='/api/v1/job-categories', tags=['job-categories'])

public_router.get('', response_model=list[JobCategoryOut])(service.list_job_categories)
