> 08/30/2026 11:11 AM — Superadmin-Controlled Agent Service

The agent now exposes a secret-protected control plane for one background run at a time. A superadmin selects a target number of validated incidents plus a separate 1–100 article scan ceiling, observes bounded operational logs, can request safe cancellation, and explicitly approves backend ingestion. Provider credentials and the configured model are verified before collection, and provider failures never count as rejected news. The process starts idle; browser code never receives control or ingestion credentials. Direct ingestion remains sequential and has no automatic POST retry.

The local Docker stack persists trajectories and cache data in named volumes. It also pins the same Bogotá city ObjectId in the backend seed and agent contract, which makes clean-environment ingestion reproducible.

Evidence: 167 offline tests passed, the image built, the health endpoint responded, an unauthenticated control request returned HTTP 401, and the authorized control status was successfully proxied through the backend.

---

> 08/30/2026 09:59 AM — Production AI Ingestion Validation

## Backend Ingestion Follow-up

The agent now has an explicit, separate backend-ingestion command. `IncidentAnalysisAgent` still cannot perform HTTP writes: it produces strict `IncidentCandidate` records, which are saved locally, reloaded through Pydantic, and submitted sequentially by `BackendIncidentClient` only when the operator runs `ingest`. POST requests are never retried automatically because an ambiguous network failure could otherwise create duplicates.

A real `gpt-5.6-luna` validation produced five candidates under `incident-analysis-v2`. Every payload passed both the agent's Pydantic contract and the backend's actual Zod `aiIncidentBodySchema`. Production returned five `201 Created` responses, and a direct read-only MongoDB query confirmed five `pending` documents with `submissionSource: "ai_scraper"`: `6a9444ffe7b9a5501ed8bfa6` through `6a9444ffe7b9a5501ed8bfaa`.

---

> 08/30/2026 01:31 AM — Real OpenAI Validation with GPT-5.6 Luna

## OpenAI Follow-up

`OPENAI_MODEL=gpt-5.6-luna` is now the documented cloud configuration. A real run processed the first five records from the existing 100-article snapshot through the OpenAI Responses API. All five requests returned successfully with 0 provider errors, 0 retries, 0 validation failures, 0 geocoding calls, 9,335 input tokens, 1,535 output tokens, and 17.881 seconds of total execution time.

The agent rejected all five articles because none supplied one acceptable concrete incident with the required evidence and location specificity. This is a valid conservative result, not an accuracy score. The runtime trajectory remains under `.runs/trajectories/`, and one observable rejection is preserved in `trajectories/openai-001.md`. No API cost is claimed because the provider response did not report monetary cost.

---

> 08/30/2026 01:04 AM — Real Ollama Validation

## Ollama Follow-up

The real five-article run completed through `IncidentAnalysisAgent` with `qwen3:0.6b`: 0 provider errors, 5 bounded retries, 10 deterministic validation failures, 0 geocoding calls, 0 accepted incidents, 17,036 input tokens, 3,639 output tokens, and 437.469 seconds. The model followed the Pydantic shape after the prompt/schema compatibility fixes but repeatedly supplied unsupported incident evidence; the verifier prevented every unsafe payload.

The run produced a real local JSONL trajectory and the representative rejection in `trajectories/ollama-001.md`. This demonstrates pipeline/provider operation and a safety failure, not model accuracy or improvement. OpenAI still has no real result because no key/model is configured.

---

> 08/29/2026 07:13 PM — Iteration 2: Reproducible Collection and First Agent

# CiudadaniaSeguraYa — Agentic News Incident System

## Iteration 2 Update

CiudadaniaSeguraYa Agent now collects up to 100 unique normalized articles from five sources: Bogotá.gov.co, Canal Capital, El Espectador, Noticias RCN, and Noticias Caracol. A JSONL snapshot can be reused unchanged by the deterministic baseline, an Ollama-backed `IncidentAnalysisAgent`, or the OpenAI Responses API provider.

The Iteration 1 pipeline remains intact as the deterministic baseline. The new agent produces an evidence-bearing intermediate draft; deterministic verification, Nominatim geocoding, Bogotá-boundary checks, and strict `IncidentCandidate` validation still control final acceptance. There is at most one feedback retry and no backend or database write.

