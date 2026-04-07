# backend/app/api/chat.py
from __future__ import annotations

import json
import logging
import time
from collections.abc import AsyncGenerator

from openai import AsyncOpenAI
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis

from app.agents.orchestrator import OrchestratorAgent
from app.agents.search_agent import SearchAgent
from app.core.config import settings
from app.core.exceptions import AgentError, SearchError
from app.models.chat import ChatMessage, ChatRequest
from app.services.redis_service import RedisService
from app.services.tavily import TavilyService

logger = logging.getLogger(__name__)
router = APIRouter()

_openai_client = AsyncOpenAI(
    api_key=settings.llm_api_key or settings.gemini_api_key,
    base_url=settings.llm_base_url,
    max_retries=2,
)
_tavily_service = TavilyService()


def _get_redis() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=False)


async def _generate_stream(request: ChatRequest) -> AsyncGenerator[str, None]:
    start = time.monotonic()
    redis = _get_redis()
    redis_svc = RedisService(redis=redis)

    try:
        history = await redis_svc.get_history(request.conversation_id)
        logger.info(
            "Chat request received",
            extra={
                "conversation_id": request.conversation_id,
                "message_length": len(request.message),
            },
        )

        orchestrator = OrchestratorAgent(client=_openai_client)

        yield f"data: {json.dumps({'type': 'thinking', 'content': 'Thinking...'})}\n\n"

        decision = await orchestrator.decide(request.message, history)

        full_response: list[str] = []

        if decision.needs_search:
            search_agent = SearchAgent(client=_openai_client, tavily=_tavily_service)
            async for event_str in search_agent.run(request.message, history):
                event = json.loads(event_str)
                if event["type"] == "token" and event.get("content"):
                    full_response.append(event["content"])
                yield f"data: {event_str}\n\n"
        else:
            async for event_str in orchestrator.answer_directly(request.message, history):
                event = json.loads(event_str)
                if event["type"] == "token" and event.get("content"):
                    full_response.append(event["content"])
                yield f"data: {event_str}\n\n"

        assistant_content = "".join(full_response)
        await redis_svc.append_turn(
            request.conversation_id,
            ChatMessage(role="user", content=request.message),
            ChatMessage(role="assistant", content=assistant_content),
        )

        elapsed_ms = int((time.monotonic() - start) * 1000)
        logger.info("Chat request complete", extra={"duration_ms": elapsed_ms})

    except SearchError as e:
        logger.warning("Search failed", extra={"error": str(e)})
        yield f"data: {json.dumps({'type': 'error', 'code': 'SEARCH_FAILED', 'error': str(e)})}\n\n"
    except AgentError as e:
        logger.error("Agent failed", extra={"error": str(e)})
        yield f"data: {json.dumps({'type': 'error', 'code': 'AGENT_FAILED', 'error': str(e)})}\n\n"
    except Exception:
        logger.exception("Unexpected error in chat stream")
        yield f"data: {json.dumps({'type': 'error', 'code': 'INTERNAL_ERROR', 'error': 'Unexpected error'})}\n\n"
    finally:
        await redis.aclose()


@router.post("/api/chat")
async def chat(request: ChatRequest) -> StreamingResponse:
    return StreamingResponse(
        _generate_stream(request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/api/health")
async def health() -> dict:
    redis = _get_redis()
    try:
        await redis.ping()
        redis_status = "ok"
    except Exception:
        redis_status = "error"
    finally:
        await redis.aclose()
    return {"status": "ok", "redis": redis_status, "version": "1.0.0"}
