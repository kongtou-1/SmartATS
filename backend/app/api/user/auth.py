"""User API route registration for auth."""
from fastapi import APIRouter, status

from ...schemas import *  # noqa: F403 - response model declarations
from ...services.account import auth as service

router = APIRouter(prefix='/api/v1/auth', tags=['auth'])

router.post('/register', response_model=AuthResponse, status_code=status.HTTP_200_OK)(service.register)
router.post('/login', response_model=AuthResponse)(service.login)
router.get('/me', response_model=AccountOut)(service.me)
