# Prelegal backend

FastAPI app (uv project). Serves the JSON API under `/api` and the statically exported
frontend (`../frontend/out`, override with `PRELEGAL_STATIC_DIR`) at http://localhost:8000.

```bash
cd frontend && npm install && npm run build   # produce frontend/out
cd backend && uv run prelegal-backend          # http://localhost:8000
uv run pytest                                  # tests
```

## Database

SQLite, recreated from scratch on every startup (path: `PRELEGAL_DB_PATH`, default
`backend/data/prelegal.db`). Schema: a `users` table (`id`, `email` unique case-insensitive,
`password_hash` bcrypt, `created_at`).

## API

| Method | Path               | Description                                                    |
| ------ | ------------------ | -------------------------------------------------------------- |
| GET    | `/api/health`      | Health check                                                   |
| POST   | `/api/auth/signup` | `{email, password}` → 201 user + session cookie; 409 if taken  |
| POST   | `/api/auth/signin` | `{email, password}` → 200 user + session cookie; 401 if wrong  |
| POST   | `/api/auth/signout`| 204, clears the session cookie                                 |
| GET    | `/api/auth/me`     | Current user, or 401                                           |
| POST   | `/api/chat`        | `{messages, fields}` → `{reply, fields}`: AI drafts the Mutual NDA |

Passwords must be 8+ characters (max 72 bytes). The session is a JWT (HS256, 7 days) in the
HttpOnly `prelegal_session` cookie, signed with `PRELEGAL_SECRET_KEY` (a random key is generated
per process if unset, so sessions end when the server restarts — as does the database).

## AI chat

`/api/chat` is stateless: the client sends the full conversation and current NDA fields each turn.
The model (`openrouter/openai/gpt-oss-120b` via LiteLLM, Cerebras provider) returns a strict
structured output `{reply, updates}` where `null` means unchanged; updates are merged server-side.
Requires `OPENROUTER_API_KEY` (read from the repo-root `.env`); returns 503 without it and 502 if
the LLM call fails. `uv run pytest` includes a live LLM test when the key is set.
