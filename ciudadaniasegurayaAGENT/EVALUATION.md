> 08/30/2026 09:59 AM — First End-to-End Production Persistence Observation

Prompt v2 and targeted deterministic corrections produced five fully validated candidates from the saved snapshot across two bounded evaluation runs. The final records covered three thefts, one explosive attack classified as `otro`, and one homicide. All five passed the backend's actual Zod schema, received HTTP 201, and were independently found in MongoDB as pending `ai_scraper` documents.

This demonstrates an end-to-end safe execution path, not model accuracy. The articles were deliberately preselected for explicit incident and neighborhood evidence, some used the disclosed publication-date fallback, and no human-labeled precision or recall score can be inferred.

---

> 08/30/2026 01:31 AM — First Real OpenAI Observation

A real `gpt-5.6-luna` run processed the first five records of the saved 100-article snapshot. It completed with 0 provider errors, 0 retries, 0 validation failures, 0 geocoding failures, 0 accepted incidents, 9,335 input tokens, 1,535 output tokens, and 17.881 seconds. The five structured rejections were consistent with unsuitable, multi-event, or insufficiently localized inputs. This small ordered subset is execution evidence only; human labels and a larger shared sample are still required for model-quality metrics.

---

> 08/30/2026 01:04 AM — First Real Ollama Observation

A five-article `qwen3:0.6b` run completed with 0 provider errors, 5 retries, 10 deterministic verifier failures, 0 accepted incidents, 17,036 input tokens, 3,639 output tokens, and 437.469 seconds. All failures were safely rejected before geocoding/final validation. This small, non-random subset is failure evidence, not precision/recall and not a comparison score. Larger configured models and human labels are still required.

---

> 08/29/2026 07:13 PM — Initial Iteration 2 Evaluation Plan

# Evaluation Objective

Determine whether one evidence-constrained LLM agent measurably improves the deterministic baseline without weakening payload validity, geographic safety, reproducibility, or reviewability.

## Dataset

- Target: 100 unique normalized `ScrapedArticle` records.
- One JSONL snapshot is collected once and remains unchanged for every comparison path.
- The live collector reached 100 records, but the local `.runs/articles-100.jsonl` file is intentionally not committed.
- Human ground-truth labels are still required before accuracy metrics can be calculated.

## Compared Systems

```text
A. Iteration 1 deterministic baseline
B. IncidentAnalysisAgent + Ollama + deterministic verification
C. IncidentAnalysisAgent + OpenAI + deterministic verification
```

The provider/model name, prompt version, configuration, dataset fingerprint, and execution date should accompany every scored run. No automatic provider fallback is allowed.

## Planned Metrics

- Incident detection precision and recall.
- Incident type, occurrence timestamp, neighborhood/address, and coordinate accuracy.
- Backend-compatible valid payload rate.
- False acceptance rate for summaries, policy, statistics, multiple events, and non-Bogotá events.
- Human review/override requirement.
- End-to-end and per-article processing time.
- Agent retry, verifier rejection, geocoding failure, and provider error rates.
- Input/output token usage and API cost only when directly measurable.

## Labeling and Scoring

At least two reviewers should label whether each article has one principal concrete Bogotá incident and annotate supported type/date/location evidence. Disagreements should be adjudicated before comparing systems. Publication-time fallback should be scored separately from explicit incident-time extraction.

## Evidence Available Now

- Collection capacity: 100/100 unique articles in 40.87 seconds, with all five sources represented and no reported duplicate/article error.
- Same-snapshot baseline replay: 2 accepted payloads and 98 rejected articles in 0.82 seconds.
- Unit/integration suite: 154 tests passed.

These counts do not establish precision, recall, or agent improvement. Ollama and OpenAI real runs were not available, so no model comparison or cost result is reported.
