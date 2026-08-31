> 08/30/2026 09:59 AM — Reviewed Production Ingestion

Configure both services with the same non-public key. The agent also needs the exact production endpoint and active city ID:

```dotenv
BOGOTA_CITY_ID=6a6761d90b11cc2370bf3321
AI_INGEST_URL=https://api.cloudylive.cloud/api/v1/integrations/ai/incidents
AI_INGEST_API_KEY=<secret>
AI_INGEST_TIMEOUT=20
```

Generate reviewable candidates first; this command does not write to the backend:

```bash
python -m src.main agent \
  --input .runs/articles-candidate-5-v2.jsonl \
  --provider openai \
  --output .runs/incidents-openai-candidates-v2.jsonl
```

Only after reviewing and validating the combined five-record JSONL, submit it explicitly:

```bash
python -m src.main ingest \
  --input .runs/incidents-openai-final-5.jsonl \
  --limit 5
```

The real production run returned five HTTP 201 responses. No POST retry is performed; if a request has an ambiguous transport failure, verify persistence by source URL or returned ID before any manual retry.

---

> 08/30/2026 01:31 AM — GPT-5.6 Luna Cloud Reproduction

The VPS `.env` selects the available OpenAI model without hardcoding it in application code:

```dotenv
OPENAI_API_KEY=<secret>
OPENAI_MODEL=gpt-5.6-luna
```

The real five-record validation used a local subset of the existing snapshot and then ran:

```bash
python -m src.main agent \
  --input .runs/articles-first-5.jsonl \
  --provider openai
```

The run completed with 5 successful API responses, 0 provider errors, 0 retries, and 0 accepted incidents. Its full local trajectory is `.runs/trajectories/20260830-013030-openai-c5e3230f.jsonl`; the representative committed record is `trajectories/openai-001.md`. The API key is not present in either file.

---

> 08/30/2026 01:04 AM — Local Provider Configuration and Real Run

The untracked `.env` now contains empty `OPENAI_API_KEY`/`OPENAI_MODEL` fields and `OLLAMA_BASE_URL=http://localhost:11434/`/empty `OLLAMA_MODEL` fields. Set a locally installed model name before running the agent; the code removes the trailing slash safely and never prints the OpenAI key.

The first real five-article local validation used a runtime-only `qwen3:0.6b` selection. It completed with no provider errors but produced no accepted incident because deterministic verification rejected unsupported evidence. See `trajectories/ollama-001.md`. No OpenAI call was made because no key/model was configured.

---

> 08/29/2026 07:13 PM — Iteration 2 Installation and Reproduction

# Requirements

- Python 3.12 or later, or Docker.
- HTTPS access to the five news sources and Nominatim.
- Ollama plus an explicitly selected local model for local agent runs.
- An OpenAI API key and explicit model for cloud agent runs.
- No MongoDB or CiudadaniaSeguraYa backend access is required; this iteration performs no writes.

# Local Installation

Run from `ciudadaniasegurayaAGENT`:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --requirement requirements.txt
cp .env.example .env
```

# Collect One Reproducible Dataset

Collect up to 100 unique normalized articles and persist the snapshot locally:

```bash
python -m src.main collect \
  --limit 100 \
  --output .runs/articles-100.jsonl
```

The collector prints discovered/fetched/collected totals, duplicates, article errors, execution time, source errors, and distribution across all configured sources. `.runs/` is ignored by Git because article bodies are local execution material.

# Replay the Deterministic Baseline

```bash
python -m src.main baseline \
  --input .runs/articles-100.jsonl
```

This reads the snapshot and does not redownload the articles. It may query Nominatim for deterministic candidates not already present in the local cache.

The original live baseline command remains available:

```bash
python -m src.main scrape --limit 5
```

# Run the Agent with Ollama

Start Ollama, download a model of your choice, and put that exact model name in `.env`:

```bash
ollama serve
ollama pull <model-name>
```

```dotenv
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=<model-name>
```

Then run:

```bash
python -m src.main agent \
  --input .runs/articles-100.jsonl \
  --provider ollama
```

The command verifies that the configured model appears in Ollama's `/api/tags` response before analysis. There is no automatic fallback to OpenAI.

# Run the Agent with OpenAI

Set the following values in the untracked `.env` file; never commit or print the key:

```dotenv
LLM_PROVIDER=openai
OPENAI_API_KEY=<your-key>
OPENAI_MODEL=<structured-output-capable-model>
```

```bash
python -m src.main agent \
  --input .runs/articles-100.jsonl \
  --provider openai
