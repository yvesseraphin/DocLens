from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_ANON_KEY: str
    SUPABASE_JWT_SECRET: str = ""

    STORAGE_BUCKET: str = "documents"

    ALLOWED_ORIGINS_RAW: str = "http://localhost:5173"

    @property
    def ALLOWED_ORIGINS(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS_RAW.split(",") if o.strip()]

    GROQ_API_KEY: str = ""

    APP_TITLE: str = "DocLens API"
    APP_VERSION: str = "1.0.0"
    APP_DESCRIPTION: str = (
        "AI-powered forensic detection of forged signatures and tampered documents."
    )
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings: Settings = get_settings()
