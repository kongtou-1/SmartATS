"""Admin API route registration for reports."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.operations import reports as service

router = APIRouter(prefix='/api/v1/admin/reports', tags=['reports'])

router.get('/funnel')(service.funnel)
router.get('/channels')(service.channels)
router.get('/job-cycles')(service.job_cycles)
router.get('/workload')(service.workload)
router.get('/{report_name}/export')(service.export_report)
