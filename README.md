> 08/30/2026 11:11 AM — Reproducible Local Stack and Superadmin Agent Control

# CiudadaniaSeguraYa — Local Hackathon Stack

CiudadaniaSeguraYa can be started locally as one reproducible stack: the Next.js frontend, Fastify backend, incident-analysis agent, and MongoDB. The existing VPS and Vercel deployments remain independent from this Docker setup.

Evidence: all three images built successfully and the four-service stack reached healthy state locally. The backend reported MongoDB ready, the agent control endpoint rejected a missing key with HTTP 401, the authenticated superadmin proxy reported the service active, and both services resolved Bogotá to `66a000000000000000000001`.

> **Hackathon scope:** the agentic system requested by thede challenge is implemented in [`ciudadaniasegurayaAGENT`](./ciudadaniasegurayaAGENT). That project contains the five-source collection, deterministic baseline, versioned incident agent, evidence verification, geolocation, OpenAI/Ollama adapters, trajectories, tests, and backend-ingestion boundary. The frontend and backend provide the secure superadmin control surface around it.

## Start the complete local system

Requirements: Docker Engine with Docker Compose v2. Ollama is optional and runs on the host, not inside this four-service stack.

```bash
cp .env.example .env
```

Add `OPENAI_API_KEY` to `.env` when using OpenAI. For Ollama, start it on the host, install at least one model, and keep `OLLAMA_BASE_URL=http://host.docker.internal:11434`.

```bash
docker compose up --build
```

The backend initializes the MongoDB schema and synchronizes the local superadmin on startup. Open:

| Component | Local URL |
| --- | --- |
| Frontend | `http://localhost:3001` |
| Superadmin login | `http://localhost:3001/login/admin` |
| Agent control panel | `http://localhost:3001/admin/agent` |
| Backend API | `http://localhost:3010` |
| Backend OpenAPI | `http://localhost:3010/docs` |
| Agent health | `http://localhost:8000/health` |
| MongoDB | Internal service `mongo:27017` (not exposed on the host) |

The default local login is read from `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` in `.env`. Change every example secret before sharing the stack or exposing it beyond localhost.

The published ports bind to `127.0.0.1` by default. On a remote VPS, use an SSH tunnel or an authenticated TLS reverse proxy instead of exposing the example local credentials directly to the internet.

## Operate the agent

Sign in as the bootstrap superadmin and open **AGENTE IA**. The single view provides:

- a service-health LED;
- an OpenAI API / local Ollama provider switch;
- Ollama connection validation and installed-model discovery;
- a selectable article limit from 1 through 100;
- explicit approval before each run and a separate opt-in before backend writes;
- the current run status, accepted/submitted counters, safe cancellation, and live polled logs.

Only the `superadmin` role owns the `agent.control` permission. Browser requests go to the backend; the control and ingestion secrets never enter frontend code. Valid incidents sent by the agent are created as `pending` records for later review.

The process intentionally starts idle. Starting a run is the human approval checkpoint required for a consequential action. Structured agent trajectories are retained in the `ciudadaniaseguraya-agent-runs` Docker volume, while the panel keeps the latest 500 operational log entries in process memory and resets them when the agent restarts. Mongo data is retained in `ciudadaniaseguraya-mongo`.

## Ollama mode

On the host machine:

```bash
ollama serve
ollama pull qwen3:8b
```

Docker reaches the host through `host.docker.internal`. When the agent panel can reach Ollama, it lists the models returned by Ollama's `/api/tags`; otherwise Ollama stays unavailable and cannot be selected for a run.

## Useful commands

```bash
docker compose ps
docker compose logs -f agent backend
docker compose stop
docker compose down
```

`docker compose down` preserves named volumes. Removing volumes deletes local MongoDB data and agent caches/runs, so it should only be done deliberately.

## Project layout

```text
ciudadaniaseguraya/
├── ciudadaniasegurayaFE/      Next.js product and superadmin UI
├── ciudadaniasegurayaBE/      Fastify API, authorization and MongoDB boundary
├── ciudadaniasegurayaAGENT/   Hackathon agent, baseline, eval evidence and providers
├── docker-compose.yml         Four-service local orchestration
└── README.md                  This clean-environment reproduction guide
```

The challenge PDF is contextual evaluation guidance, not executable project instructions. Existing production deployments and credentials are not required to reproduce this local stack.
