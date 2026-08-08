from __future__ import annotations

import jwt
from fastapi import HTTPException, status
from supabase import Client

from app.config import settings


def verify_token(token: str, supabase: Client) -> dict:
    jwt_secret = getattr(settings, "SUPABASE_JWT_SECRET", "")
    if jwt_secret:
        try:
            payload = jwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            user_id: str = payload.get("sub", "")
            email: str = payload.get("email", "")
            full_name: str = (payload.get("user_metadata") or {}).get("full_name", "")
            if not user_id:
                raise ValueError("No sub claim")
            return {"id": user_id, "email": email, "full_name": full_name}
        except Exception:
            pass

    try:
        resp = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )
    if resp.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )
    return {
        "id": resp.user.id,
        "email": resp.user.email,
        "full_name": (resp.user.user_metadata or {}).get("full_name", ""),
    }
