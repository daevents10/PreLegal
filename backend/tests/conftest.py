from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from prelegal_backend.main import create_app


@pytest.fixture(autouse=True)
def isolated_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Never touch the real backend/data database from tests."""
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("PRELEGAL_DB_PATH", str(db_path))
    return db_path


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    """API client with lifespan run (fresh DB) and no frontend mounted."""
    with TestClient(create_app(static_dir=tmp_path / "no-frontend")) as test_client:
        yield test_client
