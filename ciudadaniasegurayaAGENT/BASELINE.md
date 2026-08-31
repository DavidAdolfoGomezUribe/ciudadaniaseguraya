> 08/29/2026 07:13 PM — Iteration 1 Baseline Recorded for Iteration 2

# Deterministic Baseline

Iteration 1 is preserved as the automated comparison baseline. It uses no LLM and follows this fixed path:

```text
News source or JSONL snapshot
        ↓
Rule-based incident classification
        ↓
Deterministic date and location extraction
        ↓
Nominatim geocoding + cache
        ↓
Bogotá polygon and Pydantic validation
        ↓
IncidentCandidate
```

The baseline applies canonical URL/title deduplication, isolates source/article failures, prefers an explicit incident timestamp, and may use a disclosed publication-time fallback when configured. It performs no backend `POST` and no MongoDB write.

## Historical Evidence

The recorded Iteration 1 live run obtained 5 validated incidents from Bogotá.gov.co and Canal Capital in 154.91 seconds, and its offline suite passed 132 tests. Those historical results are preserved unchanged.

Iteration 2 also replayed a new 100-article snapshot: 31 candidates were processed, 2 payloads were accepted, 98 articles were rejected, and execution took 0.82 seconds. This is an operational replay, not an accuracy comparison and not a replacement for the historical result.

## Comparison Rule

Baseline, Ollama, and OpenAI evaluations must load the exact same JSONL snapshot. Precision, recall, or improvement claims require human labels and may not be inferred from accepted-payload counts alone.
