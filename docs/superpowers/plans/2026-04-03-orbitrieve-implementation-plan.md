# Orbitrieve Web Search Chatbot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a streaming web-search chatbot with 2 collaborative AI Agents (Orchestrator + SearchAgent), citation-backed answers, React/TypeScript frontend, FastAPI backend, Redis conversation memory.

**Architecture:** Sequential pipeline — OrchestratorAgent uses Claude tool_use to decide if web search is needed, then routes to SearchAgent (Tavily + Claude synthesis) or answers directly. All responses stream via SSE. Conversation history persisted in Redis with 24h TTL.

**Tech Stack:** Python 3.12, FastAPI, Anthropic SDK (claude-sonnet-4-6), Tavily Search API, Redis 7, React 18, TypeScript, Vite, Zustand, docker-compose

**Spec:** `docs/superpowers/specs/2026-04-03-orbitrieve-web-search-chatbot-design.md`

---

## File Map

### Backend (new files)
```
backend/
├── pyproject.toml                          MODIFY — add all deps
├── app/
│   ├── __init__.py
│   ├── main.py                             CREATE — FastAPI app factory
│   ├── api/
│   │   ├── __init__.py
│   │   └── chat.py                         CREATE — POST /api/chat, GET /api/health
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── orchestrator.py                 CREATE — OrchestratorAgent (decide + answer_directly)
│   │   └── search_agent.py                 CREATE — SearchAgent (Tavily + synthesis)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── tavily.py                       CREATE — TavilyService
│   │   └── redis_service.py                CREATE — RedisService (history get/append/clear)
│   ├── models/
│   │   ├── __init__.py
│   │   └── chat.py                         CREATE — ChatRequest, ChatMessage, Source
│   ├── prompts/
│   │   ├── __init__.py
│   │   ├── orchestrator.py                 CREATE — system prompt + tool schema
│   │   └── search_agent.py                 CREATE — system prompt + result formatter
│   └── core/
│       ├── __init__.py
│       ├── config.py                       CREATE — pydantic-settings
│       ├── exceptions.py                   CREATE — OrbitrieveError, SearchError, AgentError
│       ├── logging.py                      CREATE — logging setup
│       └── middleware.py                   CREATE — CORS
├── tests/
│   ├── conftest.py                         CREATE — shared fixtures
│   ├── api/
│   │   └── test_chat.py                    CREATE
│   ├── agents/
│   │   ├── test_orchestrator.py            CREATE
│   │   └── test_search_agent.py            CREATE
│   └── services/
│       └── test_tavily.py                  CREATE
└── docker/
    └── Dockerfile                          CREATE
```

### Frontend (new files)
```
frontend/
├── package.json                            CREATE
├── vite.config.ts                          CREATE
├── tsconfig.json                           CREATE
├── index.html                              CREATE
├── src/
│   ├── main.tsx
│   ├── App.tsx                             CREATE
│   ├── types/
│   │   └── chat.ts                         CREATE — all TS interfaces
│   ├── styles/
│   │   └── theme.ts                        CREATE — color tokens
│   ├── store/
│   │   └── chatStore.ts                    CREATE — Zustand store
│   ├── api/
│   │   └── chatApi.ts                      CREATE — SSE fetch + parser
│   ├── hooks/
│   │   ├── useConversation.ts              CREATE — conversation_id from localStorage
│   │   └── useChat.ts                      CREATE — orchestrates store + chatApi
│   └── components/
│       ├── OrbitrieveIcon.tsx              CREATE — SVG logo
│       ├── Header.tsx                      CREATE
│       ├── ChatInput.tsx                   CREATE
│       ├── ThinkingIndicator.tsx           CREATE
│       ├── CitationLink.tsx                CREATE
│       ├── SourceCard.tsx                  CREATE
│       ├── SourceList.tsx                  CREATE
│       ├── MessageBubble.tsx               CREATE
│       ├── MessageList.tsx                 CREATE
│       └── __tests__/
│           ├── ChatInput.test.tsx
│           ├── MessageBubble.test.tsx
│           ├── SourceCard.test.tsx
│           └── useChat.test.ts
├── .env
└── docker/
    └── Dockerfile                          CREATE
```

### Root
```
docker-compose.yml                          CREATE
```

---

## Phase 1 — Backend Foundation

---

### Task 1: pyproject.toml + directory scaffold

**Files:**
- Modify: `backend/pyproject.toml`
- Create: `backend/app/__init__.py` and all `__init__.py` stubs
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Update pyproject.toml with all dependencies**

Replace `backend/pyproject.toml` entirely:

```toml
[project]
name = "orbitrieve-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "anthropic>=0.40",
    "tavily-python>=0.3",
    "redis[asyncio]>=5.0",
    "pydantic-settings>=2.0",
    "httpx>=0.27",
    "python-multipart>=0.0.9",
]

[tool.uv]
dev-dependencies = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "pytest-cov>=5.0",
    "httpx>=0.27",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.coverage.run]
source = ["app"]
omit = ["app/prompts/*"]
```

- [ ] **Step 2: Install dependencies**

```bash
cd backend && uv sync
```

Expected: dependencies installed into `.venv/`.

- [ ] **Step 3: Create directory structure + empty `__init__.py` files**

```bash
cd backend && mkdir -p app/{api,agents,services,models,prompts,core} tests/{api,agents,services}
touch app/__init__.py app/api/__init__.py app/agents/__init__.py
touch app/services/__init__.py app/models/__init__.py app/prompts/__init__.py app/core/__init__.py
touch tests/__init__.py tests/api/__init__.py tests/agents/__init__.py tests/services/__init__.py
```

- [ ] **Step 4: Create `tests/conftest.py`**

```python
# backend/tests/conftest.py
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
```

- [ ] **Step 5: Commit**

```bash
cd backend
git add pyproject.toml app/ tests/
git commit -m "chore(deps): 🔧 scaffold backend structure and add all dependencies"
```

---

### Task 2: Core config, exceptions, logging

**Files:**
- Create: `backend/app/core/config.py`
- Create: `backend/app/core/exceptions.py`
- Create: `backend/app/core/logging.py`

- [ ] **Step 1: Create `app/core/exceptions.py`**

```python
# backend/app/core/exceptions.py
from __future__ import annotations


class OrbitrieveError(Exception):
    """Base exception for all Orbitrieve errors."""


class SearchError(OrbitrieveError):
    """Raised when Tavily search fails."""


class AgentError(OrbitrieveError):
    """Raised when a Claude agent call fails."""
```

- [ ] **Step 2: Create `app/core/config.py`**

```python
# backend/app/core/config.py
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    anthropic_api_key: str = ""
    tavily_api_key: str = ""
    redis_url: str = "redis://localhost:6379"
    cors_origins: list[str] = ["http://localhost:5173"]
    port: int = 8000
    log_level: str = "INFO"


settings = Settings()
```

- [ ] **Step 3: Create `app/core/logging.py`**

