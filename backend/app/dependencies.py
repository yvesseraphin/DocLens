from __future__ import annotations

from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException, status
from supabase import Client

from app.core.security import verify_token
from app.db.supabase import get_supabase


def supabase_client() -> Client:
    return get_supabase()


SupabaseClient = Annotated[Client, Depends(supabase_client)]


async def get_current_user(
    authorization: Annotated[Optional[str], Header()] = None,
    sb: Client = Depends(supabase_client),
) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing or malformed.",
        )
    return verify_token(authorization.split(" ", 1)[1], sb)


CurrentUser = Annotated[dict, Depends(get_current_user)]
