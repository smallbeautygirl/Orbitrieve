from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock
from anthropic import AsyncAnthropic


@pytest.fixture
def mock_anthropic() -> AsyncAnthropic:
    return MagicMock(spec=AsyncAnthropic)


@pytest.fixture
def mock_tavily_results() -> list[dict]:
    return [
        {"title": "AAPL Stock", "url": "https://example.com/aapl", "content": "Apple stock is $213.42"},
        {"title": "Yahoo Finance", "url": "https://finance.yahoo.com", "content": "AAPL up 1.2% today"},
    ]