```python
# backend/app/core/logging.py
from __future__ import annotations

import logging
import sys

from app.core.config import settings


def setup_logging() -> None:
    logging.basicConfig(
        stream=sys.stdout,
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)-8s %(name)s %(message)s",
    )
```

- [ ] **Step 4: Verify imports work**

```bash
cd backend && uv run python -c "from app.core.config import settings; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add app/core/
git commit -m "feat(config): ✨ add settings, exceptions, and logging setup"
```

---

### Task 3: Pydantic models

**Files:**
- Create: `backend/app/models/chat.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_models.py
from __future__ import annotations
import pytest
from pydantic import ValidationError
from app.models.chat import ChatRequest, ChatMessage, Source


def test_chat_request_rejects_empty_message():
    with pytest.raises(ValidationError):
        ChatRequest(message="", conversation_id="abc123", history=[])


def test_chat_request_rejects_message_over_4000_chars():
    with pytest.raises(ValidationError):
        ChatRequest(message="x" * 4001, conversation_id="abc123", history=[])


def test_chat_request_valid():
    req = ChatRequest(message="Hello", conversation_id="abc123", history=[])
    assert req.message == "Hello"
    assert req.history == []


def test_source_model():
    s = Source(index=1, title="Reuters", url="https://reuters.com", snippet="News snippet")
    assert s.index == 1
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && uv run pytest tests/test_models.py -v
```

Expected: `ImportError` — module not found.

- [ ] **Step 3: Create `app/models/chat.py`**

```python
# backend/app/models/chat.py
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)


class Source(BaseModel):
    index: int
    title: str
    url: str
    snippet: str
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/test_models.py -v
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/models/chat.py tests/test_models.py
git commit -m "feat(api): ✨ add Pydantic models for ChatRequest, ChatMessage, Source"
```

---

### Task 4: RedisService

**Files:**
- Create: `backend/app/services/redis_service.py`
- Create: `backend/tests/services/test_redis_service.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/services/test_redis_service.py
from __future__ import annotations
import json
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.redis_service import RedisService
from app.models.chat import ChatMessage


@pytest.fixture
def mock_redis():
    r = MagicMock()
    r.get = AsyncMock(return_value=None)
    r.setex = AsyncMock()
    r.delete = AsyncMock()
    return r


@pytest.fixture
def svc(mock_redis):
    return RedisService(redis=mock_redis)


async def test_get_history_returns_empty_when_no_key(svc, mock_redis):
    mock_redis.get.return_value = None
    result = await svc.get_history("conv-123")
    assert result == []


async def test_get_history_returns_messages_from_redis(svc, mock_redis):
    stored = [{"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi"}]
    mock_redis.get.return_value = json.dumps(stored).encode()
    result = await svc.get_history("conv-123")
    assert len(result) == 2
    assert result[0].role == "user"
    assert result[1].content == "Hi"


async def test_append_turn_calls_setex_with_ttl(svc, mock_redis):
    mock_redis.get.return_value = None
    user_msg = ChatMessage(role="user", content="What's the weather?")
    assistant_msg = ChatMessage(role="assistant", content="It's sunny.")
    await svc.append_turn("conv-123", user_msg, assistant_msg)
    mock_redis.setex.assert_called_once()
    args = mock_redis.setex.call_args[0]
    assert args[0] == "conversation:conv-123"
    assert args[1] == 86400


async def test_append_turn_truncates_history_over_40_messages(svc, mock_redis):
    old_history = [{"role": "user", "content": f"msg {i}"} for i in range(40)]
    mock_redis.get.return_value = json.dumps(old_history).encode()
    user_msg = ChatMessage(role="user", content="new")
    assistant_msg = ChatMessage(role="assistant", content="reply")
    await svc.append_turn("conv-123", user_msg, assistant_msg)
    saved = json.loads(mock_redis.setex.call_args[0][2])
    assert len(saved) == 40


async def test_clear_deletes_key(svc, mock_redis):
    await svc.clear("conv-123")
    mock_redis.delete.assert_called_once_with("conversation:conv-123")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/services/test_redis_service.py -v
```

Expected: `ImportError`.

- [ ] **Step 3: Create `app/services/redis_service.py`**

```python
# backend/app/services/redis_service.py
from __future__ import annotations

import json
import logging

from redis.asyncio import Redis

from app.models.chat import ChatMessage

logger = logging.getLogger(__name__)

HISTORY_TTL = 86400  # 24 hours
MAX_HISTORY_MESSAGES = 40  # 20 turns


class RedisService:
    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def get_history(self, conversation_id: str) -> list[ChatMessage]:
        key = f"conversation:{conversation_id}"
        data = await self._redis.get(key)
        if data is None:
            return []
        return [ChatMessage(**m) for m in json.loads(data)]

    async def append_turn(
        self,
        conversation_id: str,
        user_msg: ChatMessage,
        assistant_msg: ChatMessage,
    ) -> None:
        key = f"conversation:{conversation_id}"
        history = await self.get_history(conversation_id)
        history.extend([user_msg, assistant_msg])
        if len(history) > MAX_HISTORY_MESSAGES:
            history = history[-MAX_HISTORY_MESSAGES:]
        payload = json.dumps([m.model_dump() for m in history])
        await self._redis.setex(key, HISTORY_TTL, payload)
        logger.debug("History appended", extra={"conversation_id": conversation_id, "length": len(history)})

    async def clear(self, conversation_id: str) -> None:
        await self._redis.delete(f"conversation:{conversation_id}")
        logger.info("History cleared", extra={"conversation_id": conversation_id})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/services/test_redis_service.py -v
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/services/redis_service.py tests/services/test_redis_service.py
git commit -m "feat(search): ✨ add RedisService for conversation history"
```

---

### Task 5: TavilyService

**Files:**
- Create: `backend/app/services/tavily.py`
- Create: `backend/tests/services/test_tavily.py`

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/services/test_tavily.py -v
```

Expected: `ImportError`.

- [ ] **Step 3: Create `app/services/tavily.py`**

```python
# backend/app/services/tavily.py
from __future__ import annotations

import logging

import httpx

from app.core.config import settings
from app.core.exceptions import SearchError
from app.models.chat import Source

logger = logging.getLogger(__name__)

_TAVILY_URL = "https://api.tavily.com/search"


class TavilyService:
    async def search(self, query: str, max_results: int = 5) -> list[Source]:
        logger.info("Tavily search query", extra={"query": query})
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    _TAVILY_URL,
                    json={
                        "api_key": settings.tavily_api_key,
                        "query": query,
                        "max_results": max_results,
                        "include_answer": False,
                    },
                )
                resp.raise_for_status()
                results = resp.json().get("results", [])
                sources = [
                    Source(
                        index=i + 1,
                        title=r.get("title", ""),
                        url=r.get("url", ""),
                        snippet=r.get("content", ""),
                    )
                    for i, r in enumerate(results)
                ]
                logger.info("Tavily search complete", extra={"result_count": len(sources)})
                return sources
        except httpx.TimeoutException as e:
            raise SearchError("Tavily search timed out") from e
        except httpx.HTTPStatusError as e:
            raise SearchError(f"Tavily returned {e.response.status_code}") from e
        except httpx.RequestError as e:
            raise SearchError("Tavily request failed") from e
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/services/test_tavily.py -v
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/services/tavily.py tests/services/test_tavily.py
git commit -m "feat(search): ✨ add TavilyService with error handling"
```

---

## Phase 2 — Agents

---

### Task 6: Agent prompts

**Files:**
- Create: `backend/app/prompts/orchestrator.py`
- Create: `backend/app/prompts/search_agent.py`

- [ ] **Step 1: Create `app/prompts/orchestrator.py`**

```python
# backend/app/prompts/orchestrator.py
from __future__ import annotations