### Evidence

- A live collection obtained 100/100 unique articles in 40.87 seconds with no duplicates or article errors: Bogotá.gov.co 29, Canal Capital 29, El Espectador 7, Noticias RCN 28, and Noticias Caracol 7.
- The deterministic baseline replayed that exact snapshot without redownloading articles: 31 processed candidates, 2 accepted payloads, 98 rejected articles, and 0.82 seconds of execution time.
- The offline suite passed 154 tests.
- The Iteration 2 Docker image built successfully; `/health` and `/providers` were verified in a running container.
- No real LLM result is claimed: Ollama was unavailable and OpenAI had no configured key or model.

### Decision / Learning

Collection volume and valid-incident volume are intentionally separate. The reusable snapshot makes future human-labeled comparisons among the baseline, Ollama, and OpenAI fair and reproducible; the current baseline output is not yet an accuracy measurement.

---

> An agentic system that transforms unstructured news about incidents into automatically verifiable geospatial data.

## Project

CiudadaniaSeguraYa is an existing platform designed to visualize public safety incidents geographically.

Current platform:

https://ciudadaniaseguraya-fe.vercel.app/

The platform existed before this hackathon.

The work developed during the hackathon focuses on solving one of its main scalability bottlenecks: obtaining, interpreting, geolocating, verifying, and converting public news reports into structured incident data.

---

## The Problem

In Colombian cities, robberies, assaults, accidents, and other incidents are frequently reported by news outlets and public sources.

However, this information is normally published as unstructured text.

To register one incident in CiudadaniaSeguraYa, a person currently needs to:

1. Find and read the news article.
2. Determine whether it describes a relevant incident.
3. Identify what happened.
4. Determine when it happened.
5. Determine where it happened.
6. Geolocate the location.
7. Classify the incident.
8. Register the information.

The manual process takes approximately:

**~5 minutes per article.**

Human performance also decreases over time during repetitive work because of fatigue, interruptions, distractions, breaks, and context switching.

---

## The Bottleneck

The main bottleneck is converting:

```text
Unstructured News
        ↓
Structured + Geospatial + Verifiable Incident Data
```

At approximately 5 minutes per article:

```text
1 article      ≈ 5 minutes
12 articles    ≈ 1 hour
120 articles   ≈ 10 hours
1,000 articles ≈ 83 hours
```

In practice, the total time can be higher because sustained manual work becomes slower over time.

This limits how much information CiudadaniaSeguraYa can process and how frequently the map can be updated.

---

## Proposed Solution

Build an agentic system capable of automatically processing public news sources.

```text
News Sources
     ↓
News Collector
     ↓
Article Extraction
     ↓
Incident Agent
     ↓
Information Extraction
     ↓
Geolocation
     ↓
Verification
     ↓
CiudadaniaSeguraYa Backend
     ↓
Database
```

The agent should determine:

- Is this a relevant incident?
- What happened?
- When did it happen?
- Where did it happen?
- Can the location be geolocated?
- What evidence supports the result?
- How confident is the system?
- Is the incident duplicated?

---

## Expected Output

Example:

```json
{
  "isIncident": true,
  "category": "robbery",
  "country": "Colombia",
  "city": "Bogotá",
  "locality": "Kennedy",
  "latitude": null,
  "longitude": null,
  "incidentDate": null,
  "source": null,
  "sourceUrl": null,
  "confidence": null,
  "verificationStatus": "pending"
}
```

The schema will evolve during development.

---

## AI Execution Modes

The system should remain independent from a specific AI model.

### Cloud

```text
Agent
  ↓
LLM API
```

Possible providers include OpenAI or other capable LLM APIs.

### Local

```text
Agent
  ↓
Ollama
  ↓
Local LLM
```

Possible models include Gemma, Qwen, or other compatible models.

Changing models should require configuration rather than modifications to the core workflow.

---

## Hypothesis

> An agentic workflow can significantly reduce the time required to transform public news into structured geospatial incident data while maintaining sufficient extraction and verification accuracy.

This hypothesis will be tested against a simpler baseline.

