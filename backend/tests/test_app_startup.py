from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import StaticPool

from app.database import Base, initialize_database


def test_cors_allows_local_frontend_origin(client):
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_initialize_database_creates_registered_tables():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    initialize_database(engine)

    table_names = set(inspect(engine).get_table_names())
    assert {"agents", "souls", "tools", "agent_contexts", "agent_memories", "workflows", "runs"}.issubset(table_names)
    Base.metadata.drop_all(bind=engine)


def test_initialize_database_backfills_run_archive_column_for_local_databases():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE runs (
                    id INTEGER PRIMARY KEY,
                    workflow_id INTEGER NOT NULL,
                    input JSON NOT NULL,
                    output JSON,
                    status VARCHAR(40) NOT NULL,
                    config_snapshot JSON NOT NULL,
                    started_at TIMESTAMP,
                    ended_at TIMESTAMP,
                    created_at TIMESTAMP NOT NULL
                )
                """
            )
        )

    initialize_database(engine)

    columns = {column["name"] for column in inspect(engine).get_columns("runs")}
    assert "archived_at" in columns
    Base.metadata.drop_all(bind=engine)