SYSTEM_PROMPT = """\
You are a routing agent. Your ONLY job is to decide whether web search is needed.

Call the route_decision tool with:
- needs_search: true if the question requires current or live information — stock prices, \
crypto prices, news, weather, exchange rates, sports scores, or contains words like \
"today", "now", "current", "latest", "live", "price of", "rate of"
- needs_search: false for general knowledge, math, coding questions, definitions, \
or historical facts
- reason: one sentence explaining your decision
"""

ROUTE_TOOL: dict = {
    "name": "route_decision",
    "description": "Decide whether web search is needed to answer the user's question.",
    "input_schema": {
        "type": "object",
        "properties": {
            "needs_search": {
                "type": "boolean",
                "description": "True if web search is required.",
            },
            "reason": {
                "type": "string",
                "description": "Brief reason for the decision.",
            },
        },
        "required": ["needs_search", "reason"],
    },
}

DIRECT_ANSWER_SYSTEM = """\
You are a helpful, concise assistant. Answer the user's question directly and clearly.
Do not mention searching the web or any tools. Respond in the same language the user used.
"""
```

- [ ] **Step 2: Create `app/prompts/search_agent.py`**

```python
# backend/app/prompts/search_agent.py
from __future__ import annotations

from app.models.chat import Source

SYSTEM_PROMPT_TEMPLATE = """\
You are a research assistant. Answer the user's question using ONLY the provided search results.

Rules:
- For every fact you state, add an inline citation: [1] or [2] (matching source index).
- If multiple sources support a fact, cite all: [1][2].
- Do NOT add a "Sources:" section at the end — citations are handled separately.
- Be concise and accurate. Do not fabricate information not in the results.
- Respond in the same language the user used.

User question: {question}

Search results:
{search_results}
"""


def format_search_results(sources: list[Source]) -> str:
    lines: list[str] = []
    for s in sources:
        lines.append(f"[{s.index}] {s.title}\nURL: {s.url}\n{s.snippet}\n")
    return "\n".join(lines)
```

- [ ] **Step 3: Commit**

```bash
git add app/prompts/
git commit -m "feat(agents): ✨ add orchestrator and search agent prompts"
```

---

### Task 7: OrchestratorAgent

**Files:**
- Create: `backend/app/agents/orchestrator.py`
- Create: `backend/tests/agents/test_orchestrator.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/agents/test_orchestrator.py
from __future__ import annotations
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/agents/test_orchestrator.py -v
```

Expected: `ImportError`.

- [ ] **Step 3: Create `app/agents/orchestrator.py`**

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/agents/test_orchestrator.py -v
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/agents/orchestrator.py tests/agents/test_orchestrator.py
git commit -m "feat(orchestrator): ✨ add OrchestratorAgent with intent routing and direct answer"
```

---

### Task 8: SearchAgent

**Files:**
- Create: `backend/app/agents/search_agent.py`
- Create: `backend/tests/agents/test_search_agent.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/agents/test_search_agent.py
from __future__ import annotations
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, AsyncMock
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/agents/test_search_agent.py -v
```

Expected: `ImportError`.

- [ ] **Step 3: Create `app/agents/search_agent.py`**

```python
# backend/app/agents/search_agent.py
from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator

from anthropic import AsyncAnthropic

from app.core.exceptions import AgentError
from app.models.chat import ChatMessage
from app.prompts.search_agent import SYSTEM_PROMPT_TEMPLATE, format_search_results
from app.services.tavily import TavilyService

logger = logging.getLogger(__name__)


class SearchAgent:
    def __init__(self, client: AsyncAnthropic, tavily: TavilyService) -> None:
        self._client = client
        self._tavily = tavily

    async def run(
        self, message: str, history: list[ChatMessage]
    ) -> AsyncGenerator[str, None]:
        yield json.dumps({"type": "searching", "content": "Searching the web..."})

        sources = await self._tavily.search(message)
        logger.info("Search complete", extra={"source_count": len(sources)})

        yield json.dumps({"type": "writing", "content": "Writing answer..."})

        system = SYSTEM_PROMPT_TEMPLATE.format(
            question=message,
            search_results=format_search_results(sources),
        )

        try:
            async with self._client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                system=system,
                messages=[{"role": "user", "content": message}],
            ) as stream:
                async for text in stream.text_stream:
                    yield json.dumps({"type": "token", "content": text})
        except Exception as e:
            raise AgentError("Search agent synthesis failed") from e

        yield json.dumps(
            {"type": "sources", "sources": [s.model_dump() for s in sources]}
        )
        yield json.dumps({"type": "done"})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/agents/test_search_agent.py -v
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/agents/search_agent.py tests/agents/test_search_agent.py
git commit -m "feat(search): ✨ add SearchAgent with Tavily integration and streaming synthesis"
```

---

## Phase 3 — API Layer

---

### Task 9: FastAPI app + chat endpoint

**Files:**
- Create: `backend/app/main.py`
- Create: `backend/app/api/chat.py`
- Create: `backend/app/core/middleware.py`
- Create: `backend/tests/api/test_chat.py`
- Delete/replace: `backend/main.py`

- [ ] **Step 1: Create `app/core/middleware.py`**

```python
# backend/app/core/middleware.py
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings


def add_cors(app: FastAPI) -> None:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
```

- [ ] **Step 2: Create `app/api/chat.py`**

```python
# backend/app/api/chat.py
from __future__ import annotations

import json
import logging
import time
from collections.abc import AsyncGenerator

from anthropic import AsyncAnthropic
from fastapi import APIRouter, HTTPException
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

_anthropic_client = AsyncAnthropic(api_key=settings.anthropic_api_key)
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

        orchestrator = OrchestratorAgent(client=_anthropic_client)

        yield f"data: {json.dumps({'type': 'thinking', 'content': 'Thinking...'})}\n\n"

        decision = await orchestrator.decide(request.message, history)

        full_response: list[str] = []

        if decision.needs_search:
            search_agent = SearchAgent(client=_anthropic_client, tavily=_tavily_service)
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
    except Exception as e:
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
```

- [ ] **Step 3: Create `app/main.py`**

```python
# backend/app/main.py
from __future__ import annotations

from fastapi import FastAPI

from app.api.chat import router
from app.core.logging import setup_logging
from app.core.middleware import add_cors

setup_logging()

app = FastAPI(title="Orbitrieve", version="1.0.0")
add_cors(app)
app.include_router(router)
```

