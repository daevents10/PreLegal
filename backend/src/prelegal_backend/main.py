"""FastAPI app: JSON API under /api plus the statically exported Next.js frontend at /."""

import logging
import os
import secrets
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from prelegal_backend import auth
from prelegal_backend.db import init_db, resolve_db_path

logger = logging.getLogger(__name__)

# Default for a source checkout (backend/src/prelegal_backend/main.py -> repo root).
# Containers/packaged installs should set PRELEGAL_STATIC_DIR explicitly.
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_STATIC_DIR = PROJECT_ROOT / "frontend" / "out"


def create_app(static_dir: Path | None = None, db_path: Path | None = None) -> FastAPI:
    """Build the app. The frontend is mounted only if its static export exists."""
    if static_dir is None:
        static_dir = Path(os.environ.get("PRELEGAL_STATIC_DIR", DEFAULT_STATIC_DIR))
    db_path = resolve_db_path(db_path)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        init_db(db_path)
        logger.info("Initialised fresh database at %s", db_path)
        yield

    app = FastAPI(title="Prelegal API", lifespan=lifespan)
    app.state.db_path = db_path
    # Sessions only need to outlive the process if the secret is configured; the DB doesn't either.
    app.state.secret_key = os.environ.get("PRELEGAL_SECRET_KEY") or secrets.token_urlsafe(32)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth.router)

    # Mounted last so /api routes take precedence over the catch-all static mount.
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
    else:
        logger.warning(
            "Frontend build not found at %s; serving API only. "
            "Run `npm run build` in frontend/ or set PRELEGAL_STATIC_DIR.",
            static_dir,
        )

    return app


app = create_app()