```

The OpenAI adapter uses the official SDK, the Responses API, and Pydantic structured parsing. It sends `store=false`. API usage is recorded when returned, but cost is never guessed.

# Trajectories

Agent runs append one observable JSON object per article under:

```text
.runs/trajectories/<run-id>.jsonl
```

Records include structured outputs, verifier/geocoder results, optional retry feedback, final decision, duration, and token usage when available. They exclude API keys, prompts containing secrets, and hidden chain-of-thought.

# Terminal Menu

```bash
python -m src.main
```

```text
1. Search for 5 news incidents and display backend-compatible JSON payloads
2. Start FastAPI
0. Exit
```

The existing menu text is displayed in Spanish for backward compatibility. Option 1 runs the live deterministic baseline.

# FastAPI

```bash
python -m src.main serve --host 0.0.0.0 --port 8000
```

Development alternative:

```bash
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

Checks:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/providers
curl "http://127.0.0.1:8000/scrape?limit=5"
```

`GET /providers` reports Ollama availability and OpenAI configuration without exposing credentials. The HTTP scrape endpoint remains bounded at 5 to avoid request timeouts; 100-item evaluations use the CLI.

# Docker

```bash
docker build --tag ciudadaniaseguraya-agent .
docker run --rm --env-file .env --publish 8000:8000 ciudadaniaseguraya-agent
```

Open the terminal menu inside the container:

```bash
docker run --rm --interactive --tty --env-file .env \
  --publish 8000:8000 \
  ciudadaniaseguraya-agent python -m src.main
```

Persist snapshots/trajectories by mounting a writable host directory at `/app/.runs`. If Ollama runs on the Docker host, configure a host-reachable `OLLAMA_BASE_URL`; container `localhost` refers to the container itself.

# Main Configuration

| Variable | Default | Purpose |
|---|---:|---|
| `DEFAULT_RESULT_LIMIT` | `5` | Default CLI/menu quantity. |
| `MAXIMUM_RESULT_LIMIT` | `100` | Maximum deterministic CLI result target. |
| `MAX_COLLECTION_LIMIT` | `100` | Maximum snapshot article count. |
| `ARTICLE_MAX_AGE_DAYS` | `365` | Maximum age for articles eligible in controlled runs. |
| `ENABLED_SOURCES` | all five | Comma-separated source registry keys. |
| `ALLOW_PUBLICATION_DATE_FALLBACK` | `true` | Uses publication time only when incident time is incomplete and discloses it. |
| `SOURCE_REQUEST_DELAY` | `1.0` | Minimum delay per source host. |
| `NOMINATIM_REQUEST_DELAY` | `1.1` | Minimum delay between Nominatim requests. |
| `LLM_PROVIDER` | `ollama` | Explicit configured provider; CLI can override it. |
| `OLLAMA_MODEL` | empty | Required exact local model name. |
| `OPENAI_API_KEY` | empty | Required secret for OpenAI runs. |
| `OPENAI_MODEL` | empty | Required OpenAI model name. |
| `AGENT_TIMEOUT` | `120` | Provider request timeout in seconds. |
| `AGENT_MAX_RETRIES` | `1` | Maximum verifier-feedback correction retry. |
| `AGENT_MIN_CONFIDENCE` | `0.65` | Minimum draft confidence accepted by verification. |
| `TRAJECTORIES_PATH` | `.runs/trajectories` | Local observable trajectory directory. |

# Tests

```bash
python -m pip install --requirement requirements-dev.txt
python -m pytest -q
```

Latest verified result:

```text
154 passed in 0.90s
```

All provider and source unit tests use mocks/fixtures; `pytest` performs no paid OpenAI request.

# Real Validation Evidence

The 08/29/2026 Iteration 2 validation produced:

```text
Collector requested/collected: 100/100
Duplicates: 0
Article errors: 0
Execution time: 40.87 seconds
Distribution: Bogotá.gov.co 29; Canal Capital 29; El Espectador 7;
              Noticias RCN 28; Noticias Caracol 7

Same-snapshot deterministic replay:
Articles discovered: 100
Candidates processed: 31
Accepted payloads: 2
Rejected articles: 98
Execution time: 0.82 seconds
```

These are execution counts, not precision or recall. No real agent trajectory was produced because Ollama was unavailable and OpenAI had no configured key/model.

---

> 08/29/2026 02:49 PM — Iteration 1 Installation and Reproduction

Iteration 1 required Python 3.12 or Docker plus HTTPS access to Bogotá.gov.co, Canal Capital, and Nominatim. It required no AI API, MongoDB, or backend credentials.

The terminal menu and direct command were:

```bash
python -m src.main
python -m src.main scrape --limit 5
```

FastAPI could be started with:

```bash
python -m src.main serve --host 0.0.0.0 --port 8000
```

The recorded Iteration 1 verification passed 132 tests and obtained 5 valid incidents from 2 sources in 154.91 seconds. Console output contained exactly the 13 backend-compatible fields, made no `POST`, and disclosed publication-time fallback inside `evidenceDescription` when used.
