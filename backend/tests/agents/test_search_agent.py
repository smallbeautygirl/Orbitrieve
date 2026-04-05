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


def make_mock_client(tokens: list[str], suggestions_text: str = "What next?\nTell me more"):
    """Create AsyncOpenAI mock: first create() call streams tokens, second returns suggestions."""
    client = MagicMock()

    async def async_chunks():
        for token in tokens:
            chunk = MagicMock()
            chunk.choices = [MagicMock()]
            chunk.choices[0].delta.content = token
            yield chunk

    suggestion_response = MagicMock()
    suggestion_response.choices = [MagicMock()]
    suggestion_response.choices[0].message.content = suggestions_text

    client.chat = MagicMock()
    client.chat.completions = MagicMock()
    client.chat.completions.create = AsyncMock(side_effect=[async_chunks(), suggestion_response])
    return client


async def test_search_agent_yields_searching_then_writing_events():
    sources = make_mock_sources()
    mock_tavily = MagicMock(spec=TavilyService)
    mock_tavily.search = AsyncMock(return_value=sources)
    client = make_mock_client(["Apple ", "is $213 [1]"])
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
    client = make_mock_client(["Apple is $213 [1], up 1% [2]"])
    agent = SearchAgent(client=client, tavily=mock_tavily)
    tokens = []
    async for raw in agent.run("Apple stock?", []):
        event = json.loads(raw)
        if event["type"] == "token":
            tokens.append(event["content"])
    full_answer = "".join(tokens)
    assert "[1]" in full_answer


async def test_search_agent_emits_suggestions_event():
    sources = make_mock_sources()
    mock_tavily = MagicMock(spec=TavilyService)
    mock_tavily.search = AsyncMock(return_value=sources)
    client = make_mock_client(["Apple ", "is $213 [1]"], suggestions_text="What drives AAPL?\nHow does it compare to MSFT?")
    agent = SearchAgent(client=client, tavily=mock_tavily)

    events = []
    async for raw in agent.run("Apple stock?", []):
        events.append(json.loads(raw))

    types = [e["type"] for e in events]
    assert "suggestions" in types

    suggestions_event = next(e for e in events if e["type"] == "suggestions")
    assert isinstance(suggestions_event["suggestions"], list)
    assert len(suggestions_event["suggestions"]) > 0


async def test_search_agent_raises_search_error_when_tavily_fails():
    mock_tavily = MagicMock(spec=TavilyService)
    mock_tavily.search = AsyncMock(side_effect=SearchError("Tavily down"))
    client = MagicMock()
    agent = SearchAgent(client=client, tavily=mock_tavily)
    with pytest.raises(SearchError):
        async for _ in agent.run("Apple stock?", []):
            pass
