"""User API route registration for offers."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.recruitment import offers as service

candidate_router = APIRouter(prefix='/api/v1/candidate/offers', tags=['candidate-offers'])
public_router = APIRouter(prefix='/api/v1/offers/respond', tags=['offer-response'])

candidate_router.get('', response_model=list[OfferOut])(service.my_offers)
candidate_router.post('/{offer_id}/respond', response_model=OfferOut)(service.candidate_respond)
candidate_router.get('/{offer_id}/pdf')(service.candidate_pdf)
public_router.get('/{token}')(service.inspect_token)
public_router.get('/{token}/pdf')(service.public_pdf)
public_router.post('/{token}', response_model=OfferOut)(service.public_respond)
