from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    anthropic_api_key: str = ""
    tavily_api_key: str = ""
    redis_url: str = "redis://localhost:6379"
    cors_origins: list[str] = ["http://localhost:5173"]
    port: int = 8000
    log_level: str = "INFO"


settings = Settings()
