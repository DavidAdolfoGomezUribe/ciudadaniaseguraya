> 08/30/2026 09:59 AM — First Accepted and Persisted OpenAI Trajectory

`openai-002.md` records a real `incident-analysis-v2` acceptance from `gpt-5.6-luna`, deterministic publication fallback, successful Nominatim validation, the final backend-compatible payload, and the confirmed production receipt. The agent itself did not perform the POST; the separate operator-controlled ingestion command did.

---

> 08/30/2026 01:31 AM — First Real OpenAI Trajectory

`openai-001.md` records a real structured rejection from the five-article `gpt-5.6-luna` run. It demonstrates a successful OpenAI provider call followed by an agent rejection, with observable inputs, decision, duration, and token usage but no API key, hidden reasoning, geocoding, or payload write.

---

> 08/30/2026 01:04 AM — First Real Representative Trajectory

`ollama-001.md` records a real rejection from the five-article `qwen3:0.6b` run. It includes both structured drafts, deterministic feedback, final decision, duration, and token usage. It contains no hidden reasoning and did not reach geocoding or payload creation.

---

> 08/29/2026 07:13 PM — Observable Agent Trajectory Format

# Trajectories

Runtime trajectories are written first to the Git-ignored `.runs/trajectories/` directory as one JSONL record per processed article. A representative record may be copied here only after a real successful model run.

Each record contains:

- run ID and America/Bogota timestamp;
- provider and model;
- article source and canonical URL;
- prompt version;
- initial structured `AgentIncidentDraft`;
- deterministic verifier result;
- geocoder result;
- optional retry feedback and retry output;
- final decision and execution time;
- input/output token usage when supplied by the provider.

Records must never contain API keys, credentials, hidden chain-of-thought, invented costs, or unstructured internal reasoning. The system requests structured output rather than reasoning traces.

At that point no example existed because the environment had neither a running configured Ollama model nor configured OpenAI credentials/model. That historical state is preserved; the later entry above records the real Ollama run. No OpenAI example exists and no fictitious trajectory was created.
