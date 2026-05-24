from fastapi import FastAPI

from app.api.health import router as health_router
from app.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Agent Swarm Lab API", version=settings.app_version)
    app.include_router(health_router)
    return app


app = create_app()
