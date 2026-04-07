# backend/app/services/tavily.py
from __future__ import annotations

import logging

import httpx

from app.core.config import settings
from app.core.exceptions import SearchError
from app.models.chat import Source

logger = logging.getLogger(__name__)

_TAVILY_URL = "https://api.tavily.com/search"


class TavilyService:
    async def search(self, query: str, topic: str = "general") -> list[Source]:
        logger.info("Tavily search query", extra={"query": query, "topic": topic})
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    _TAVILY_URL,
                    json={
                        "api_key": settings.tavily_api_key,
                        "query": query,
                        "max_results": settings.tavily_max_results,
                        "search_depth": "advanced",
                        "include_answer": False,
                        "include_raw_content": False,
                        "topic": topic,
                    },
                )
                resp.raise_for_status()
                results = resp.json().get("results", [])
                filtered = [r for r in results if r.get("score", 0) >= settings.tavily_score_threshold]
                sources = [
                    Source(
                        index=i + 1,
                        title=r.get("title", ""),
                        url=r.get("url", ""),
                        snippet=r.get("content", ""),
                    )
                    for i, r in enumerate(filtered)
                ]
                logger.info(
                    "Tavily search complete",
                    extra={"result_count": len(sources), "filtered_out": len(results) - len(filtered)},
                )
                return sources
        except httpx.TimeoutException as e:
            raise SearchError("Tavily search timed out") from e
        except httpx.HTTPStatusError as e:
            raise SearchError(f"Tavily returned {e.response.status_code}") from e
        except httpx.RequestError as e:
            raise SearchError("Tavily request failed") from e
