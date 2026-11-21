#!/usr/bin/env bash
# Start Prelegal on macOS (Docker). Serves http://localhost:8000
exec "$(dirname "${BASH_SOURCE[0]}")/_start.sh" "$@"
