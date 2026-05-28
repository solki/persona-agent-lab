from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "agent-swarm-lab-backend"
    app_version: str = "0.1.0"
    database_url: str = "postgresql://postgres:postgres@localhost:5433/agent_swarm_lab"
    frontend_api_base_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    create_tables_on_startup: bool = True
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: Optional[str] = None
    qdrant_collection_prefix: str = "agent_swarm_lab"
    tavily_api_key: Optional[str] = None
    llm_provider: str = Field(default="mock", pattern="^(mock|openai_compatible|openai|anthropic|ollama)$")
    llm_timeout_seconds: int = 120
    openai_compatible_api_key: Optional[str] = None
    openai_compatible_base_url: Optional[str] = None
    openai_compatible_model: Optional[str] = None
    openai_compatible_provider_name: Optional[str] = None
    openai_api_key: Optional[str] = None
    openai_model: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    anthropic_model: Optional[str] = None
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: Optional[str] = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
