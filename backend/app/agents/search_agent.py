from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator

from openai import AsyncOpenAI

from app.core.config import settings
from app.core.exceptions import AgentError
from app.models.chat import ChatMessage
from app.prompts.search_agent import SYSTEM_PROMPT_TEMPLATE, format_search_results
from app.services.tavily import TavilyService

logger = logging.getLogger(__name__)


class SearchAgent:
    def __init__(self, client: AsyncOpenAI, tavily: TavilyService) -> None:
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

        full_answer = ""
        try:
            stream = await self._client.chat.completions.create(
                model=settings.llm_model,
                max_tokens=1024,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": message},
                ],
                stream=True,
            )
            async for chunk in stream:
                text = chunk.choices[0].delta.content
                if text:
                    full_answer += text
                    yield json.dumps({"type": "token", "content": text})
        except Exception as e:
            raise AgentError("Search agent synthesis failed") from e

        yield json.dumps(
            {"type": "sources", "sources": [s.model_dump() for s in sources]}
        )

        suggestions = await self._generate_suggestions(message, full_answer)
        yield json.dumps({"type": "suggestions", "suggestions": suggestions})

        yield json.dumps({"type": "done"})

    async def _generate_suggestions(self, question: str, answer: str) -> list[str]:
        prompt = (
            "Based on this Q&A, write exactly 2 short follow-up questions a curious reader would ask. "
            "Output only the 2 questions, one per line, no numbering, no extra text.\n\n"
            f"Q: {question}\nA: {answer[:500]}"
        )
        try:
            response = await self._client.chat.completions.create(
                model=settings.llm_model,
                max_tokens=120,
                messages=[{"role": "user", "content": prompt}],
                stream=False,
            )
            content = response.choices[0].message.content or ""
            lines = [line.strip() for line in content.strip().splitlines() if line.strip()]
            return lines[:3]
        except Exception:
            logger.warning("Failed to generate follow-up suggestions")
            return []
