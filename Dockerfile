# syntax=docker/dockerfile:1

# ---- Stage 1: statically export the Next.js frontend ----
FROM node:22-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# The frontend reads templates/ at build time (TEMPLATES_DIR defaults to ../templates).
COPY templates/ /build/templates/
RUN npm run build

# ---- Stage 2: FastAPI backend serving the API and the static frontend ----
FROM python:3.12-slim AS runtime
COPY --from=ghcr.io/astral-sh/uv:0.13.9 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PATH="/app/.venv/bin:$PATH" \
    PRELEGAL_STATIC_DIR=/app/static \
    PRELEGAL_DB_PATH=/app/data/prelegal.db

WORKDIR /app/backend
# Install dependencies first so they are cached across source changes.
COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN uv sync --locked --no-dev --no-install-project
COPY backend/README.md ./
COPY backend/src/ ./src/
RUN uv sync --locked --no-dev

COPY --from=frontend /build/frontend/out /app/static

RUN useradd --create-home --uid 10001 prelegal && mkdir -p /app/data && chown prelegal /app/data
USER prelegal

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"

# The SQLite database is recreated from scratch on every start.
CMD ["uvicorn", "prelegal_backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
