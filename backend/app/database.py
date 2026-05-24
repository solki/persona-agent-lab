from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def initialize_database(bind: Engine = engine) -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=bind)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
