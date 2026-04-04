from __future__ import annotations

import json
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.agents.search_agent import SearchAgent
from app.core.exceptions import SearchError, AgentError
from app.models.chat import Source
from app.services.tavily import TavilyService


def make_mock_sources() -> list[Source]:
    return [
        Source(index=1, title="Yahoo Finance", url="https://finance.yahoo.com", snippet="AAPL $213"),
        Source(index=2, title="Reuters", url="https://reuters.com", snippet="Apple up 1%"),
    ]


def make_mock_client_with_stream(tokens: list[str]):
    """Create AsyncAnthropic mock that streams given tokens."""
    client = MagicMock()

    async def mock_text_stream():
        for t in tokens:
            yield t

    mock_stream = MagicMock()
    mock_stream.text_stream = mock_text_stream()
    mock_stream.__aenter__ = AsyncMock(return_value=mock_stream)
    mock_stream.__aexit__ = AsyncMock(return_value=False)
    client.messages = MagicMock()
    client.messages.stream = MagicMock(return_value=mock_stream)
    return client


async def test_search_agent_yields_searching_then_writing_events():
    sources = make_mock_sources()
    mock_tavily = MagicMock(spec=TavilyService)
    mock_tavily.search = AsyncMock(return_value=sources)
    client = make_mock_client_with_stream(["Apple ", "is $213 [1]"])
    agent = SearchAgent(client=client, tavily=mock_tavily)
    events = []
    async for raw in agent.run("Apple stock?", []):
        events.append(json.loads(raw))
    types = [e["type"] for e in events]
    assert "searching" in types
    assert "writing" in types
    assert "token" in types
    assert "sources" in types
    assert "done" in types


async def test_search_agent_answer_contains_citation_markers():
    sources = make_mock_sources()
    mock_tavily = MagicMock(spec=TavilyService)
    mock_tavily.search = AsyncMock(return_value=sources)
    client = make_mock_client_with_stream(["Apple is $213 [1], up 1% [2]"])
    agent = SearchAgent(client=client, tavily=mock_tavily)
    tokens = []
    async for raw in agent.run("Apple stock?", []):
        event = json.loads(raw)
        if event["type"] == "token":
            tokens.append(event["content"])
    full_answer = "".join(tokens)
    assert "[1]" in full_answer


async def test_search_agent_raises_search_error_when_tavily_fails():
    mock_tavily = MagicMock(spec=TavilyService)
    mock_tavily.search = AsyncMock(side_effect=SearchError("Tavily down"))
    client = MagicMock()
    agent = SearchAgent(client=client, tavily=mock_tavily)
    with pytest.raises(SearchError):
        async for _ in agent.run("Apple stock?", []):
            pass
