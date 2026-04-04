# backend/app/agents/orchestrator.py
from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator
from dataclasses import dataclass

from anthropic import AsyncAnthropic

from app.core.exceptions import AgentError
from app.models.chat import ChatMessage
from app.prompts.orchestrator import DIRECT_ANSWER_SYSTEM, ROUTE_TOOL, SYSTEM_PROMPT

logger = logging.getLogger(__name__)


@dataclass
class RouteDecision:
    needs_search: bool
    reason: str


class OrchestratorAgent:
    def __init__(self, client: AsyncAnthropic) -> None:
        self._client = client

    async def decide(self, message: str, history: list[ChatMessage]) -> RouteDecision:
        messages = [
            *[{"role": m.role, "content": m.content} for m in history],
            {"role": "user", "content": message},
        ]
        try:
            response = await self._client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=256,
                system=SYSTEM_PROMPT,
                tools=[ROUTE_TOOL],
                tool_choice={"type": "any"},
                messages=messages,
            )
        except Exception as e:
            raise AgentError("Orchestrator failed to classify intent") from e

        for block in response.content:
            if block.type == "tool_use" and block.name == "route_decision":
                logger.info(
                    "Routing decision",
                    extra={
                        "needs_search": block.input["needs_search"],
                        "reason": block.input["reason"],
                    },
                )
                return RouteDecision(
                    needs_search=block.input["needs_search"],
                    reason=block.input["reason"],
                )

        raise AgentError("Orchestrator did not call route_decision tool")

    async def answer_directly(
        self, message: str, history: list[ChatMessage]
    ) -> AsyncGenerator[str, None]:
        messages = [
            *[{"role": m.role, "content": m.content} for m in history],
            {"role": "user", "content": message},
        ]
        try:
            async with self._client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                system=DIRECT_ANSWER_SYSTEM,
                messages=messages,
            ) as stream:
                async for text in stream.text_stream:
                    yield json.dumps({"type": "token", "content": text})
        except Exception as e:
            raise AgentError("Orchestrator direct answer failed") from e
        yield json.dumps({"type": "done"})
