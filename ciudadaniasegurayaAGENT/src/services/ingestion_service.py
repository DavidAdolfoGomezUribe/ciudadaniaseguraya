from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from pydantic import ValidationError

from src.integrations.backend import BackendIncidentClient, BackendIngestReceipt
from src.models.incident import IncidentCandidate


@dataclass(frozen=True, slots=True)
class IngestedIncident:
    candidate: IncidentCandidate
    receipt: BackendIngestReceipt


class IncidentIngestionService:
    """Sequentially persist validated candidates with no ambiguous retries."""

    def __init__(self, client: BackendIncidentClient) -> None:
        self.client = client

    async def ingest(
        self,
        candidates: list[IncidentCandidate],
        *,
        limit: int,
    ) -> list[IngestedIncident]:
        if not 1 <= limit <= len(candidates):
            raise ValueError("ingest limit must be within the candidate dataset")
        results: list[IngestedIncident] = []
        for candidate in candidates[:limit]:
            receipt = await self.client.submit(candidate)
            results.append(IngestedIncident(candidate=candidate, receipt=receipt))
        return results


def save_incidents_jsonl(candidates: list[IncidentCandidate], path: Path) -> None:
    if not candidates:
        raise ValueError("Cannot save an empty incident dataset")
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    with temporary.open("w", encoding="utf-8") as output:
        for candidate in candidates:
            payload = candidate.model_dump(mode="json", by_alias=True)
            output.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
            output.write("\n")
    temporary.replace(path)


def load_incidents_jsonl(path: Path, *, maximum: int = 100) -> list[IncidentCandidate]:
    candidates: list[IncidentCandidate] = []
    source_urls: set[str] = set()
    try:
        with path.open("r", encoding="utf-8") as source:
            for line_number, line in enumerate(source, start=1):
                if not line.strip():
                    continue
                if len(candidates) >= maximum:
                    raise ValueError(
                        f"Candidate dataset contains more than {maximum} incidents"
                    )
                try:
                    candidate = IncidentCandidate.model_validate_json(line)
                except ValidationError as exc:
                    raise ValueError(
                        f"Invalid IncidentCandidate on JSONL line {line_number}: {exc}"
                    ) from exc
                source_url = str(candidate.source_url)
                if source_url in source_urls:
                    raise ValueError(
                        f"Duplicate sourceUrl in candidate dataset on line {line_number}"
                    )
                source_urls.add(source_url)
                candidates.append(candidate)
    except OSError as exc:
        raise ValueError(f"Could not read candidate dataset {path}: {exc}") from exc
    if not candidates:
        raise ValueError(f"Candidate dataset contains no incidents: {path}")
    return candidates
