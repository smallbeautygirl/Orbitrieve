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
    async def search(self, query: str, max_results: int = 5) -> list[Source]:
        logger.info("Tavily search query", extra={"query": query})
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    _TAVILY_URL,
                    json={
                        "api_key": settings.tavily_api_key,
                        "query": query,
                        "max_results": max_results,
                        "include_answer": False,
                    },
                )
                resp.raise_for_status()
                results = resp.json().get("results", [])
                sources = [
                    Source(
                        index=i + 1,
                        title=r.get("title", ""),
                        url=r.get("url", ""),
                        snippet=r.get("content", ""),
                    )
                    for i, r in enumerate(results)
                ]
                logger.info("Tavily search complete", extra={"result_count": len(sources)})
                return sources
        except httpx.TimeoutException as e:
            raise SearchError("Tavily search timed out") from e
        except httpx.HTTPStatusError as e:
            raise SearchError(f"Tavily returned {e.response.status_code}") from e
        except httpx.RequestError as e:
            raise SearchError("Tavily request failed") from e
