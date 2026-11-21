#!/usr/bin/env bash
# Shared start logic for Mac and Linux: build the image and run a fresh container.
# A fresh container (and therefore a fresh SQLite database) is created on every start.
set -euo pipefail

IMAGE="prelegal"
CONTAINER="prelegal"
PORT="${PRELEGAL_PORT:-8000}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

command -v docker >/dev/null 2>&1 || { echo "Docker is not installed or not on PATH." >&2; exit 1; }

echo "Building image '$IMAGE'..."
docker build -t "$IMAGE" "$ROOT"

# Replace any container left over from a previous run.
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

env_args=()
[[ -f "$ROOT/.env" ]] && env_args=(--env-file "$ROOT/.env")

echo "Starting container '$CONTAINER'..."
docker run -d --rm --name "$CONTAINER" -p "$PORT:8000" "${env_args[@]+"${env_args[@]}"}" "$IMAGE" >/dev/null

for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    echo "Prelegal is running at http://localhost:$PORT"
    exit 0
  fi
  sleep 1
done

echo "Prelegal did not become healthy in time. Recent logs:" >&2
docker logs --tail 50 "$CONTAINER" >&2 || true
exit 1
