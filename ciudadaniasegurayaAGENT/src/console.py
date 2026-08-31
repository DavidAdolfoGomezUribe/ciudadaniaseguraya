import json

from src.config.constants import OSM_ATTRIBUTION
from src.services.news_pipeline import PipelineResult, SUMMARY_REASON_ORDER
from src.services.agent_pipeline import AgentPipelineResult
from src.services.collection_service import CollectionResult
from src.services.ingestion_service import IngestedIncident

SEPARATOR = "=" * 50


def print_pipeline_result(result: PipelineResult, *, requested: int) -> None:
    for index, item in enumerate(result.accepted, start=1):
        print(SEPARATOR)
        print(f"INCIDENT {index}/{requested}")
        print(SEPARATOR)
        print()
        print(f"Source: {item.article.source}")
        print(f"Title: {item.article.title}")
        print(f"URL: {item.article.url}")
        print()
        print("Normalized payload:")
        print()
        print(
            json.dumps(
                item.candidate.model_dump(mode="json", by_alias=True),
                ensure_ascii=False,
                indent=4,
            )
        )
        print()

    stats = result.stats
    print(SEPARATOR)
    print("SCRAPING SUMMARY")
    print(SEPARATOR)
    print()
    print(f"Sources checked: {stats.sources_checked}")
    print(f"Articles discovered: {stats.articles_discovered}")
    print(f"Articles processed: {stats.articles_processed}")
    print(f"Articles rejected: {stats.articles_rejected}")
    print(f"Valid incidents: {stats.valid_incidents}")
    print(f"Execution time: {stats.execution_time:.2f} seconds")
    print()
    print("Rejected reasons:")
    for reason in SUMMARY_REASON_ORDER:
        print(f"- {reason}: {stats.rejected_reasons[reason]}")
    if stats.source_errors:
        print()
        print("Source errors:")
        for source, error in stats.source_errors.items():
            print(f"- {source}: {error}")
    print()
    print(OSM_ATTRIBUTION)


def print_collection_result(
    result: CollectionResult,
    *,
    requested: int,
    output_path: str | None,
) -> None:
    stats = result.stats
    print(SEPARATOR)
    print("COLLECTION SUMMARY")
    print(SEPARATOR)
    print()
    print(f"Requested articles: {requested}")
    print(f"Articles collected: {stats.articles_collected}")
    print(f"Articles discovered: {stats.articles_discovered}")
    print(f"Articles fetched: {stats.articles_fetched}")
    print(f"Duplicates: {stats.duplicates}")
    print(f"Article errors: {stats.article_errors}")
    print(f"Execution time: {stats.execution_time:.2f} seconds")
    print()
    print("Source distribution:")
    for source, count in stats.source_distribution.items():
        print(f"- {source}: {count}")
    if stats.source_errors:
        print()
        print("Source errors:")
        for source, error in stats.source_errors.items():
            print(f"- {source}: {error}")
    if output_path:
        print()
        print(f"Dataset: {output_path}")


def print_agent_result(result: AgentPipelineResult) -> None:
    for index, item in enumerate(result.accepted, start=1):
        print(SEPARATOR)
        print(f"AGENT INCIDENT {index}/{len(result.accepted)}")
        print(SEPARATOR)
        print()
        print(
            json.dumps(
                item.candidate.model_dump(mode="json", by_alias=True),
                ensure_ascii=False,
                indent=4,
            )
        )
        print()

    print(SEPARATOR)
    print("AGENT RUN SUMMARY")
    print(SEPARATOR)
    print()
    for key, value in result.stats.as_dict().items():
        print(f"{key}: {value}")
    print(f"runId: {result.run_id}")
    print(f"trajectories: {result.trajectory_path}")
    print()
    print(OSM_ATTRIBUTION)


def print_ingestion_result(results: list[IngestedIncident]) -> None:
    print(SEPARATOR)
    print("BACKEND INGESTION SUMMARY")
    print(SEPARATOR)
    print()
    for index, item in enumerate(results, start=1):
        receipt = item.receipt
        print(
            f"{index}. id={receipt.incident_id} status={receipt.status} "
            f"source={receipt.submission_source} requestId={receipt.request_id or '-'}"
        )
    print()
    print(f"Created incidents: {len(results)}")
