"""SQLite persistence. The database is temporary: it is recreated from scratch on every startup."""

import os
import sqlite3
from collections.abc import Iterator
from pathlib import Path

DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "prelegal.db"

SCHEMA = """
CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
"""


def resolve_db_path(db_path: Path | None = None) -> Path:
    """Explicit path, else PRELEGAL_DB_PATH, else backend/data/prelegal.db."""
    return db_path or Path(os.environ.get("PRELEGAL_DB_PATH", DEFAULT_DB_PATH))


def init_db(db_path: Path) -> None:
    """Delete any existing database file and create a fresh schema."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    for suffix in ("", "-wal", "-shm", "-journal"):
        Path(f"{db_path}{suffix}").unlink(missing_ok=True)
    conn = connect(db_path)
    try:
        conn.executescript(SCHEMA)
    finally:
        conn.close()


def connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def connection(db_path: Path) -> Iterator[sqlite3.Connection]:
    """Per-request connection: commits on success, rolls back on error, always closes."""
    conn = connect(db_path)
    try:
        with conn:
            yield conn
    finally:
        conn.close()
