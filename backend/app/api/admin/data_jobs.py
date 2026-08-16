"""Admin API route registration for data_jobs."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.operations import data_jobs as service

router = APIRouter(prefix='/api/v1/admin/data-jobs', tags=['data-jobs'])

router.get('/template')(service.template)
router.post('/import', status_code=202)(service.import_talents)
router.post('/export', status_code=202)(service.export_talents)
router.get('/{job_id}')(service.get_job)
router.get('/{job_id}/download')(service.download)
