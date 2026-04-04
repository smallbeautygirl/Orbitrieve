# backend/tests/agents/test_orchestrator.py
from __future__ import annotations
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.agents.orchestrator import OrchestratorAgent, RouteDecision
from app.core.exceptions import AgentError
from app.models.chat import ChatMessage


def make_tool_use_response(needs_search: bool, reason: str):
    block = MagicMock()
    block.type = "tool_use"
    block.name = "route_decision"
    block.input = {"needs_search": needs_search, "reason": reason}
    response = MagicMock()
    response.content = [block]
    return response


def make_mock_client(response):
    client = MagicMock()
    client.messages = MagicMock()
    client.messages.create = AsyncMock(return_value=response)
    return client


async def test_orchestrator_triggers_search_for_stock_price_query():
    response = make_tool_use_response(True, "Question asks about current stock price")
    client = make_mock_client(response)
    agent = OrchestratorAgent(client=client)
    decision = await agent.decide("What is Apple's stock price today?", [])
    assert decision.needs_search is True


async def test_orchestrator_does_not_search_for_general_knowledge():
    response = make_tool_use_response(False, "Math question, no web search needed")
    client = make_mock_client(response)
    agent = OrchestratorAgent(client=client)
    decision = await agent.decide("What is 2 + 2?", [])
    assert decision.needs_search is False


async def test_orchestrator_raises_agent_error_when_api_fails():
    client = MagicMock()
    client.messages = MagicMock()
    client.messages.create = AsyncMock(side_effect=Exception("API down"))
    agent = OrchestratorAgent(client=client)
    with pytest.raises(AgentError):
        await agent.decide("Hello", [])


async def test_orchestrator_raises_agent_error_when_tool_not_called():
    block = MagicMock()
    block.type = "text"  # not tool_use
    response = MagicMock()
    response.content = [block]
    client = make_mock_client(response)
    agent = OrchestratorAgent(client=client)
    with pytest.raises(AgentError, match="did not call"):
        await agent.decide("Hello", [])
