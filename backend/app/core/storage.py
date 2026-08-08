from __future__ import annotations

import re
from pathlib import PurePath

from supabase import Client
from app.config import settings

SAFE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
}


def upload_file(supabase: Client, path: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    supabase.storage.from_(settings.STORAGE_BUCKET).upload(
        path,
        data,
        {"content-type": content_type, "upsert": "true"},
    )
    return supabase.storage.from_(settings.STORAGE_BUCKET).get_public_url(path)


def safe_image_filename(filename: str | None, content_type: str, fallback: str) -> str:
    original = PurePath(filename or fallback).name
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", PurePath(original).stem).strip("._-")
    ext = SAFE_EXTENSIONS.get((content_type or "").lower())
    if not ext:
        ext = PurePath(original).suffix.lower()
    return f"{stem or fallback}{ext}"


def build_questioned_path(user_id: str, case_id: str, filename: str) -> str:
    return f"{user_id}/{case_id}/questioned/{filename}"


def build_reference_path(user_id: str, case_id: str, filename: str) -> str:
    return f"{user_id}/{case_id}/references/{filename}"
