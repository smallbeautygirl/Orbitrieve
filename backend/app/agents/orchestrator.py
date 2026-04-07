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
        # routing only needs recent context; truncate to last 3 messages to stay within token limits
        recent = history[-3:] if len(history) > 3 else history
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            *[{"role": m.role, "content": m.content} for m in recent],
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
            logger.error("Orchestrator classify error", extra={"type": type(e).__name__, "error": str(e)})
            raise AgentError("Orchestrator failed to classify intent") from e

        tool_calls = response.choices[0].message.tool_calls
        logger.debug("Orchestrator raw response", extra={"response": str(response)})
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
        recent = history[-10:] if len(history) > 10 else history
        messages = [
            {"role": "system", "content": DIRECT_ANSWER_SYSTEM},
            *[{"role": m.role, "content": m.content} for m in recent],
            {"role": "user", "content": message},
        ]
        try:
            stream = await self._client.chat.completions.create(
                model=settings.llm_model,
                max_tokens=1024,
                messages=messages,
                stream=True,
            )
            full_answer = ""
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
            logger.debug("Orchestrator direct answer", extra={"answer": full_answer})
        except Exception as e:
            raise AgentError("Orchestrator direct answer failed") from e
        yield json.dumps({"type": "done"})
