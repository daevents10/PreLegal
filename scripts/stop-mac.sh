#!/usr/bin/env bash
# Stop Prelegal on macOS (Docker). Serves http://localhost:8000
exec "$(dirname "${BASH_SOURCE[0]}")/_stop.sh" "$@"
