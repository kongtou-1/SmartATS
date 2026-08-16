"""Admin API route registration for categories."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.recruitment import categories as service

admin_router = APIRouter(prefix='/api/v1/admin/job-categories', tags=['admin-job-categories'])

admin_router.get('', response_model=list[JobCategoryOut])(service.admin_list_job_categories)
admin_router.post('', response_model=JobCategoryOut, status_code=status.HTTP_201_CREATED)(service.admin_create_job_category)
admin_router.get('/{code}', response_model=JobCategoryOut)(service.admin_get_job_category)
admin_router.put('/{code}', response_model=JobCategoryOut)(service.admin_update_job_category)
admin_router.delete('/{code}', status_code=status.HTTP_204_NO_CONTENT)(service.admin_delete_job_category)
