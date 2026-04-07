from __future__ import annotations

import asyncio
import json
import logging
import re
from collections.abc import AsyncGenerator

from openai import AsyncOpenAI, RateLimitError

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

        # query, topic = await self._refine_query(message)
        sources = await self._tavily.search(message)
        logger.info("Search complete", extra={"source_count": len(sources)})

        logger.debug("Search sources", extra={"sources": [s.model_dump() for s in sources]})
        yield json.dumps({"type": "writing", "content": "Writing answer..."})

        system = SYSTEM_PROMPT_TEMPLATE.format(
            question=message,
            search_results=format_search_results(sources),
        )

        full_answer = ""
        for attempt in range(3):
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
                inside_think = False
                buf = ""
                async for chunk in stream:
                    if not chunk.choices:
                        continue
                    delta = chunk.choices[0].delta
                    raw = delta.content or ""
                    if not raw:
                        continue
                    buf += raw
                    # strip <think>...</think> blocks emitted by reasoning models
                    while buf:
                        if inside_think:
                            end = buf.find("</think>")
                            if end == -1:
                                buf = ""
                                break
                            buf = buf[end + len("</think>"):]
                            inside_think = False
                        else:
                            start = buf.find("<think>")
                            if start == -1:
                                full_answer += buf
                                yield json.dumps({"type": "token", "content": buf})
                                buf = ""
                                break
                            if start > 0:
                                visible = buf[:start]
                                full_answer += visible
                                yield json.dumps({"type": "token", "content": visible})
                            buf = buf[start + len("<think>"):]
                            inside_think = True
                logger.debug("Search agent full answer", extra={"answer": full_answer})
                break
            except RateLimitError:
                if attempt == 2:
                    raise AgentError("Search agent synthesis failed: rate limited") from None
                wait = 2 ** attempt
                logger.warning("Rate limited, retrying", extra={"attempt": attempt + 1, "wait_s": wait})
                await asyncio.sleep(wait)
            except Exception as e:
                logger.exception("Search agent synthesis error: %s: %s", type(e).__name__, e)
                raise AgentError("Search agent synthesis failed") from e

        cited_indices = {int(m) for m in re.findall(r"\[(\d+)\]", full_answer)}
        cited_sources = [s for s in sources if s.index in cited_indices]
        logger.info(
            "Citations extracted",
            extra={"cited_indices": sorted(cited_indices), "cited_count": len(cited_sources)},
        )
        yield json.dumps(
            {"type": "sources", "sources": [s.model_dump() for s in cited_sources]}
        )

        suggestions = await self._generate_suggestions(message, full_answer)
        yield json.dumps({"type": "suggestions", "suggestions": suggestions})

        yield json.dumps({"type": "done"})

    async def _refine_query(self, message: str) -> tuple[str, str]:
        """Return (refined_query, topic) where topic is 'news' or 'general'."""
        prompt = (
            "/no_think\n"
            "Given the user question below, output exactly two lines:\n"
            "Line 1: an optimised web search query (concise, keyword-focused, no filler words)\n"
            "Line 2: topic — output only 'news' if the question is about recent events/news, "
            "otherwise output 'general'\n\n"
            f"Question: {message}"
        )
        try:
            response = await self._client.chat.completions.create(
                model=settings.llm_model,
                max_tokens=60,
                messages=[{"role": "user", "content": prompt}],
                stream=False,
            )
            content = response.choices[0].message.content or ""
            lines = [line.strip() for line in content.strip().splitlines() if line.strip()]
            query = lines[0] if lines else message
            topic = "news" if len(lines) > 1 and "news" in lines[1].lower() else "general"
            return query, topic
        except Exception:
            logger.warning("Query refinement failed, using original message")
            return message, "general"

    async def _generate_suggestions(self, question: str, answer: str) -> list[str]:
        prompt = (
            "/no_think\n"
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
            content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL)
            lines = [
                line.strip()
                for line in content.strip().splitlines()
                if line.strip()
                and ("?" in line or "？" in line)
                and len(line.strip()) <= 60
            ]
            logger.debug("Generated suggestions", extra={"suggestions": lines[:2]})
            return lines[:2]
        except Exception:
            logger.warning("Failed to generate follow-up suggestions")
            return []
