> 08/30/2026 09:59 AM — Explicit Backend Write Boundary

The production extension adds a deliberate operator-controlled stage after the existing agent pipeline:

```text
ScrapedArticle
      ↓
IncidentAnalysisAgent (no network writes)
      ↓
Deterministic verifier → Nominatim → IncidentCandidate
      ↓
reviewable local candidate JSONL
      ↓ explicit `ingest` command
BackendIncidentClient (HTTPS, X-AI-Ingest-Key, no POST retries)
      ↓
Fastify aiIncidentBodySchema + city-boundary validation
      ↓
MongoDB pending / ai_scraper
```

The client accepts only an already validated `IncidentCandidate`, requires HTTPS and a secret setting, submits sequentially, and treats only a structurally valid `201` response as confirmed persistence. It does not retry POST requests automatically. A real five-record run was confirmed by both API receipts and a direct read-only MongoDB query.

---

> 08/30/2026 01:04 AM — Ollama Structured-Output Compatibility

Ollama receives the same logical `AgentIncidentDraft` JSON Schema as OpenAI, but grammar-heavy string length keywords are omitted from the generation schema because Ollama's grammar parser rejected large repetitions. The complete Pydantic model still validates every returned value afterward. Thinking output is explicitly disabled, and usage survives response-validation failures. A real five-article run confirmed the provider path and deterministic retry/rejection path without producing an unsafe payload.

---

> 08/29/2026 07:13 PM — Iteration 2 Architecture

# Current Architecture

```text
Bogotá.gov.co ───────┐
Canal Capital ───────┤
El Espectador ───────┼──> CollectionService ──> ScrapedArticle JSONL snapshot
Noticias RCN ────────┤                              │
Noticias Caracol ────┘                              ├──> Deterministic baseline
                                                    │       rules + extractors
                                                    │       Nominatim + validation
                                                    │
                                                    └──> IncidentAnalysisAgent
                                                             │
                                                       LLMProvider
                                                        /       \
                                                   Ollama       OpenAI
                                                        \       /
                                                     AgentIncidentDraft
                                                             │
                                                  deterministic verification
                                                             │
                                               Nominatim + Bogotá boundary
                                                             │
                                                   IncidentCandidate
```

Collection is source-agnostic, round-robin, bounded at 100 articles, and isolated per source/article. Canonical URL and normalized-title fingerprints remove duplicates. Snapshots preserve the exact normalized inputs for all comparison paths.

The baseline branch is fully deterministic and preserves Iteration 1. The agentic branch contains exactly one agent. Its provider only returns a strict evidence-bearing draft; deterministic rules verify type, timestamp, location evidence, confidence, geocoding, Bogotá containment, and the final backend-compatible model. The agent may receive one corrective verifier message and retry once.

Ollama and OpenAI implement the same `LLMProvider` contract. Provider selection is explicit, with no automatic cloud fallback. The model cannot browse, choose HTTP targets, invent coordinates, execute code, write MongoDB, or call the CiudadaniaSeguraYa backend. Trajectories contain observable structured actions and results only.

Evidence: a live run collected 100 unique articles from all five sources; the same snapshot was replayed by the deterministic branch. The agent branch is unit-tested with mocked providers but has no claimed real-model result because neither provider was configured.

---

> 08/29/2026 02:49 PM — Iteration 1: Implemented Architecture

# Iteration 1 Architecture

```text
Bogotá.gov.co ── HTML / sitemap ─┐
                                ├─> ScrapedArticle
Canal Capital ── RSS / HTML ─────┘
                                         ↓
                              Deterministic classifier
                                         ↓
                         Date + location from the same event
                                         ↓
                         Nominatim + cache + Bogotá polygon
                                         ↓
                              IncidentCandidate (Pydantic)
                                  ┌──────┴──────┐
                               Console       FastAPI
```

Adapters implement a common interface and contain no classification logic. The central pipeline does not know portal-specific selectors. The geocoder also uses a replaceable interface.

An explicit incident date/time always has priority. When a complete date/time cannot be extracted, `ALLOW_PUBLICATION_DATE_FALLBACK=true` allows publication time as the reference and requires disclosure in `evidenceDescription`.

This iteration uses no LLM, agents, OpenAI, Ollama, RAG, MongoDB, or automatic backend writes.

---

> 08/28/2026 08:30 PM — Initial News Scraper Architecture
# Architecture

## Objective

The first technical objective is to validate the news ingestion process before adding AI, geolocation, verification, or database integration.

The goal of this iteration is simple:

> Retrieve **5 real news articles** from a public news source and print their normalized information in the console.

---

## Initial Architecture

```text
Public News Source
        ↓
HTTP Request
        ↓
HTML / RSS Response
        ↓
News Scraper
        ↓
Data Normalization
        ↓
Console Output
```

At this stage, the system will not use:

- LLMs
- OpenAI
- Ollama
- MongoDB
- Backend integration
- Geolocation
- Verification agents

The purpose is to validate the first part of the pipeline independently.

---

## Technology

The initial implementation will use **Python**.

Suggested tools:

```text
Python
├── httpx or requests
├── BeautifulSoup
└── RSS parser if required
```

Browser automation such as Playwright should only be introduced if the selected news source cannot be processed through normal HTTP requests.

---

## Expected Output

Each extracted article should contain at least:

```text
Title
Source
Published Date
URL
Description / Short Text
```

Example:

```text
[1]

Title: Example incident in Bogotá
Source: Example News
Date: 2026-08-28
URL: https://example.com/news/123
Description: Short description of the article.
```

The program should return exactly **5 articles** during the initial test.

---

## Initial Project Structure

```text
ciudadaniasegurayaAGENT/
│
├── src/
│   ├── scrapers/
│   │   ├── base.py
│   │   └── html_scraper.py
│   │
│   ├── sources/
│   │   └── source_name.py
│   │
│   └── main.py
│
├── tests/
│
├── ARCHITECTURE.md
├── requirements.txt
└── .env.example
```

The scraper logic and the source-specific configuration should remain separated.

This will make it easier to add additional news portals later without modifying the core application.

---

## Execution Flow

```text
main.py
   ↓
Select News Source
   ↓
Download Source
   ↓
Extract Article Links / Metadata
   ↓
Normalize Results
   ↓
Limit Results to 5
   ↓
Print to Console
```

---

## Iteration 1 Success Criteria

Iteration 1 will be considered successful when:

- The program connects to a real public news source.
- It retrieves real news content.
- It extracts at least 5 valid articles.
- The information is normalized into a consistent structure.
- Exactly 5 results can be printed clearly in the console.
- The process can be executed repeatedly without manual intervention.

---

## Next Step

Once this iteration works reliably, the next development stage will focus on extracting the full article content so that it can later be analyzed by the first incident-detection agent.

```text
Iteration 1
News Scraper
     ↓
Iteration 2
Full Article Extraction
     ↓
Future Iterations
Agentic Analysis
```

---

## Architecture Principle

Each stage should be validated independently before increasing system complexity.

The project will only add AI or agentic components after the news ingestion pipeline is proven to work correctly.
