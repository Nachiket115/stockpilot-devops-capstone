"""Shared fixtures for StockPilot backend tests.

Sets DATABASE_URL to an in-memory SQLite BEFORE the app modules are imported,
then overrides the FastAPI get_db dependency to use that database.
"""
import os

# Must be set before any app import so pydantic-settings picks it up.
os.environ["DATABASE_URL"] = "sqlite://"

from collections.abc import Generator  # noqa: E402

import pytest  # noqa: E402
from sqlalchemy import create_engine, event  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Enable SQLite foreign-key enforcement (good practice, though not strictly
# needed here) via a connection-level PRAGMA.
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_conn, _connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine
)


@pytest.fixture(autouse=True)
def _reset_tables():
    """Create all tables before each test and drop them afterwards."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def _override_get_db() -> Generator[Session, None, None]:
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def item_payload() -> dict:
    """A valid item payload reusable across tests."""
    return {
        "name": "Widget",
        "sku": "WDG-001",
        "category": "Parts",
        "quantity": 10,
        "reorder_level": 5,
        "location": "Shelf A",
    }