---

## Development Strategy

The project will evolve incrementally.

```text
Baseline
   ↓
Measure
   ↓
Find Failure
   ↓
Improve
   ↓
Measure Again
   ↓
Keep / Modify / Remove
```

Every important iteration should document:

- What changed?
- Why?
- What evidence was obtained?
- What was learned or decided?

---

# Development Log

> Newest entries must always be placed first.
>
> Older entries will progressively move down the README.
>
> Entries should not be deleted simply because an implementation was later replaced.
>
> Format:
>
> `MM/DD/YYYY HH:MM AM/PM`

---

## 08/29/2026 02:49 PM — Iteration 1 Completed

### Stage

**Deterministic acquisition, normalization, geolocation, and validation baseline**

### What Changed

- An independent Python and FastAPI service without an LLM, agents, RAG, or MongoDB access.
- Separate adapters for Bogotá.gov.co and Canal Capital.
- HTML, RSS, and sitemap discovery with `robots.txt` enforcement, rate limits, retries, and error isolation.
- Deterministic classification using backend-supported incident values.
- Conservative date, neighborhood, locality, and address extraction.
- Nominatim geocoding with SQLite caching and validation against the Bogotá polygon used by the backend.
- A strict Pydantic model with the exact 13 keys required by the backend route.
- A terminal menu, direct CLI command, and `GET /health` and `GET /scrape?limit=5` endpoints.
- An explicit temporal fallback: incident date/time has priority; when a complete timestamp is absent, publication time is used and disclosed in `evidenceDescription`.

### Evidence

- A real run through menu option 1 obtained **5 of 5 valid incidents** from Bogotá.gov.co and Canal Capital.
- The conservative final verification took **154.91 seconds**.
- The automated suite passed **132 tests**.
- Real output contained only the 13 backend-compatible properties and made no `POST` request.

### Decision / Learning

Iteration 1 remains the modular, replaceable baseline. Rules, adapters, and the geocoder are separated so a later iteration can introduce an agent without rewriting scraping.

Exact requirements and commands are documented in `REPRODUCTION.md`.

### Status

✅ Iteration 1 completed and verified against real sources.

---

## 08/28/2026 08:30 PM — Project Definition

### Stage

**Iteration 0 — Initial scope and development plan**

### What changed

Established the initial development scope for the hackathon:

- Automate the ingestion of public news.
- Transform relevant articles into structured incident data.
- Add geolocation and verification.
- Support both cloud and local LLM execution.
- Integrate the resulting data with CiudadaniaSeguraYa.

### Evidence

The current manual workflow takes approximately **5 minutes per article**.

This represents roughly:

- 12 articles per hour.
- 120 articles in 10 hours.
- 1,000 articles in approximately 83 hours.

Additionally, sustained manual processing becomes slower over time due to repetitive work, fatigue, interruptions, distractions, breaks, and context switching.

### Decision / Learning

The first version will prioritize a simple and measurable workflow.

Next steps:

1. Define the incident schema.
2. Create the manual baseline.
3. Create an evaluation dataset.
4. Build a simple automated baseline.
5. Implement the first agent.
6. Compare results.
7. Add complexity only when evidence justifies it.

### Status

🟡 Initial development

---

## Current Status

```text
Existing CiudadaniaSeguraYa platform   ✅

Problem definition                    ✅
Initial hypothesis                    ✅

Manual baseline                       ⏳
Evaluation dataset                    ⏳
News collector                        ⏳
Incident agent                        ⏳
Geolocation                           ⏳
Verification                          ⏳
Local LLM mode                        ⏳
Cloud LLM mode                        ⏳
Final evaluation                      ⏳
```

---

## Project Principle

Agent complexity is not the objective.

**Measurable improvement is.**

Every important component added to the workflow should eventually demonstrate that it improves accuracy, processing time, reliability, cost, or human effort.

---

🚧 **Project Status: Early Development**

This README will evolve together with the project and preserve the main experiments, failures, decisions, and improvements made throughout the hackathon.


<br>
> 08/28/2026 12:30 PM

# Frontier Engineering Challenge 2026
- The beginning of a big dream.
