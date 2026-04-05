# backend/app/agents/orchestrator.py
from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator
from dataclasses import dataclass

from openai import AsyncOpenAI

from app.core.config import settings
from app.core.exceptions import AgentError
from app.models.chat import ChatMessage
from app.prompts.orchestrator import DIRECT_ANSWER_SYSTEM, ROUTE_TOOL, SYSTEM_PROMPT

logger = logging.getLogger(__name__)


@dataclass
class RouteDecision:
    needs_search: bool
    reason: str


class OrchestratorAgent:
    def __init__(self, client: AsyncOpenAI) -> None:
        self._client = client

    async def decide(self, message: str, history: list[ChatMessage]) -> RouteDecision:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            *[{"role": m.role, "content": m.content} for m in history],
            {"role": "user", "content": message},
        ]
        try:
            response = await self._client.chat.completions.create(
                model=settings.llm_model,
                max_tokens=256,
                tools=[ROUTE_TOOL],
                tool_choice={"type": "function", "function": {"name": "route_decision"}},
                messages=messages,
            )
        except Exception as e:
            raise AgentError("Orchestrator failed to classify intent") from e

        tool_calls = response.choices[0].message.tool_calls
        if tool_calls and tool_calls[0].function.name == "route_decision":
            args = json.loads(tool_calls[0].function.arguments)
            logger.info(
                "Routing decision",
                extra={"needs_search": args["needs_search"], "reason": args["reason"]},
            )
            return RouteDecision(needs_search=args["needs_search"], reason=args["reason"])

        raise AgentError("Orchestrator did not call route_decision tool")

    async def answer_directly(
        self, message: str, history: list[ChatMessage]
    ) -> AsyncGenerator[str, None]:
        messages = [
            {"role": "system", "content": DIRECT_ANSWER_SYSTEM},
            *[{"role": m.role, "content": m.content} for m in history],
            {"role": "user", "content": message},
        ]
        try:
            stream = await self._client.chat.completions.create(
                model=settings.llm_model,
                max_tokens=1024,
                messages=messages,
                stream=True,
            )
            async for chunk in stream:
                text = chunk.choices[0].delta.content
                if text:
                    yield json.dumps({"type": "token", "content": text})
        except Exception as e:
            raise AgentError("Orchestrator direct answer failed") from e
        yield json.dumps({"type": "done"})
