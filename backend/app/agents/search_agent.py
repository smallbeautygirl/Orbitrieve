from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator

from anthropic import AsyncAnthropic

from app.core.exceptions import AgentError
from app.models.chat import ChatMessage
from app.prompts.search_agent import SYSTEM_PROMPT_TEMPLATE, format_search_results
from app.services.tavily import TavilyService

logger = logging.getLogger(__name__)


class SearchAgent:
    def __init__(self, client: AsyncAnthropic, tavily: TavilyService) -> None:
        self._client = client
        self._tavily = tavily

    async def run(
        self, message: str, history: list[ChatMessage]
    ) -> AsyncGenerator[str, None]:
        yield json.dumps({"type": "searching", "content": "Searching the web..."})

        sources = await self._tavily.search(message)
        logger.info("Search complete", extra={"source_count": len(sources)})

        yield json.dumps({"type": "writing", "content": "Writing answer..."})

        system = SYSTEM_PROMPT_TEMPLATE.format(
            question=message,
            search_results=format_search_results(sources),
        )

        try:
            async with self._client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                system=system,
                messages=[{"role": "user", "content": message}],
            ) as stream:
                async for text in stream.text_stream:
                    yield json.dumps({"type": "token", "content": text})
        except Exception as e:
            raise AgentError("Search agent synthesis failed") from e

        yield json.dumps(
            {"type": "sources", "sources": [s.model_dump() for s in sources]}
        )
        yield json.dumps({"type": "done"})
