> 08/30/2026 09:59 AM — Explicit Production Backend Ingestion

### What Changed

- Added a secret-safe `BackendIncidentClient`, sequential ingestion service, candidate JSONL persistence, and the `ingest` CLI command.
- Added `AI_INGEST_URL`, `AI_INGEST_API_KEY`, and `AI_INGEST_TIMEOUT` settings; the secret is never logged.
- Corrected the runtime Bogotá city ID from the historical fixture ID to production's active `6a6761d90b11cc2370bf3321`.
- Preserved `incident-analysis-v1` and activated `incident-analysis-v2`, which requires exact contiguous evidence excerpts and complete standalone type evidence.
- Added deterministic support for the explicit Spanish infinitives `hurtar` and `robar`, improved exact evidence bundling, and retained strict location/geocoding checks.

### Why

Production writes require a deliberate boundary after agent analysis and deterministic validation. Separating `agent --output` from `ingest` makes the candidate set reviewable and prevents an LLM from calling the backend directly.

### Evidence

- Offline suite: 163 tests passed before the production write.
- Five candidates passed Pydantic and the backend's real Zod schema.
- Production returned five HTTP 201 responses with IDs `6a9444ffe7b9a5501ed8bfa6` through `6a9444ffe7b9a5501ed8bfaa`.
- A direct MongoDB read found exactly those five documents as `pending` and `ai_scraper`.

### Decision / Learning

Endpoint deployment, secret injection, candidate validity, and database persistence are distinct checks. The first production attempt correctly stopped at `503 AI_INGEST_DISABLED` with zero writes; after server configuration, the reviewed five-item dataset was submitted once with no automatic retry.

---

> 08/30/2026 01:31 AM — Iteration 2: Real OpenAI Validation

### What Changed

- Selected `gpt-5.6-luna` through `OPENAI_MODEL`; the provider remains model-independent.
- Added the selected model to `.env.example` without storing the API key.
- Added a representative real OpenAI rejection trajectory.

### Why

The cloud provider path needed a real configured execution over the same snapshot already used by the baseline and Ollama paths.

### Evidence

- The first five snapshot articles completed through the Responses API with 5 successful requests, 0 provider errors, 0 retries, 0 validation failures, and 0 geocoding failures.
- The run used 9,335 input tokens and 1,535 output tokens in 17.881 seconds. All five articles were conservatively rejected and no final incident payload was created.

### Decision / Learning

Provider success and incident acceptance are separate outcomes. GPT-5.6 Luna followed the structured contract and rejected unsuitable or insufficiently localized inputs; this five-record subset does not establish precision, recall, or superiority over the baseline.

---

> 08/30/2026 01:04 AM — Iteration 2: Real Ollama Validation

### What Changed

- Adapted the Pydantic JSON Schema sent to Ollama by removing grammar-heavy string length keywords while retaining full post-generation Pydantic validation.
- Disabled Ollama thinking output because this agent requests structured answers, not hidden reasoning.
- Preserved provider token usage and duration even when structured output fails validation.
- Made confidence and accepted/rejected field consistency explicit in `incident-analysis-v1`.
- Added one representative real rejection trajectory.

### Evidence

- Real model: `qwen3:0.6b`, selected only through runtime configuration.
- Five articles completed with 0 provider errors, 5 correction retries, 10 verifier failures, 0 accepted incidents, 17,036 input tokens, 3,639 output tokens, and 437.469 seconds.
- Deterministic verification rejected unsupported evidence before geocoding or payload creation in all five cases.

### Decision / Learning

JSON Schema compliance is not evidence compliance. A small local model can return structurally valid drafts while still copying or inventing the wrong evidence; deterministic verification remains mandatory. This run does not establish general Ollama quality or baseline superiority.

---

> 08/29/2026 07:13 PM — Iteration 2: Reproducible Collection and First Agent

# Iteration 2 Changes

### Stage

**Five-source collection → reusable snapshot → deterministic baseline or one LLM agent → deterministic verification**

### What Changed

- Increased CLI collection capacity to 100 normalized `ScrapedArticle` records while retaining a default of 5.
- Added El Espectador, Noticias RCN, and Noticias Caracol adapters beside Bogotá.gov.co and Canal Capital.
- Added round-robin collection, URL/title deduplication, source isolation, source distribution statistics, and atomic JSONL snapshots under the ignored `.runs/` directory.
- Preserved Iteration 1 as `build_baseline_pipeline()` and added snapshot replay without article redownloads.
- Added one provider-independent `IncidentAnalysisAgent`, a strict evidence-bearing `AgentIncidentDraft`, versioned prompt `incident-analysis-v1`, Ollama and OpenAI Responses API providers, deterministic verification, Nominatim geocoding, strict final validation, and at most one correction retry.
- Added observable JSONL trajectories without prompts, secrets, or hidden chain-of-thought.
- Added the `collect`, `baseline`, and `agent` CLI commands and the non-secret `GET /providers` endpoint.
- Added fixture-based source, provider, agent, retry, trajectory, 100-item collection, isolation, and same-snapshot tests.

