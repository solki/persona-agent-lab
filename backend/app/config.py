from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "agent-swarm-lab-backend"
    app_version: str = "0.1.0"
    database_url: str = "postgresql+psycopg://agent_lab:agent_lab@localhost:5432/agent_lab"
    frontend_api_base_url: str = "http://localhost:8000"
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: Optional[str] = None
    qdrant_collection_prefix: str = "agent_swarm_lab"
    tavily_api_key: Optional[str] = None
    llm_provider: str = Field(default="mock", pattern="^(mock|openai|anthropic|ollama)$")
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    ollama_base_url: str = "http://localhost:11434"


@lru_cache
def get_settings() -> Settings:
    return Settings()
