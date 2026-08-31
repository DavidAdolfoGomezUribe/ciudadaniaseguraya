from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo

from src.agents.models import TrajectoryRecord
from src.config.constants import BOGOTA_TIMEZONE


def create_run_id(provider: str) -> str:
    timestamp = datetime.now(ZoneInfo(BOGOTA_TIMEZONE)).strftime("%Y%m%d-%H%M%S")
    return f"{timestamp}-{provider}-{uuid4().hex[:8]}"


class TrajectoryRecorder:
    """Append observable records to a local JSONL run without hidden reasoning."""

    def __init__(self, *, directory: Path, run_id: str) -> None:
        self.directory = directory
        self.run_id = run_id
        self.path = directory / f"{run_id}.jsonl"

    def record(self, record: TrajectoryRecord) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)
        payload = record.model_dump(mode="json", by_alias=True)
        with self.path.open("a", encoding="utf-8") as output:
            output.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
            output.write("\n")
