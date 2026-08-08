from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=128)
    email: EmailStr
    password: str = Field(..., min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    access_token: str
    refresh_token: str
    new_password: str = Field(..., min_length=8)


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str = ""


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UserOut


class MessageResponse(BaseModel):
    message: str
