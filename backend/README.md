# Prelegal backend

FastAPI app (uv project). Serves the JSON API under `/api` and the statically exported
frontend (`../frontend/out`, override with `PRELEGAL_STATIC_DIR`) at http://localhost:8000.

```bash
cd frontend && npm install && npm run build   # produce frontend/out
cd backend && uv run prelegal-backend          # http://localhost:8000
uv run pytest                                  # tests
```
