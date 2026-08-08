from fastapi import APIRouter, status

from app.dependencies import CurrentUser, SupabaseClient
from app.models.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    UserOut,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, sb: SupabaseClient) -> dict:
    return AuthService(sb).register(body)


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, sb: SupabaseClient) -> LoginResponse:
    return AuthService(sb).login(body)


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(body: ForgotPasswordRequest, sb: SupabaseClient) -> dict:
    return AuthService(sb).forgot_password(body)


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(body: ResetPasswordRequest, sb: SupabaseClient) -> dict:
    return AuthService(sb).reset_password(body)


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> dict:
    return user
