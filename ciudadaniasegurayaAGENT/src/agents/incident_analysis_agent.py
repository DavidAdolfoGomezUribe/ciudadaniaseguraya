from src.agents.models import AgentIncidentDraft
from src.agents.prompts.incident_analysis_v3 import SYSTEM_PROMPT, build_article_prompt
from src.llm.base import LLMProvider, StructuredResponse
from src.models.article import ScrapedArticle


class IncidentAnalysisAgent:
    """The only LLM agent in Iteration 2."""

    def __init__(
        self,
        *,
        provider: LLMProvider,
        maximum_content_chars: int,
    ) -> None:
        self.provider = provider
        self.maximum_content_chars = maximum_content_chars

    async def analyze(
        self,
        article: ScrapedArticle,
        *,
        feedback: str | None = None,
    ) -> StructuredResponse[AgentIncidentDraft]:
        response = await self.provider.structured_response(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=build_article_prompt(
                article,
                maximum_content_chars=self.maximum_content_chars,
                feedback=feedback,
            ),
            response_model=AgentIncidentDraft,
        )
        return StructuredResponse(output=response.output, usage=response.usage)

    async def aclose(self) -> None:
        await self.provider.aclose()
