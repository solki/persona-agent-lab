from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()


def sqlalchemy_database_url(database_url: str) -> str:
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url


engine = create_engine(sqlalchemy_database_url(settings.database_url), pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def initialize_database(bind: Engine = engine) -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=bind)
    _ensure_local_schema_columns(bind)


def _ensure_local_schema_columns(bind: Engine) -> None:
    inspector = inspect(bind)
    if "runs" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("runs")}
    if "archived_at" not in columns:
        with bind.begin() as connection:
            connection.execute(text("ALTER TABLE runs ADD COLUMN archived_at TIMESTAMP"))


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
