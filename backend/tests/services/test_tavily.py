# backend/tests/services/test_tavily.py
from __future__ import annotations
import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.tavily import TavilyService
from app.core.exceptions import SearchError


@pytest.fixture
def svc():
    return TavilyService()


async def test_search_returns_sources_on_success(svc):
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {
        "results": [
            {"title": "AAPL", "url": "https://finance.yahoo.com", "content": "Apple is $213"},
            {"title": "Reuters", "url": "https://reuters.com", "content": "AAPL up 1%"},
        ]
    }
    with patch("app.services.tavily.httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_client
        results = await svc.search("Apple stock price")
    assert len(results) == 2
    assert results[0].index == 1
    assert results[0].title == "AAPL"
    assert results[1].index == 2


async def test_search_raises_search_error_on_timeout(svc):
    with patch("app.services.tavily.httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        mock_client_class.return_value = mock_client
        with pytest.raises(SearchError, match="timed out"):
            await svc.search("some query")


async def test_search_raises_search_error_on_http_error(svc):
    mock_response = MagicMock()
    mock_response.status_code = 429
    with patch("app.services.tavily.httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(
            side_effect=httpx.HTTPStatusError("rate limited", request=MagicMock(), response=mock_response)
        )
        mock_client_class.return_value = mock_client
        with pytest.raises(SearchError):
            await svc.search("some query")
