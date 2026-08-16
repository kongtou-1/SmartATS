"""Admin API route registration for jobs."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.recruitment import jobs as service

admin_router = APIRouter(prefix='/api/v1/admin/jobs', tags=['admin-jobs'])

admin_router.get('', response_model=list[JobWithStats])(service.list_jobs)
admin_router.post('', response_model=JobWithStats, status_code=status.HTTP_201_CREATED)(service.create_job)
admin_router.get('/{job_id}', response_model=JobWithStats)(service.get_job)
admin_router.put('/{job_id}', response_model=JobWithStats)(service.update_job)
admin_router.post('/{job_id}/publish', response_model=JobWithStats)(service.publish_job)
admin_router.post('/{job_id}/close', response_model=JobWithStats)(service.close_job)
