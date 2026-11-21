# PreLegal
To help attorneys to draft legal documents

> **Status: In progress** — PreLegal is under active development and is expected to be completed by **November 25, 2026**.

## Running

PreLegal runs as a single Docker container serving the app at http://localhost:8000.
Docker must be installed. If a `.env` file exists in the project root, it is passed to the container.

| OS      | Start                        | Stop                        |
| ------- | ---------------------------- | --------------------------- |
| macOS   | `scripts/start-mac.sh`       | `scripts/stop-mac.sh`       |
| Linux   | `scripts/start-linux.sh`     | `scripts/stop-linux.sh`     |
| Windows | `scripts\start-windows.ps1`  | `scripts\stop-windows.ps1`  |

The SQLite database is temporary: it is created from scratch each time the container starts.
See [`backend/README.md`](backend/README.md) for local development without Docker and the API.

## Templates

The [`templates/`](templates/) folder contains the legal document templates PreLegal adapts for clients, sourced from [Common Paper](https://github.com/CommonPaper) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). [`templates/templates.json`](templates/templates.json) lists every template with its version and source; see [`templates/LICENSE.md`](templates/LICENSE.md) for attribution requirements.
