"""User API route registration for jobs."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.recruitment import jobs as service

public_router = APIRouter(prefix='/api/v1/jobs', tags=['jobs'])

public_router.get('/locations', response_model=list[str])(service.list_job_locations)
public_router.get('', response_model=list[JobOut])(service.list_published_jobs)
public_router.get('/{job_id}', response_model=JobOut)(service.get_published_job)
