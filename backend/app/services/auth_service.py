from __future__ import annotations

from fastapi import HTTPException, status
from supabase import Client

from app.models.auth import ForgotPasswordRequest, LoginResponse, RegisterRequest, ResetPasswordRequest, UserOut


class AuthService:
    def __init__(self, supabase: Client) -> None:
        self._sb = supabase

    def register(self, body: RegisterRequest) -> dict:
        try:
            resp = self._sb.auth.sign_up({
                "email": body.email,
                "password": body.password,
                "options": {"data": {"full_name": body.full_name}},
            })
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration failed. Please try again.",
            ) from exc
        if resp.user is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration failed. Email may already be in use.",
            )
        return {
            "message": "Registration successful. Check your email to verify your account.",
            "user_id": resp.user.id,
        }

    def login(self, body) -> LoginResponse:
        try:
            resp = self._sb.auth.sign_in_with_password({"email": body.email, "password": body.password})
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
        if resp.user is None or resp.session is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
        return LoginResponse(
            access_token=resp.session.access_token,
            refresh_token=resp.session.refresh_token,
            user=UserOut(
                id=resp.user.id,
                email=resp.user.email or "",
                full_name=(resp.user.user_metadata or {}).get("full_name", ""),
            ),
        )

    def forgot_password(self, body: ForgotPasswordRequest) -> dict:
        try:
            self._sb.auth.reset_password_email(body.email)
        except Exception:
            pass
        return {"message": "If that email is registered, a reset link has been sent."}

    def reset_password(self, body: ResetPasswordRequest) -> dict:
        try:
            from supabase import create_client
            from app.config import settings
            user_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
            user_client.auth.set_session(body.access_token, body.refresh_token)
            user_client.auth.update_user({"password": body.new_password})
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password reset failed. Please request a new reset link.",
            )
        return {"message": "Password updated successfully."}