- [ ] **Step 4: Write the API tests**

```python
# backend/tests/api/test_chat.py
from __future__ import annotations
import json
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock, patch
from app.main import app


async def _collect_sse(response) -> list[dict]:
    events = []
    async for line in response.aiter_lines():
        if line.startswith("data: "):
            events.append(json.loads(line[6:]))
    return events


@pytest.fixture
def mock_redis_svc():
    svc = MagicMock()
    svc.get_history = AsyncMock(return_value=[])
    svc.append_turn = AsyncMock()
    return svc


async def test_chat_returns_sse_stream_for_valid_request():
    with (
        patch("app.api.chat.OrchestratorAgent") as mock_orch_cls,
        patch("app.api.chat.RedisService") as mock_redis_cls,
        patch("app.api.chat._get_redis"),
    ):
        mock_redis_cls.return_value.get_history = AsyncMock(return_value=[])
        mock_redis_cls.return_value.append_turn = AsyncMock()

        mock_orch = MagicMock()
        mock_orch_cls.return_value = mock_orch

        from app.agents.orchestrator import RouteDecision
        mock_orch.decide = AsyncMock(return_value=RouteDecision(needs_search=False, reason="simple"))

        async def mock_answer_directly(*args, **kwargs):
            yield json.dumps({"type": "token", "content": "Hello!"})
            yield json.dumps({"type": "done"})

        mock_orch.answer_directly = mock_answer_directly

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            async with client.stream(
                "POST",
                "/api/chat",
                json={"message": "Hello", "conversation_id": "test-uuid", "history": []},
            ) as response:
                assert response.status_code == 200
                assert "text/event-stream" in response.headers["content-type"]


async def test_chat_rejects_empty_message():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/chat",
            json={"message": "", "conversation_id": "test-uuid", "history": []},
        )
    assert response.status_code == 422


async def test_health_endpoint_returns_ok():
    with patch("app.api.chat._get_redis") as mock_get_redis:
        mock_redis = AsyncMock()
        mock_redis.ping = AsyncMock()
        mock_redis.aclose = AsyncMock()
        mock_get_redis.return_value = mock_redis
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
```

- [ ] **Step 5: Run all backend tests**

```bash
cd backend && uv run pytest -v
```

Expected: all tests pass.

- [ ] **Step 6: Replace root `main.py`**

Replace `backend/main.py` with:

```python
# backend/main.py
from __future__ import annotations

import uvicorn

from app.core.config import settings

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.port, reload=True)
```

- [ ] **Step 7: Create `backend/.env` (never commit this)**

```bash
cat > backend/.env << 'EOF'
ANTHROPIC_API_KEY=sk-ant-your-key-here
TAVILY_API_KEY=tvly-your-key-here
REDIS_URL=redis://localhost:6379
CORS_ORIGINS=["http://localhost:5173"]
PORT=8000
LOG_LEVEL=INFO
EOF
```

Verify `.env` is in `.gitignore`:
```bash
grep ".env" backend/.gitignore || echo ".env" >> .gitignore
```

- [ ] **Step 8: Commit**

```bash
git add app/main.py app/api/chat.py app/core/middleware.py main.py tests/api/test_chat.py
git commit -m "feat(api): ✨ add FastAPI chat endpoint with SSE streaming"
```

---

## Phase 4 — Frontend Foundation

---

### Task 10: Vite project setup + TypeScript types + theme

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/types/chat.ts`
- Create: `frontend/src/styles/theme.ts`
- Create: `frontend/.env`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "orbitrieve-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^24.0.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Install frontend dependencies**

```bash
cd frontend && npm install
```

Expected: `node_modules/` created.

- [ ] **Step 3: Create `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

- [ ] **Step 4: Create `frontend/src/test-setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Create `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Orbitrieve</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `frontend/src/types/chat.ts`**

```typescript
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface Source {
  index: number
  title: string
  url: string
  snippet: string
}

export type Stage = 'thinking' | 'searching' | 'writing' | null

export type SSEEventType =
  | 'thinking'
  | 'searching'
  | 'writing'
  | 'token'
  | 'sources'
  | 'done'
  | 'error'

export interface SSEEvent {
  type: SSEEventType
  content?: string
  sources?: Source[]
  code?: string
  error?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}

export interface ChatRequest {
  message: string
  conversation_id: string
  history: ChatMessage[]
}
```

- [ ] **Step 8: Create `frontend/src/styles/theme.ts`**

```typescript
export const theme = {
  colors: {
    primary: '#F5C518',
    primaryLight: '#FFF8DC',
    primaryHover: '#E6B800',
    surface: '#FFFFFF',
    surfaceAlt: '#F9F9F9',
    textPrimary: '#1A1A1A',
    textMuted: '#6B7280',
    border: '#E5E7EB',
  },
  fonts: {
    base: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  radii: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    full: '9999px',
  },
} as const
```

- [ ] **Step 9: Create `frontend/src/main.tsx`**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 10: Create `frontend/.env`**

```
VITE_API_BASE_URL=http://localhost:8000
```

- [ ] **Step 11: Commit**

```bash
cd frontend
git add package.json vite.config.ts tsconfig.json index.html src/
git commit -m "feat(ui): ✨ scaffold React/TypeScript frontend with types and theme"
```

---

### Task 11: Zustand store

**Files:**
- Create: `frontend/src/store/chatStore.ts`
- Create: `frontend/src/components/__tests__/chatStore.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/components/__tests__/chatStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from '../../store/chatStore'

beforeEach(() => {
  useChatStore.getState().reset()
})

describe('chatStore', () => {
  it('addUserMessage adds a user message and sets isLoading + thinking stage', () => {
    useChatStore.getState().addUserMessage('Hello')
    const state = useChatStore.getState()
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].role).toBe('user')
    expect(state.messages[0].content).toBe('Hello')
    expect(state.isLoading).toBe(true)
    expect(state.currentStage).toBe('thinking')
  })

  it('startAssistantMessage adds empty assistant message and returns its id', () => {
    const id = useChatStore.getState().startAssistantMessage()
    const state = useChatStore.getState()
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].id).toBe(id)
    expect(state.messages[0].role).toBe('assistant')
    expect(state.messages[0].content).toBe('')
  })

  it('appendToken appends token content to the correct message', () => {
    const id = useChatStore.getState().startAssistantMessage()
    useChatStore.getState().appendToken(id, 'Hello')
    useChatStore.getState().appendToken(id, ' world')
    expect(useChatStore.getState().messages[0].content).toBe('Hello world')
  })

  it('setSources attaches sources to the correct message', () => {
    const id = useChatStore.getState().startAssistantMessage()
    const sources = [{ index: 1, title: 'Reuters', url: 'https://reuters.com', snippet: 'news' }]
    useChatStore.getState().setSources(id, sources)
    expect(useChatStore.getState().messages[0].sources).toEqual(sources)
  })

  it('setError sets error message and clears loading state', () => {
    useChatStore.getState().setError('Something went wrong')
    const state = useChatStore.getState()
    expect(state.error).toBe('Something went wrong')
    expect(state.isLoading).toBe(false)
    expect(state.currentStage).toBeNull()
  })

  it('reset clears all state', () => {
    useChatStore.getState().addUserMessage('Hello')
    useChatStore.getState().reset()
    const state = useChatStore.getState()
    expect(state.messages).toHaveLength(0)
    expect(state.isLoading).toBe(false)
    expect(state.currentStage).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- chatStore
```