### Why

A reusable article snapshot is necessary to compare deterministic, local-model, and cloud-model paths on identical inputs. The intermediate draft and deterministic verifier prevent an LLM from directly constructing or persisting a backend payload.

### Evidence

- Live collection: 100/100 unique articles in 40.87 seconds, 0 duplicates, and 0 article errors.
- Distribution: Bogotá.gov.co 29, Canal Capital 29, El Espectador 7, Noticias RCN 28, and Noticias Caracol 7.
- Deterministic replay of the same 100 articles: 31 processed candidates, 2 accepted payloads, 98 rejected articles, and 0.82 seconds.
- Offline suite: 154 tests passed.
- Docker validation: image build succeeded and live container checks returned the expected `/health` and non-secret `/providers` responses.
- No real Ollama or OpenAI trajectory was created because no local Ollama service/model or OpenAI credentials/model were configured.

### Decision / Learning

Collected articles and accepted incidents must remain separate measures. The live collection proves acquisition capacity, while agent quality still requires human labels and real configured model runs. No accuracy or cost claim is made yet.

### Status

✅ Iteration 2 implementation complete; real LLM evaluation remains configuration-dependent.

---

> 08/29/2026 02:49 PM — Iteration 1: Complete Deterministic Baseline

# Iteration 1 Changes

### Stage

**Scraping → normalization → geolocation → validation → console/API**

### What Changed

- Added a modular architecture with decoupled sources, scrapers, classifier, extractors, geocoder, and pipeline.
- Added real-source support for Bogotá.gov.co and Canal Capital through HTML, sitemap, and RSS discovery.
- Added a strict 13-field Pydantic contract compatible with the existing backend.
- Prioritized explicit incident date and time over editorial publication timestamps.
- Added a configurable publication-date fallback when the incident date or time is incomplete; its use is disclosed in `evidenceDescription`.
- Added Nominatim geocoding with caching, neighborhood/address consistency checks, and validation against the Bogotá polygon.
- Added an interactive menu for retrieving 5 news incidents, a direct CLI command, FastAPI endpoints, Docker support, and isolated error handling.
- Added offline tests for parsers, rules, dates, locations, contract validation, HTTP security, pipeline behavior, menu, and API.

### Evidence

- A run against both real sources produced 5 complete, validated payloads in 154.91 seconds under the conservative geographic rules.
- The automated suite passed 132 tests.
- The explicit January 22 attack timestamp at 9:00 PM correctly took precedence over the January 23 publication timestamp.

### Decision / Learning

This non-AI implementation remains the measurable baseline. It does not write to MongoDB or automatically send data to the backend.

### Status

✅ Iteration 1 completed.

---

> 08/28/2026 08:30 PM — Iteration 0: Existing Platform Baseline

# Improvement Changelog

> This document records the evolution of the hackathon project.
>
> Newest iterations should be added at the top.
>
> Format: `MM/DD/YYYY HH:MM AM/PM`

---

### Stage

**Pre-Hackathon Baseline**

### Existing System

Before the hackathon, CiudadaniaSeguraYa already existed as a functional platform.

Current platform:

https://ciudadaniaseguraya-fe.vercel.app/

The existing architecture is:

```text
Frontend
Next.js + JavaScript
Deployed on Vercel
        ↓
Backend API
Node.js + Fastify
Hostinger VPS
Dockploy
Docker Container
        ↓
MongoDB
Separate service running in Dockploy
```

### What Already Existed

- A functional CiudadaniaSeguraYa frontend.
- Frontend developed with **Next.js and JavaScript**.
- Frontend deployed on **Vercel**.
- Backend developed with **Node.js and Fastify**.
- Backend running on a **Hostinger VPS**.
- Backend deployed through **Dockploy** using a **Docker container**.
- **MongoDB** running as a separate service inside Dockploy.
- The database already stores the information used by the platform.

### Hackathon Starting Point

This existing platform is the baseline infrastructure.

The hackathon work starts from this point and focuses on adding a new agentic workflow capable of transforming unstructured public news into structured, geolocated, and verifiable incident data.

```text
Existing CiudadaniaSeguraYa
           +
     Agentic Workflow
           ↓
Automated Incident Data Processing
```

### Decision / Learning

The existing frontend, backend, deployment infrastructure, and database will remain the foundation of the project.

The agentic system will be developed as a new component focused specifically on solving the news-processing bottleneck.

### Status

✅ Existing platform documented as the pre-hackathon baseline.
