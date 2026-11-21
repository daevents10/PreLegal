#!/usr/bin/env bash
# Shared stop logic for Mac and Linux. The container is run with --rm, so stopping it
# also discards its temporary database.
set -euo pipefail

CONTAINER="prelegal"

command -v docker >/dev/null 2>&1 || { echo "Docker is not installed or not on PATH." >&2; exit 1; }

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  docker rm -f "$CONTAINER" >/dev/null
  echo "Prelegal stopped."
else
  echo "Prelegal is not running."
fi