Expected: `Cannot find module '../../store/chatStore'`.

- [ ] **Step 3: Create `frontend/src/store/chatStore.ts`**

```typescript
import { create } from 'zustand'
import type { Message, Source, Stage } from '../types/chat'

interface ChatStore {
  messages: Message[]
  isLoading: boolean
  currentStage: Stage
  error: string | null
  addUserMessage: (content: string) => string
  startAssistantMessage: () => string
  appendToken: (id: string, token: string) => void
  setStage: (stage: Stage) => void
  setSources: (id: string, sources: Source[]) => void
  setError: (error: string) => void
  finishLoading: () => void
  reset: () => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isLoading: false,
  currentStage: null,
  error: null,

  addUserMessage: (content) => {
    const id = crypto.randomUUID()
    set((state) => ({
      messages: [...state.messages, { id, role: 'user', content }],
      isLoading: true,
      currentStage: 'thinking',
      error: null,
    }))
    return id
  },

  startAssistantMessage: () => {
    const id = crypto.randomUUID()
    set((state) => ({
      messages: [...state.messages, { id, role: 'assistant', content: '' }],
    }))
    return id
  },

  appendToken: (id, token) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + token } : m,
      ),
    })),

  setStage: (currentStage) => set({ currentStage }),

  setSources: (id, sources) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, sources } : m)),
    })),

  setError: (error) => set({ error, isLoading: false, currentStage: null }),

  finishLoading: () => set({ isLoading: false, currentStage: null }),

  reset: () => set({ messages: [], isLoading: false, currentStage: null, error: null }),
}))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npm test -- chatStore
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/chatStore.ts src/components/__tests__/chatStore.test.ts
git commit -m "feat(store): ✨ add Zustand chat store with message and loading state"
```

---

### Task 12: SSE API client

**Files:**
- Create: `frontend/src/api/chatApi.ts`
- Create: `frontend/src/components/__tests__/chatApi.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/components/__tests__/chatApi.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { streamChat } from '../../api/chatApi'
import type { SSEEvent } from '../../types/chat'

function makeStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line))
      }
      controller.close()
    },
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('streamChat', () => {
  it('yields parsed SSE events from a valid stream', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: makeStream([
          'data: {"type":"thinking","content":"Thinking..."}\n\n',
          'data: {"type":"token","content":"Hello"}\n\n',
          'data: {"type":"done"}\n\n',
        ]),
      }),
    )
    const events: SSEEvent[] = []
    for await (const event of streamChat({
      message: 'Hi',
      conversation_id: 'test',
      history: [],
    })) {
      events.push(event)
    }
    expect(events).toHaveLength(3)
    expect(events[0].type).toBe('thinking')
    expect(events[1].type).toBe('token')
    expect(events[1].content).toBe('Hello')
    expect(events[2].type).toBe('done')
  })

  it('throws an error when response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: vi.fn().mockResolvedValue({ error: 'Validation error' }),
      }),
    )
    const gen = streamChat({ message: '', conversation_id: 'test', history: [] })
    await expect(gen.next()).rejects.toThrow('Validation error')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- chatApi
```

Expected: `Cannot find module '../../api/chatApi'`.

- [ ] **Step 3: Create `frontend/src/api/chatApi.ts`**

```typescript
import type { ChatRequest, SSEEvent } from '../types/chat'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export async function* streamChat(req: ChatRequest): AsyncGenerator<SSEEvent> {
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          yield JSON.parse(line.slice(6)) as SSEEvent
        } catch {
          // malformed chunk, skip
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npm test -- chatApi
```

Expected: all 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/chatApi.ts src/components/__tests__/chatApi.test.ts
git commit -m "feat(stream): ✨ add SSE stream parser for chat API"
```

---

### Task 13: Hooks (useConversation + useChat)

**Files:**
- Create: `frontend/src/hooks/useConversation.ts`
- Create: `frontend/src/hooks/useChat.ts`
- Create: `frontend/src/components/__tests__/useChat.test.ts`

- [ ] **Step 1: Create `frontend/src/hooks/useConversation.ts`**

```typescript
import { useRef } from 'react'

const STORAGE_KEY = 'orbitrieve_conversation_id'

function getOrCreateConversationId(): string {
  const existing = localStorage.getItem(STORAGE_KEY)
  if (existing) return existing
  const id = crypto.randomUUID()
  localStorage.setItem(STORAGE_KEY, id)
  return id
}

export function useConversation(): { conversationId: string; resetConversation: () => void } {
  const conversationId = useRef(getOrCreateConversationId())

  const resetConversation = (): void => {
    const id = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, id)
    conversationId.current = id
  }

  return { conversationId: conversationId.current, resetConversation }
}
```

- [ ] **Step 2: Write the failing useChat tests**

```typescript
// frontend/src/components/__tests__/useChat.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChat } from '../../hooks/useChat'
import { useChatStore } from '../../store/chatStore'
import * as chatApiModule from '../../api/chatApi'
import type { SSEEvent } from '../../types/chat'

beforeEach(() => {
  useChatStore.getState().reset()
  vi.restoreAllMocks()
  // mock localStorage
  vi.stubGlobal('localStorage', {
    getItem: vi.fn().mockReturnValue('test-conversation-id'),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  })
})

async function* makeEventStream(events: SSEEvent[]): AsyncGenerator<SSEEvent> {
  for (const e of events) yield e
}

describe('useChat', () => {
  it('adds user message and streams tokens into assistant message', async () => {
    vi.spyOn(chatApiModule, 'streamChat').mockImplementation(() =>
      makeEventStream([
        { type: 'thinking', content: 'Thinking...' },
        { type: 'token', content: 'Hello ' },
        { type: 'token', content: 'world' },
        { type: 'done' },
      ]),
    )
    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage('Hi')
    })
    const messages = useChatStore.getState().messages
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toBe('Hi')
    expect(messages[1].role).toBe('assistant')
    expect(messages[1].content).toBe('Hello world')
    expect(useChatStore.getState().isLoading).toBe(false)
  })

  it('attaches sources to assistant message on sources event', async () => {
    const sources = [{ index: 1, title: 'Reuters', url: 'https://reuters.com', snippet: 'news' }]
    vi.spyOn(chatApiModule, 'streamChat').mockImplementation(() =>
      makeEventStream([
        { type: 'token', content: 'Answer [1]' },
        { type: 'sources', sources },
        { type: 'done' },
      ]),
    )
    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage('news?')
    })
    const assistant = useChatStore.getState().messages[1]
    expect(assistant.sources).toEqual(sources)
  })

  it('sets error state when stream yields error event', async () => {
    vi.spyOn(chatApiModule, 'streamChat').mockImplementation(() =>
      makeEventStream([{ type: 'error', code: 'SEARCH_FAILED', error: 'Tavily down' }]),
    )
    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage('news?')
    })
    expect(useChatStore.getState().error).toContain("search")
    expect(useChatStore.getState().isLoading).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd frontend && npm test -- useChat
