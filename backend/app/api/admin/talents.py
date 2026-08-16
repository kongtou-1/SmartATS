"""Admin API route registration for talents."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.talent import talents as service

router = APIRouter(prefix='/api/v1/admin', tags=['talent-pool'])

router.get('/talents', response_model=PageOut)(service.list_talents)
router.post('/talents', response_model=TalentOut, status_code=status.HTTP_201_CREATED)(service.create_talent)
router.get('/talents/{candidate_id}', response_model=TalentOut)(service.get_talent)
router.put('/talents/{candidate_id}', response_model=TalentOut)(service.update_talent)
router.post('/talents/{candidate_id}/tags', response_model=TalentOut)(service.add_candidate_tag)
router.post('/talents/{candidate_id}/notes', status_code=201)(service.add_note)
router.get('/talents/{candidate_id}/notes')(service.list_notes)
router.post('/talents/{candidate_id}/merge', response_model=TalentOut)(service.merge_talent)
router.delete('/talents/{candidate_id}')(service.delete_talent)
router.post('/talents/{candidate_id}/restore', response_model=TalentOut)(service.restore_talent)
router.post('/talents/{candidate_id}/reactivate', response_model=ApplicationOut)(service.reactivate_talent)
router.get('/source-channels', response_model=list[SourceChannelOut])(service.list_channels)
router.post('/source-channels', status_code=201)(service.create_channel)
router.put('/source-channels/{channel_id}')(service.update_channel)
router.get('/tags', response_model=list[TagOut])(service.list_tags)
router.get('/talent-owners', response_model=list[AdminAccountOut])(service.list_talent_owners)
router.post('/tags', status_code=201)(service.create_tag)
router.put('/tags/{tag_id}')(service.update_tag)
