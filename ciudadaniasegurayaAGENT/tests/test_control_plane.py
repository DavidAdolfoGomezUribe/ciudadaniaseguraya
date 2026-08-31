from pydantic import ValidationError
import pytest

from src.services.control_plane import StartAgentRun


def test_control_run_requires_confirmation_for_backend_writes() -> None:
    with pytest.raises(ValidationError, match="confirmIngest"):
        StartAgentRun.model_validate(
            {
                "provider": "openai",
                "model": "gpt-5.6-luna",
                "limit": 5,
                "ingest": True,
                "confirmIngest": False,
            }
        )


def test_control_run_accepts_bounded_analysis_without_ingestion() -> None:
    request = StartAgentRun.model_validate(
        {
            "provider": "ollama",
            "model": "qwen3:8b",
            "limit": 100,
            "ingest": False,
        }
    )

    assert request.provider == "ollama"
    assert request.limit == 100
    assert request.confirm_ingest is False
    assert request.max_articles == 100


@pytest.mark.parametrize("limit", [0, 101])
def test_control_run_rejects_out_of_range_article_limits(limit: int) -> None:
    with pytest.raises(ValidationError):
        StartAgentRun.model_validate(
            {
                "provider": "openai",
                "model": "gpt-5.6-luna",
                "limit": limit,
            }
        )


def test_control_run_requires_scan_limit_to_cover_valid_target() -> None:
    with pytest.raises(ValidationError, match="maxArticles"):
        StartAgentRun.model_validate(
            {
                "provider": "openai",
                "model": "gpt-5.6-luna",
                "limit": 6,
                "maxArticles": 5,
            }
        )
