"""Admin API route registration for offers."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.recruitment import offers as service

admin_router = APIRouter(prefix='/api/v1/admin/offers', tags=['offers'])

admin_router.get('', response_model=list[OfferOut])(service.list_offers)
admin_router.post('', response_model=OfferOut, status_code=201)(service.create_offer)
admin_router.get('/{offer_id}', response_model=OfferOut)(service.get_offer)
admin_router.put('/{offer_id}', response_model=OfferOut)(service.update_offer)
admin_router.post('/{offer_id}/submit', response_model=OfferOut)(service.submit_offer)
admin_router.post('/{offer_id}/approve', response_model=OfferOut)(service.approve_offer)
admin_router.post('/{offer_id}/reject', response_model=OfferOut)(service.reject_offer)
admin_router.post('/{offer_id}/send')(service.send_offer)
admin_router.get('/{offer_id}/pdf')(service.download_pdf)
