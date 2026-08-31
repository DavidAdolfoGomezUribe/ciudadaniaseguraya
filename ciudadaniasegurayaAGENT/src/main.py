import argparse
import asyncio
import logging
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import Literal

from fastapi import FastAPI

from src.api.routes import router
from src.config.settings import get_settings
from src.console import (
    print_agent_result,
    print_collection_result,
    print_ingestion_result,
    print_pipeline_result,
)
from src.integrations.backend import BackendIngestError
from src.services.collection_service import load_articles_jsonl, save_articles_jsonl
from src.llm.base import ProviderError
from src.services.ingestion_service import (
    IncidentIngestionService,
    load_incidents_jsonl,
    save_incidents_jsonl,
)
from src.services.factory import (
    build_agent_pipeline,
    build_baseline_pipeline,
    build_backend_incident_client,
    build_collection_service,
    build_pipeline,
)


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )


def create_app() -> FastAPI:
    application = FastAPI(
        title="CiudadaniaSeguraYa Agent",
        version="0.2.0",
        description=(
            "Deterministic Iteration 1 baseline plus the provider-independent "
            "Iteration 2 incident-analysis agent."
        ),
    )
    application.include_router(router)
    return application


app = create_app()


def _parser(
    *,
    default_limit: int = 5,
    maximum_limit: int = 100,
) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m src.main")
    subcommands = parser.add_subparsers(dest="command")
    scrape = subcommands.add_parser(
        "scrape",
        help="buscar y mostrar incidentes validados",
    )
    scrape.add_argument(
        "--limit",
        type=int,
        default=default_limit,
        choices=range(1, maximum_limit + 1),
    )
    collect = subcommands.add_parser(
        "collect",
        help="collect a reproducible normalized article dataset",
    )
    collect.add_argument(
        "--limit",
        type=int,
        default=default_limit,
        choices=range(1, maximum_limit + 1),
    )
    collect.add_argument("--output", type=Path)
    baseline = subcommands.add_parser(
        "baseline",
        help="run the deterministic baseline over a collected JSONL dataset",
    )
    baseline.add_argument("--input", type=Path, required=True)
    agent = subcommands.add_parser(
        "agent",
        help="run IncidentAnalysisAgent over a collected JSONL dataset",
    )
    agent.add_argument("--input", type=Path, required=True)
    agent.add_argument("--provider", choices=("ollama", "openai"), required=True)
    agent.add_argument("--output", type=Path)
    ingest = subcommands.add_parser(
        "ingest",
        help="submit validated IncidentCandidate records to the backend",
    )
    ingest.add_argument("--input", type=Path, required=True)
    ingest.add_argument(
        "--limit",
        type=int,
        default=default_limit,
        choices=range(1, maximum_limit + 1),
    )
    serve = subcommands.add_parser("serve", help="iniciar la API FastAPI")
    serve.add_argument("--host", default="0.0.0.0")
    serve.add_argument("--port", type=int, default=8000)
    serve.add_argument("--reload", action="store_true")
    return parser


async def _run_scrape(limit: int) -> int:
    settings = get_settings()
    async with build_pipeline(settings) as pipeline:
        result = await pipeline.run(limit=limit)
    print_pipeline_result(result, requested=limit)
    if len(result.incidents) != limit:
        logging.getLogger(__name__).error(
            "Only %s/%s fully validated incidents were found; no values were fabricated",
            len(result.incidents),
            limit,
        )
        return 2
    return 0


async def _run_collect(limit: int, output: Path | None) -> int:
    settings = get_settings()
    async with build_collection_service(settings) as service:
        result = await service.collect(limit=limit)
    if output is not None:
        save_articles_jsonl(result.articles, output)
    print_collection_result(
        result,
        requested=limit,
        output_path=str(output) if output is not None else None,
    )
    return 0 if len(result.articles) == limit else 2


async def _run_baseline(input_path: Path) -> int:
    settings = get_settings()
    articles = load_articles_jsonl(
        input_path,
        maximum=settings.max_collection_limit,
    )
    async with build_baseline_pipeline(settings, articles=articles) as pipeline:
        result = await pipeline.run(limit=len(articles))
    print_pipeline_result(result, requested=len(result.incidents))
    return 0


async def _run_agent(
    input_path: Path,
    provider: Literal["ollama", "openai"],
    output_path: Path | None,
) -> int:
    settings = get_settings()
    articles = load_articles_jsonl(
        input_path,
        maximum=settings.max_collection_limit,
    )
    async with build_agent_pipeline(settings, provider=provider) as pipeline:
        result = await pipeline.run(articles)
    if output_path is not None and result.incidents:
        save_incidents_jsonl(result.incidents, output_path)
    print_agent_result(result)
    if output_path is not None:
        if result.incidents:
            print(f"Validated candidates: {output_path}")
        else:
            print("Validated candidates: none; no output file was written")
    return 0


async def _run_ingest(input_path: Path, limit: int) -> int:
    settings = get_settings()
    candidates = load_incidents_jsonl(
        input_path,
        maximum=settings.max_collection_limit,
    )
    client = build_backend_incident_client(settings)
    async with client:
        results = await IncidentIngestionService(client).ingest(
            candidates,
            limit=limit,
        )
    print_ingestion_result(results)
    return 0


def _run_server(*, host: str, port: int, reload: bool = False) -> int:
    import uvicorn

    uvicorn.run("src.main:app", host=host, port=port, reload=reload)
    return 0


def _interactive_menu(*, default_limit: int) -> int:
    while True:
        print("\nCiudadaniaSeguraYa Agent")
        print(
            f"1. Buscar {default_limit} noticias y mostrar los payloads JSON"
        )
        print("2. Iniciar API FastAPI")
        print("0. Salir")
        try:
            option = input("Seleccione una opción: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nEjecución cancelada.")
            return 130

        if option == "1":
            return asyncio.run(_run_scrape(default_limit))
        if option == "2":
            return _run_server(host="0.0.0.0", port=8000)
        if option == "0":
            return 0
        print("Opción inválida. Use 1, 2 o 0.")


def main(argv: Sequence[str] | None = None) -> int:
    settings = get_settings()
    configure_logging(settings.log_level)
    arguments = _parser(
        default_limit=settings.default_result_limit,
        maximum_limit=settings.max_collection_limit,
    ).parse_args(argv)
    try:
        if arguments.command is None:
            return _interactive_menu(default_limit=settings.default_scrape_limit)
        if arguments.command == "scrape":
            return asyncio.run(_run_scrape(arguments.limit))
        if arguments.command == "collect":
            return asyncio.run(_run_collect(arguments.limit, arguments.output))
        if arguments.command == "baseline":
            return asyncio.run(_run_baseline(arguments.input))
        if arguments.command == "agent":
            return asyncio.run(
                _run_agent(arguments.input, arguments.provider, arguments.output)
            )
        if arguments.command == "ingest":
            return asyncio.run(_run_ingest(arguments.input, arguments.limit))
        if arguments.command == "serve":
            return _run_server(
                host=arguments.host,
                port=arguments.port,
                reload=arguments.reload,
            )
    except (BackendIngestError, ProviderError, ValueError) as exc:
        logging.getLogger(__name__).error("%s", exc)
        return 2
    return 1


if __name__ == "__main__":
    sys.exit(main())