```

Expected: `Cannot find module '../../hooks/useChat'`.

- [ ] **Step 4: Create `frontend/src/hooks/useChat.ts`**

```typescript
import { streamChat } from '../api/chatApi'
import { useChatStore } from '../store/chatStore'
import { useConversation } from './useConversation'

const USER_MESSAGES: Record<string, string> = {
  SEARCH_FAILED: "Couldn't search the web right now. Please try again.",
  AGENT_FAILED: 'AI service is temporarily unavailable. Please try again.',
  RATE_LIMITED: 'Too many requests. Please wait a moment.',
  INTERNAL_ERROR: 'Something went wrong. Please refresh the page.',
}

export function useChat(): { sendMessage: (message: string) => Promise<void> } {
  const store = useChatStore()
  const { conversationId } = useConversation()

  const sendMessage = async (message: string): Promise<void> => {
    store.addUserMessage(message)
    const assistantId = store.startAssistantMessage()

    const history = useChatStore
      .getState()
      .messages.slice(0, -1) // exclude the new empty assistant message
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      for await (const event of streamChat({ message, conversation_id: conversationId, history })) {
        switch (event.type) {
          case 'thinking':
          case 'searching':
          case 'writing':
            store.setStage(event.type)
            break
          case 'token':
            store.setStage(null)
            if (event.content) store.appendToken(assistantId, event.content)
            break
          case 'sources':
            if (event.sources) store.setSources(assistantId, event.sources)
            break
          case 'done':
            store.finishLoading()
            break
          case 'error':
            store.setError(
              USER_MESSAGES[event.code ?? 'INTERNAL_ERROR'] ?? USER_MESSAGES['INTERNAL_ERROR'],
            )
            break
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        store.setError(USER_MESSAGES['INTERNAL_ERROR'])
      }
    }
  }

  return { sendMessage }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd frontend && npm test -- useChat
```

Expected: all 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/ src/components/__tests__/useChat.test.ts
git commit -m "feat(hooks): ✨ add useConversation and useChat hooks with SSE event handling"
```

---

## Phase 5 — Frontend Components

---

### Task 14: ChatInput component

**Files:**
- Create: `frontend/src/components/ChatInput.tsx`
- Create: `frontend/src/components/__tests__/ChatInput.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/components/__tests__/ChatInput.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from '../ChatInput'

describe('ChatInput', () => {
  it('calls onSend with message text when Enter is pressed', async () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} isLoading={false} />)
    await userEvent.type(screen.getByRole('textbox'), 'Hello{Enter}')
    expect(onSend).toHaveBeenCalledWith('Hello')
  })

  it('calls onSend when Send button is clicked', async () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} isLoading={false} />)
    await userEvent.type(screen.getByRole('textbox'), 'Hi')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(onSend).toHaveBeenCalledWith('Hi')
  })

  it('does not call onSend when input is blank', async () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} isLoading={false} />)
    await userEvent.type(screen.getByRole('textbox'), '{Enter}')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('disables input and button when isLoading is true', () => {
    render(<ChatInput onSend={vi.fn()} isLoading={true} />)
    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('clears input after sending', async () => {
    render(<ChatInput onSend={vi.fn()} isLoading={false} />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'Hello{Enter}')
    expect(input).toHaveValue('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- ChatInput
```

Expected: `Cannot find module '../ChatInput'`.

- [ ] **Step 3: Create `frontend/src/components/ChatInput.tsx`**

```typescript
import { useState, type KeyboardEvent } from 'react'
import { theme } from '../styles/theme'

interface ChatInputProps {
  onSend: (message: string) => void
  isLoading: boolean
}

export function ChatInput({ onSend, isLoading }: ChatInputProps): JSX.Element {
  const [value, setValue] = useState('')

  const handleSend = (): void => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 16px',
        borderTop: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.surface,
      }}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        placeholder="Ask anything..."
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radii.md,
          padding: '10px 14px',
          fontFamily: theme.fonts.base,
          fontSize: '14px',
          lineHeight: '1.5',
          outline: 'none',
          backgroundColor: isLoading ? theme.colors.surfaceAlt : theme.colors.surface,
        }}
      />
      <button
        onClick={handleSend}
        disabled={isLoading || !value.trim()}
        aria-label="Send"
        style={{
          padding: '10px 20px',
          backgroundColor: isLoading || !value.trim() ? theme.colors.border : theme.colors.primary,
          border: 'none',
          borderRadius: theme.radii.md,
          fontWeight: 600,
          fontSize: '14px',
          cursor: isLoading || !value.trim() ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.15s',
        }}
      >
        Send
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npm test -- ChatInput
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChatInput.tsx src/components/__tests__/ChatInput.test.tsx
git commit -m "feat(chat): ✨ add ChatInput component with Enter-to-send and loading state"
```

---

### Task 15: ThinkingIndicator + OrbitrieveIcon + Header

**Files:**
- Create: `frontend/src/components/OrbitrieveIcon.tsx`
- Create: `frontend/src/components/ThinkingIndicator.tsx`
- Create: `frontend/src/components/Header.tsx`

- [ ] **Step 1: Create `frontend/src/components/OrbitrieveIcon.tsx`**

```typescript
interface OrbitrieveIconProps {
  size?: number
}

export function OrbitrieveIcon({ size = 32 }: OrbitrieveIconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Orbitrieve"
    >
      <circle cx="16" cy="16" r="15" stroke="#F5C518" strokeWidth="2" />
      <circle cx="16" cy="16" r="6" fill="#F5C518" />
      <ellipse
        cx="16"
        cy="16"
        rx="14"
        ry="6"
        stroke="#F5C518"
        strokeWidth="1.5"
        fill="none"
        transform="rotate(-30 16 16)"
      />
    </svg>
  )
}
```

- [ ] **Step 2: Create `frontend/src/components/ThinkingIndicator.tsx`**

```typescript
import { theme } from '../styles/theme'
import type { Stage } from '../types/chat'

const STAGE_LABELS: Record<NonNullable<Stage>, string> = {
  thinking: 'Thinking',
  searching: 'Searching the web',
  writing: 'Writing answer',
}

interface ThinkingIndicatorProps {
  stage: Stage
}

export function ThinkingIndicator({ stage }: ThinkingIndicatorProps): JSX.Element | null {
  if (!stage) return null
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 0',
        color: theme.colors.textMuted,
        fontSize: '13px',
      }}
    >
      <span>{STAGE_LABELS[stage]}</span>
      <span className="dots">
        <DotAnimation />
      </span>
    </div>
  )
}

function DotAnimation(): JSX.Element {
  return (
    <span aria-hidden="true">
      {'●●●'.split('').map((dot, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            animation: `pulse 1.2s ${i * 0.2}s infinite`,
            opacity: 0.3,
            marginLeft: '2px',
            fontSize: '8px',
          }}
        >
          {dot}
        </span>
      ))}
    </span>
  )
}
```

- [ ] **Step 3: Create `frontend/src/components/Header.tsx`**

```typescript
import { theme } from '../styles/theme'
import { OrbitrieveIcon } from './OrbitrieveIcon'

interface HeaderProps {
  onNewChat: () => void
}

export function Header({ onNewChat }: HeaderProps): JSX.Element {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: `2px solid ${theme.colors.primary}`,
        backgroundColor: theme.colors.surface,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <OrbitrieveIcon size={28} />
        <span
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: theme.colors.textPrimary,
            fontFamily: theme.fonts.base,
          }}
        >
          Orbitrieve
        </span>
      </div>
      <button
        onClick={onNewChat}
        style={{
          padding: '6px 14px',
          backgroundColor: 'transparent',
          border: `1.5px solid ${theme.colors.primary}`,
          borderRadius: theme.radii.full,
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          color: theme.colors.textPrimary,
        }}
      >
        New Chat
      </button>
    </header>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/OrbitrieveIcon.tsx src/components/ThinkingIndicator.tsx src/components/Header.tsx
git commit -m "feat(ui): ✨ add Header, OrbitrieveIcon SVG, and ThinkingIndicator"
```

---

### Task 16: Citation + Source components

**Files:**
- Create: `frontend/src/components/CitationLink.tsx`
- Create: `frontend/src/components/SourceCard.tsx`
- Create: `frontend/src/components/SourceList.tsx`
- Create: `frontend/src/components/__tests__/SourceCard.test.tsx`

- [ ] **Step 1: Write the failing SourceCard tests**

```typescript
// frontend/src/components/__tests__/SourceCard.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SourceCard } from '../SourceCard'

const source = {
  index: 1,
  title: 'Reuters Finance',
  url: 'https://reuters.com/finance',
  snippet: 'Apple stock rose 1.2% today.',
}

describe('SourceCard', () => {
  it('renders the source title', () => {
    render(<SourceCard source={source} />)
    expect(screen.getByText('Reuters Finance')).toBeInTheDocument()
  })

  it('renders the source index', () => {
    render(<SourceCard source={source} />)
    expect(screen.getByText('[1]')).toBeInTheDocument()
  })

  it('renders a link with noopener noreferrer', () => {
    render(<SourceCard source={source} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('href', 'https://reuters.com/finance')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- SourceCard
```

Expected: `Cannot find module '../SourceCard'`.

- [ ] **Step 3: Create `frontend/src/components/CitationLink.tsx`**

```typescript
import { theme } from '../styles/theme'

interface CitationLinkProps {
  index: number
}

export function CitationLink({ index }: CitationLinkProps): JSX.Element {
  return (
    <sup
      id={`cite-ref-${index}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '16px',
        height: '16px',
        backgroundColor: theme.colors.primary,
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 700,
        cursor: 'pointer',
        marginLeft: '1px',
        verticalAlign: 'super',
        lineHeight: 1,
        textDecoration: 'none',
        color: theme.colors.textPrimary,
      }}
      onClick={() => {
        document.getElementById(`source-card-${index}`)?.scrollIntoView({ behavior: 'smooth' })
      }}
    >
      {index}
    </sup>
  )
}
```

- [ ] **Step 4: Create `frontend/src/components/SourceCard.tsx`**

```typescript
import type { Source } from '../types/chat'
import { theme } from '../styles/theme'

