from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.agents import router as agents_router
from app.api.contexts import router as contexts_router
from app.api.demo import router as demo_router
from app.api.experiments import router as experiments_router
from app.api.health import router as health_router
from app.api.learning import router as learning_router
from app.api.memories import router as memories_router
from app.api.observatory import router as observatory_router
from app.api.runs import router as runs_router
from app.api.souls import router as souls_router
from app.api.tools import router as tools_router
from app.api.workflows import router as workflows_router
from app.config import get_settings
from app.database import initialize_database


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if settings.create_tables_on_startup:
            initialize_database()
        yield

    app = FastAPI(title="Agent Swarm Lab API", version=settings.app_version, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router)
    app.include_router(souls_router)
    app.include_router(agents_router)
    app.include_router(tools_router)
    app.include_router(contexts_router)
    app.include_router(memories_router)
    app.include_router(workflows_router)
    app.include_router(runs_router)
    app.include_router(experiments_router)
    app.include_router(learning_router)
    app.include_router(observatory_router)
    app.include_router(demo_router)
    return app


app = create_app()
