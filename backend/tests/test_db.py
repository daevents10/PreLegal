"""Tests for the temporary SQLite database."""

import sqlite3
from contextlib import closing
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from prelegal_backend.db import DEFAULT_DB_PATH, init_db, resolve_db_path
from prelegal_backend.main import create_app


def _user_count(db_path: Path) -> int:
    with closing(sqlite3.connect(db_path)) as conn, conn:
        return conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]


def test_init_db_creates_users_table(tmp_path: Path) -> None:
    db_path = tmp_path / "nested" / "dir" / "app.db"
    init_db(db_path)
    with closing(sqlite3.connect(db_path)) as conn, conn:
        columns = {row[1] for row in conn.execute("PRAGMA table_info(users)")}
    assert columns == {"id", "email", "password_hash", "created_at"}


def test_init_db_wipes_existing_data(tmp_path: Path) -> None:
    db_path = tmp_path / "app.db"
    init_db(db_path)
    with closing(sqlite3.connect(db_path)) as conn, conn:
        conn.execute("INSERT INTO users (email, password_hash) VALUES ('a@b.co', 'x')")
    assert _user_count(db_path) == 1
    init_db(db_path)
    assert _user_count(db_path) == 0


def test_email_unique_case_insensitive(tmp_path: Path) -> None:
    db_path = tmp_path / "app.db"
    init_db(db_path)
    with closing(sqlite3.connect(db_path)) as conn, conn:
        conn.execute("INSERT INTO users (email, password_hash) VALUES ('a@b.co', 'x')")
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO users (email, password_hash) VALUES ('A@B.CO', 'y')")


def test_resolve_db_path_precedence(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    explicit = tmp_path / "explicit.db"
    assert resolve_db_path(explicit) == explicit
    monkeypatch.setenv("PRELEGAL_DB_PATH", str(tmp_path / "env.db"))
    assert resolve_db_path() == tmp_path / "env.db"
    monkeypatch.delenv("PRELEGAL_DB_PATH")
    assert resolve_db_path() == DEFAULT_DB_PATH


def test_app_startup_recreates_database(tmp_path: Path, isolated_db: Path) -> None:
    """Integration: each app start (container start) begins with an empty users table."""
    credentials = {"email": "user@example.com", "password": "correct-horse"}
    with TestClient(create_app(static_dir=tmp_path / "none")) as client:
        assert client.post("/api/auth/signup", json=credentials).status_code == 201
    assert _user_count(isolated_db) == 1

    with TestClient(create_app(static_dir=tmp_path / "none")) as client:
        assert _user_count(isolated_db) == 0
        assert client.post("/api/auth/signin", json=credentials).status_code == 401
