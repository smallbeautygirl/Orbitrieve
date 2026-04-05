from __future__ import annotations

import json
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.agents.orchestrator import OrchestratorAgent, RouteDecision
from app.core.exceptions import AgentError
from app.models.chat import ChatMessage


def make_tool_call_response(needs_search: bool, reason: str):
    tool_call = MagicMock()
    tool_call.function = MagicMock()
    tool_call.function.name = "route_decision"
    tool_call.function.arguments = json.dumps({"needs_search": needs_search, "reason": reason})
    message = MagicMock()
    message.tool_calls = [tool_call]
    choice = MagicMock()
    choice.message = message
    response = MagicMock()
    response.choices = [choice]
    return response


def make_mock_client(response):
    client = MagicMock()
    client.chat = MagicMock()
    client.chat.completions = MagicMock()
    client.chat.completions.create = AsyncMock(return_value=response)
    return client


async def test_orchestrator_triggers_search_for_stock_price_query():
    response = make_tool_call_response(True, "Question asks about current stock price")
    client = make_mock_client(response)
    agent = OrchestratorAgent(client=client)
    decision = await agent.decide("What is Apple's stock price today?", [])
    assert decision.needs_search is True


async def test_orchestrator_does_not_search_for_general_knowledge():
    response = make_tool_call_response(False, "Math question, no web search needed")
    client = make_mock_client(response)
    agent = OrchestratorAgent(client=client)
    decision = await agent.decide("What is 2 + 2?", [])
    assert decision.needs_search is False


async def test_orchestrator_raises_agent_error_when_api_fails():
    client = MagicMock()
    client.chat = MagicMock()
    client.chat.completions = MagicMock()
    client.chat.completions.create = AsyncMock(side_effect=Exception("API down"))
    agent = OrchestratorAgent(client=client)
    with pytest.raises(AgentError):
        await agent.decide("Hello", [])


async def test_orchestrator_raises_agent_error_when_tool_not_called():
    message = MagicMock()
    message.tool_calls = None
    choice = MagicMock()
    choice.message = message
    response = MagicMock()
    response.choices = [choice]
    client = make_mock_client(response)
    agent = OrchestratorAgent(client=client)
    with pytest.raises(AgentError, match="did not call"):
        await agent.decide("Hello", [])
