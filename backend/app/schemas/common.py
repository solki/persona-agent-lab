from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    llm_provider: str
    database_configured: bool