interface SourceCardProps {
  source: Source
}

export function SourceCard({ source }: SourceCardProps): JSX.Element {
  const domain = (() => {
    try {
      return new URL(source.url).hostname.replace('www.', '')
    } catch {
      return source.url
    }
  })()

  return (
    <a
      id={`source-card-${source.index}`}
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        gap: '10px',
        padding: '8px 12px',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radii.sm,
        textDecoration: 'none',
        color: theme.colors.textPrimary,
        backgroundColor: theme.colors.surface,
        transition: 'border-color 0.15s',
      }}
    >
      <span
        style={{
          minWidth: '22px',
          height: '22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.primaryLight,
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        [{source.index}]
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>{source.title}</div>
        <div
          style={{
            fontSize: '11px',
            color: theme.colors.textMuted,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {domain}
        </div>
      </div>
    </a>
  )
}
```

- [ ] **Step 5: Create `frontend/src/components/SourceList.tsx`**

```typescript
import type { Source } from '../types/chat'
import { theme } from '../styles/theme'
import { SourceCard } from './SourceCard'

interface SourceListProps {
  sources: Source[]
}

export function SourceList({ sources }: SourceListProps): JSX.Element | null {
  if (!sources.length) return null
  return (
    <div style={{ marginTop: '12px' }}>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: theme.colors.textMuted,
          marginBottom: '8px',
        }}
      >
        Sources
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
        {sources.map((s) => (
          <SourceCard key={s.index} source={s} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Run SourceCard tests to verify they pass**

```bash
cd frontend && npm test -- SourceCard
```

Expected: all 3 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/CitationLink.tsx src/components/SourceCard.tsx src/components/SourceList.tsx src/components/__tests__/SourceCard.test.tsx
git commit -m "feat(ui): ✨ add CitationLink, SourceCard, and SourceList components"
```

---

### Task 17: MessageBubble + MessageList

**Files:**
- Create: `frontend/src/components/MessageBubble.tsx`
- Create: `frontend/src/components/MessageList.tsx`
- Create: `frontend/src/components/__tests__/MessageBubble.test.tsx`

- [ ] **Step 1: Write the failing MessageBubble tests**

```typescript
// frontend/src/components/__tests__/MessageBubble.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'
import type { Message } from '../../types/chat'

describe('MessageBubble', () => {
  it('renders user message content', () => {
    const msg: Message = { id: '1', role: 'user', content: 'Hello there' }
    render(<MessageBubble message={msg} />)
    expect(screen.getByText('Hello there')).toBeInTheDocument()
  })

  it('renders assistant message content', () => {
    const msg: Message = { id: '2', role: 'assistant', content: 'I am an AI' }
    render(<MessageBubble message={msg} />)
    expect(screen.getByText('I am an AI')).toBeInTheDocument()
  })

  it('renders source list when assistant message has sources', () => {
    const msg: Message = {
      id: '3',
      role: 'assistant',
      content: 'Apple is $213 [1]',
      sources: [{ index: 1, title: 'Yahoo Finance', url: 'https://finance.yahoo.com', snippet: 'AAPL $213' }],
    }
    render(<MessageBubble message={msg} />)
    expect(screen.getByText('Yahoo Finance')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- MessageBubble
```

Expected: `Cannot find module '../MessageBubble'`.

- [ ] **Step 3: Create `frontend/src/components/MessageBubble.tsx`**

```typescript
import type { ReactNode } from 'react'
import type { Message } from '../types/chat'
import { theme } from '../styles/theme'
import { CitationLink } from './CitationLink'
import { SourceList } from './SourceList'

interface MessageBubbleProps {
  message: Message
}

function parseContent(content: string): ReactNode[] {
  const parts = content.split(/(\[\d+\])/g)
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/)
    if (match) {
      return <CitationLink key={i} index={parseInt(match[1])} />
    }
    return part
  })
}

export function MessageBubble({ message }: MessageBubbleProps): JSX.Element {
  const isUser = message.role === 'user'

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '12px',
        padding: '0 16px',
      }}
    >
      <div
        style={{
          maxWidth: '75%',
          padding: '10px 14px',
          borderRadius: isUser
            ? `${theme.radii.lg} ${theme.radii.lg} 4px ${theme.radii.lg}`
            : `${theme.radii.lg} ${theme.radii.lg} ${theme.radii.lg} 4px`,
          backgroundColor: isUser ? theme.colors.primaryLight : theme.colors.surfaceAlt,
          border: `1px solid ${isUser ? '#F0D060' : theme.colors.border}`,
          fontSize: '14px',
          lineHeight: '1.6',
          color: theme.colors.textPrimary,
          fontFamily: theme.fonts.base,
        }}
      >
        <div>{parseContent(message.content)}</div>
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourceList sources={message.sources} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `frontend/src/components/MessageList.tsx`**

```typescript
import { useEffect, useRef } from 'react'
import type { Message } from '../types/chat'
import type { Stage } from '../types/chat'
import { MessageBubble } from './MessageBubble'
import { ThinkingIndicator } from './ThinkingIndicator'
import { theme } from '../styles/theme'

interface MessageListProps {
  messages: Message[]
  currentStage: Stage
}

export function MessageList({ messages, currentStage }: MessageListProps): JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentStage])

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 0',
        backgroundColor: theme.colors.surface,
      }}
    >
      {messages.length === 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: theme.colors.textMuted,
            fontSize: '14px',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '32px' }}>🔍</span>
          <span>Ask me anything — I'll search the web when needed.</span>
        </div>
      )}
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      {currentStage && (
        <div style={{ padding: '0 30px' }}>
          <ThinkingIndicator stage={currentStage} />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **Step 5: Run MessageBubble tests to verify they pass**

```bash
cd frontend && npm test -- MessageBubble
```

Expected: all 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/MessageBubble.tsx src/components/MessageList.tsx src/components/__tests__/MessageBubble.test.tsx
git commit -m "feat(chat): ✨ add MessageBubble with citation parsing and MessageList"
```

---

## Phase 6 — Integration + Infrastructure

---

### Task 18: App.tsx — wire everything together

**Files:**
- Create: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/App.tsx`**

```typescript
import { useChatStore } from './store/chatStore'
import { useChat } from './hooks/useChat'
import { useConversation } from './hooks/useConversation'
import { Header } from './components/Header'
import { MessageList } from './components/MessageList'
import { ChatInput } from './components/ChatInput'
import { theme } from './styles/theme'

export default function App(): JSX.Element {
  const { messages, isLoading, currentStage } = useChatStore()
  const { sendMessage } = useChat()
  const { resetConversation } = useConversation()
  const reset = useChatStore((s) => s.reset)

  const handleNewChat = (): void => {
    resetConversation()
    reset()
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: theme.fonts.base,
        backgroundColor: theme.colors.surface,
        maxWidth: '800px',
        margin: '0 auto',
        boxShadow: '0 0 40px rgba(0,0,0,0.06)',
      }}
    >
      <Header onNewChat={handleNewChat} />
      <MessageList messages={messages} currentStage={currentStage} />
      <ChatInput onSend={sendMessage} isLoading={isLoading} />
    </div>
  )
}
```

- [ ] **Step 2: Add global styles to `index.html`**

Add inside `<head>`:
```html
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #f0f0f0; }
  @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
</style>
```

- [ ] **Step 3: Run all frontend tests**

```bash
cd frontend && npm test
```

Expected: all tests pass.

- [ ] **Step 4: Start backend + redis and verify manually**

```bash
# Terminal 1: start Redis
docker run -p 6379:6379 redis:7-alpine

# Terminal 2: start backend (with real .env keys)
cd backend && uv run uvicorn app.main:app --reload --port 8000

# Terminal 3: start frontend
cd frontend && npm run dev
```

Open `http://localhost:5173` — ask "What is the current Bitcoin price?" and verify:
- "Thinking..." → "Searching the web..." → "Writing answer..." stages appear
- Answer streams token by token
- Sources panel appears below response with `[1]` citations

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/index.html
git commit -m "feat(ui): ✨ wire App.tsx — connect Header, MessageList, ChatInput"
```

---

### Task 19: docker-compose + Dockerfiles

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/docker/Dockerfile`
- Create: `frontend/docker/Dockerfile`

- [ ] **Step 1: Create `backend/docker/Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN pip install uv

COPY pyproject.toml .
RUN uv sync --no-dev

COPY . .

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Create `frontend/docker/Dockerfile`**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 3: Create `frontend/docker/nginx.conf`**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;
    }
}
```

- [ ] **Step 4: Create `docker-compose.yml`**

```yaml
version: "3.9"

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 3

  backend:
    build:
      context: ./backend
      dockerfile: docker/Dockerfile
    ports:
      - "8000:8000"
    env_file: ./backend/.env
    depends_on:
      redis:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      dockerfile: docker/Dockerfile
    ports:
      - "5173:80"
    depends_on:
      - backend
```

- [ ] **Step 5: Verify docker-compose builds**

```bash
docker-compose build
```

Expected: all 3 images build without errors.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml backend/docker/ frontend/docker/
git commit -m "chore(ci): 🔧 add docker-compose and Dockerfiles for full-stack deployment"
```

---

### Task 20: Run full test suite + coverage

- [ ] **Step 1: Run backend tests with coverage**

```bash
cd backend && uv run pytest --cov=app --cov-report=term-missing -v
```

Expected output includes:
- `tests/agents/test_orchestrator.py` — 4 passed
- `tests/agents/test_search_agent.py` — 3 passed
- `tests/services/test_tavily.py` — 3 passed
- `tests/services/test_redis_service.py` — 5 passed
- `tests/api/test_chat.py` — 3 passed
- Coverage: agents ≥ 90%, api ≥ 80%, services ≥ 70%

- [ ] **Step 2: Run frontend tests**

```bash
cd frontend && npm test
```

Expected: all tests pass (ChatInput × 5, SourceCard × 3, MessageBubble × 3, chatStore × 6, chatApi × 2, useChat × 3 = 22 tests).

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "test: ✅ verify full test suite passes — backend and frontend"
```

---

## Coverage Summary

| Layer | Target | Key test files |
|---|---|---|
| Agent logic | 90% | `test_orchestrator.py`, `test_search_agent.py` |
| API routes | 80% | `test_chat.py` |
| Services | 70% | `test_tavily.py`, `test_redis_service.py` |
| React hooks | 80% | `useChat.test.ts` |
| React components | 60% | `ChatInput.test.tsx`, `MessageBubble.test.tsx`, `SourceCard.test.tsx` |
