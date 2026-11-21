# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The current implementation is the V1 technical foundation plus a manual-form Mutual NDA creator; AI chat, the other document types and document persistence are not built yet (see Implementation Status).

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

Jira ticket keys (PL-N) are the source of truth for scope; read the ticket rather than assuming the roadmap below matches its number.

## AI design

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the `openrouter/openai/gpt-oss-120b` model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There is an OPENROUTER_API_KEY in the .env file in the project root.

## Technical design

The entire project should be packaged into a Docker container.  
The backend should be in backend/ and be a uv project, using FastAPI.  
The frontend should be in frontend/  
The database should use SQLLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.  
Consider statically building the frontend and serving it via FastAPI, if that will work.  
There should be scripts in scripts/ for:  
```bash
# Mac
scripts/start-mac.sh    # Start
scripts/stop-mac.sh     # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```
Backend available at http://localhost:8000

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

## Implementation Status

### Completed
- **PL-6** – Common Paper template dataset in `templates/` and `catalog.json`, with integrity tests (`tests/test_catalog.py`)
- **PL-7** – Mutual NDA creator prototype: manual form, live preview, PDF download (`@react-pdf/renderer`); Standard Terms parsed from `templates/` at build time
- **PL-8** – V1 technical foundation:
  - Multi-stage `Dockerfile` (Node 22 builds the Next.js static export; Python 3.12 + uv runs FastAPI/uvicorn on :8000)
  - FastAPI serves `/api/*` and the static frontend at `/`
  - SQLite (`backend/src/prelegal_backend/db.py`) recreated on every app start; `users` table only
  - Auth API (`auth.py`): bcrypt password hashes, JWT session in HttpOnly `prelegal_session` cookie
  - Start/stop scripts in `scripts/` (Mac/Linux share `_start.sh`/`_stop.sh`); each start runs a fresh `--rm` container, passing `.env` if present
  - The Docker build itself has not yet been verified on a machine with Docker installed

### Roadmap (not yet implemented)
- AI chat replaces the manual NDA form (LiteLLM → OpenRouter/Cerebras, structured outputs, live preview, download when complete)
- All document types from catalog.json, with AI detecting the requested type; generic preview/PDF components for less common types
- Frontend sign up / sign in UI, user menu, auth context
- Document persistence: save, list, load, delete documents per user (`/api/documents` CRUD)

### Current API Endpoints
- `GET /api/health` - Health check
- `POST /api/auth/signup` - Create account (201; 409 if email taken; 422 invalid input) and set session cookie
- `POST /api/auth/signin` - Sign in (401 on bad credentials) and set session cookie
- `POST /api/auth/signout` - Clear session cookie (204)
- `GET /api/auth/me` - Current user (401 if not signed in)

### Configuration and tests
- Env vars: `PRELEGAL_DB_PATH` (default `backend/data/prelegal.db`), `PRELEGAL_STATIC_DIR` (default `frontend/out`), `PRELEGAL_SECRET_KEY` (random per process if unset), `TEMPLATES_DIR` (frontend build)
- Tests: `cd backend && uv run pytest`; `cd frontend && npm test`; `uv run --project backend python -m pytest tests`
- Local run without Docker: `cd frontend && npm run build`, then `cd backend && uv run prelegal-backend`
