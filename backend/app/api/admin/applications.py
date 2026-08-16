"""Admin API route registration for applications."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.recruitment import applications as service

admin_router = APIRouter(prefix='/api/v1/admin/applications', tags=['admin-applications'])

admin_router.get('', response_model=list[AdminApplicationOut])(service.list_applications)
admin_router.get('/{application_id}', response_model=AdminApplicationDetailOut)(service.get_application)
admin_router.post('/{application_id}/transition', response_model=AdminApplicationDetailOut)(service.transition_stage)
admin_router.post('/{application_id}/next-stage', response_model=AdminApplicationDetailOut)(service.next_stage)
admin_router.post('/{application_id}/hold', response_model=AdminApplicationDetailOut)(service.hold_application)
admin_router.post('/{application_id}/resume', response_model=AdminApplicationDetailOut)(service.resume_application)
admin_router.post('/{application_id}/reject', response_model=AdminApplicationDetailOut)(service.reject_application)
admin_router.get('/{application_id}/agent-result', response_model=AgentResultOut)(service.agent_result)
admin_router.post('/{application_id}/agent-rerun', response_model=AgentResultOut)(service.agent_rerun)
admin_router.get('/{application_id}/resume-download')(service.download_resume)
