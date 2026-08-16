"""Admin API route registration for audit_logs."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.operations import audit_logs as service

router = APIRouter(prefix='/api/v1/admin/audit-logs', tags=['audit'])

router.get('')(service.list_audit_logs)
router.get('/export')(service.export_audit_logs)
