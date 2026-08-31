import asyncio
import hmac
import logging

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status

from src.config.constants import OSM_ATTRIBUTION_HEADER
from src.config.settings import get_settings
from src.models.incident import IncidentCandidate
from src.services.factory import build_pipeline
from src.services.control_plane import AgentRunManager, StartAgentRun

logger = logging.getLogger(__name__)
router = APIRouter()
_scrape_lock = asyncio.Lock()
_run_manager = AgentRunManager()


def require_control_key(
    supplied: str | None = Header(default=None, alias="X-Agent-Control-Key"),
) -> None:
    configured = get_settings().agent_control_api_key
    if configured is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"message": "Agent control API is not configured"},
        )
    expected = configured.get_secret_value()
    if supplied is None or not hmac.compare_digest(supplied, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Invalid agent control credential"},
        )


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/providers")
async def providers() -> dict[str, dict[str, object]]:
    """Report local availability/configuration without exposing credentials."""

    settings = get_settings()
    ollama_available = False
    try:
        async with httpx.AsyncClient(
            base_url=settings.ollama_base_url,
            timeout=min(settings.request_timeout, 3.0),
        ) as client:
            ollama_available = (await client.get("/api/tags")).status_code == 200
    except httpx.HTTPError:
        pass
    return {
        "ollama": {
            "status": "available" if ollama_available else "unavailable",
            "modelConfigured": bool(settings.ollama_model),
        },
        "openai": {
            "status": "configured" if settings.openai_api_key else "unconfigured",
            "modelConfigured": bool(settings.openai_model),
        },
    }


@router.get("/control/status", dependencies=[Depends(require_control_key)])
async def control_status() -> dict[str, object]:
    """Return provider health plus the active/latest run and bounded logs."""

    return await _run_manager.snapshot(get_settings())


@router.post(
    "/control/runs",
    dependencies=[Depends(require_control_key)],
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_controlled_run(body: StartAgentRun) -> dict[str, object]:
    try:
        return await _run_manager.start(body, get_settings())
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": str(exc)},
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": str(exc)},
        ) from exc


@router.post(
    "/control/runs/{run_id}/cancel",
    dependencies=[Depends(require_control_key)],
)
async def cancel_controlled_run(run_id: str) -> dict[str, object]:
    try:
        return await _run_manager.cancel(run_id)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": str(exc)},
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": str(exc)},
        ) from exc


@router.get("/scrape", response_model=list[IncidentCandidate], response_model_by_alias=True)
async def scrape(
    response: Response,
    limit: int = Query(default=5, ge=1, le=5),
) -> list[IncidentCandidate]:
    """Run the live baseline without writing to the backend or database."""

    settings = get_settings()
    response.headers["X-Geocoding-Attribution"] = OSM_ATTRIBUTION_HEADER
    async with _scrape_lock:
        try:
            async with build_pipeline(settings) as pipeline:
                result = await pipeline.run(limit=limit)
        except Exception as exc:
            logger.exception("Scraping request failed")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"message": "The scraping pipeline could not complete safely"},
            ) from exc

    if len(result.incidents) != limit:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "message": (
                    f"Only {len(result.incidents)} of {limit} fully validated incidents "
                    "were found; no data was fabricated"
                ),
                "summary": result.stats.as_dict(),
            },
        )
    return result.incidents
