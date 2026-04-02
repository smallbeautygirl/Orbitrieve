---
name: python-backend
description: Python 3.12 + FastAPI patterns for Orbitrieve — multi-agent chatbot backend with streaming, Pydantic v2, async I/O, and Tavily search integration.
type: skill
---

# Python Backend Skill — Orbitrieve

## When to Activate
- Writing FastAPI routes, middleware, or config
- Implementing or modifying agent logic (Orchestrator / Search Agent)
- Adding Tavily search service or Claude API wrappers
- Working with Pydantic schemas or error handling
- Writing async Python code

---

## Core Principles

1. **Async everywhere** — all I/O is `async def`; never block the event loop
2. **Type hints on every function** — use `from __future__ import annotations` at top of files
3. **Pydantic v2 for all data shapes** — request bodies, responses, config
4. **EAFP** — `try/except` over pre-checks for external API calls
5. **Explicit errors** — raise `HTTPException` with structured detail dicts, never plain strings

---

## Project Layout

```
backend/
├── app/
│   ├── main.py              ← FastAPI app factory + lifespan
│   ├── api/
│   │   └── chat.py          ← /api/chat SSE endpoint
│   ├── agents/
│   │   ├── orchestrator.py  ← Orchestrator Agent (route/classify)
│   │   └── search_agent.py  ← Search & Synthesis Agent
│   ├── services/
│   │   ├── claude.py        ← Anthropic SDK wrapper
│   │   └── tavily.py        ← Tavily search wrapper
│   ├── models/
│   │   └── chat.py          ← ChatRequest, ChatMessage, Source schemas
│   ├── prompts/
│   │   ├── orchestrator.py  ← System prompt for Orchestrator
│   │   └── search_agent.py  ← System prompt for Search Agent
│   └── core/
│       ├── config.py        ← Settings (pydantic-settings)
│       └── logging.py       ← Structured JSON logging
├── tests/
├── pyproject.toml
└── .env
```

---

## Patterns

### FastAPI App Factory

```python
# app/main.py
from __future__ import annotations
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.chat import router as chat_router
from app.core.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup: warm up clients
    yield
    # shutdown: close connections

def create_app() -> FastAPI:
    app = FastAPI(title="Orbitrieve API", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(chat_router, prefix="/api")
    return app

app = create_app()
```

### Pydantic v2 Config

```python
# app/core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    anthropic_api_key: str
    tavily_api_key: str
    cors_origins: list[str] = ["http://localhost:5173"]
    port: int = 8000

settings = Settings()
```

### Pydantic v2 Schemas

```python
# app/models/chat.py
from __future__ import annotations
from pydantic import BaseModel, Field
from enum import StrEnum

class Role(StrEnum):
    user = "user"
    assistant = "assistant"

class ChatMessage(BaseModel):
    role: Role
    content: str

class Source(BaseModel):
    title: str
    url: str
    snippet: str

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: str | None = None
    history: list[ChatMessage] = Field(default_factory=list)
```

### SSE Streaming Endpoint

```python
# app/api/chat.py
from __future__ import annotations
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.models.chat import ChatRequest
from app.agents.orchestrator import OrchestratorAgent

router = APIRouter()

@router.post("/chat")
async def chat(request: ChatRequest) -> StreamingResponse:
    agent = OrchestratorAgent()

    async def event_stream():
        async for chunk in agent.run(request):
            yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: {\"type\": \"done\"}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

### Orchestrator Agent

```python
# app/agents/orchestrator.py
from __future__ import annotations
from typing import AsyncIterator
import anthropic
from app.core.config import settings
from app.models.chat import ChatRequest
from app.agents.search_agent import SearchAgent
from app.prompts.orchestrator import ORCHESTRATOR_SYSTEM_PROMPT

class OrchestratorAgent:
    def __init__(self) -> None:
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = "claude-sonnet-4-6"

    async def run(self, request: ChatRequest) -> AsyncIterator[dict]:
        needs_search = await self._classify(request.message)

        if needs_search:
            yield {"type": "thinking", "content": "Searching the web for current information..."}
            async for chunk in SearchAgent().run(request):
                yield chunk
        else:
            async with self.client.messages.stream(
                model=self.model,
                max_tokens=1024,
                system=ORCHESTRATOR_SYSTEM_PROMPT,
                messages=[
                    *[{"role": m.role, "content": m.content} for m in request.history],
                    {"role": "user", "content": request.message},
                ],
            ) as stream:
                async for text in stream.text_stream:
                    yield {"type": "token", "content": text}

    async def _classify(self, message: str) -> bool:
        """Return True if web search is needed for this message."""
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=10,
            system=(
                "You are a classifier. Reply with only 'yes' or 'no'.\n"
                "Answer 'yes' if the question requires current/live information "
                "(stock prices, news, weather, exchange rates, sports scores, recent events).\n"
                "Answer 'no' for general knowledge, coding, math, or historical facts."
            ),
            messages=[{"role": "user", "content": message}],
        )
        return response.content[0].text.strip().lower() == "yes"
```

### Search Agent

```python
# app/agents/search_agent.py
from __future__ import annotations
from typing import AsyncIterator
import anthropic
from app.core.config import settings
from app.models.chat import ChatRequest
from app.services.tavily import TavilyService
from app.prompts.search_agent import SEARCH_AGENT_SYSTEM_PROMPT

class SearchAgent:
    def __init__(self) -> None:
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.tavily = TavilyService()
        self.model = "claude-sonnet-4-6"

    async def run(self, request: ChatRequest) -> AsyncIterator[dict]:
        # Step 1: Search
        results = await self.tavily.search(request.message)
        sources = [
            {"title": r["title"], "url": r["url"], "snippet": r["content"]}
            for r in results[:5]
        ]

        # Step 2: Synthesize with citations
        context = "\n\n".join(
            f"[{i+1}] {s['title']}\n{s['snippet']}\nSource: {s['url']}"
            for i, s in enumerate(sources)
        )

        async with self.client.messages.stream(
            model=self.model,
            max_tokens=1500,
            system=SEARCH_AGENT_SYSTEM_PROMPT,
            messages=[
                *[{"role": m.role, "content": m.content} for m in request.history],
                {
                    "role": "user",
                    "content": (
                        f"Search results:\n{context}\n\n"
                        f"User question: {request.message}\n\n"
                        "Answer using the search results above. "
                        "Cite sources inline as [1], [2], etc."
                    ),
                },
            ],
        ) as stream:
            async for text in stream.text_stream:
                yield {"type": "token", "content": text}

        yield {"type": "sources", "sources": sources}
```

### Tavily Service

```python
# app/services/tavily.py
from __future__ import annotations
import httpx
from app.core.config import settings

class TavilyService:
    BASE_URL = "https://api.tavily.com/search"

    async def search(self, query: str, max_results: int = 5) -> list[dict]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(
                    self.BASE_URL,
                    json={
                        "api_key": settings.tavily_api_key,
                        "query": query,
                        "max_results": max_results,
                        "search_depth": "basic",
                        "include_answer": False,
                    },
                )
                response.raise_for_status()
                return response.json().get("results", [])
            except httpx.HTTPStatusError as e:
                raise RuntimeError(f"Tavily search failed: {e.response.status_code}") from e
```

### Agent Prompts

```python
# app/prompts/orchestrator.py
ORCHESTRATOR_SYSTEM_PROMPT = """You are Orbitrieve, a helpful AI assistant.
Answer questions clearly and concisely.
For general knowledge questions, answer directly from your training data.
Do not fabricate current data like prices or news — those will be fetched separately."""

# app/prompts/search_agent.py
SEARCH_AGENT_SYSTEM_PROMPT = """You are Orbitrieve, a helpful AI assistant that synthesizes web search results.
Given search results with numbered sources, write a clear, accurate answer.
Always cite sources inline using [1], [2], etc. notation.
If multiple sources confirm the same fact, cite all of them.
Present the most important information first.
Keep answers focused and avoid unnecessary padding."""
```

---

## Dependencies (`pyproject.toml`)

```toml
[project]
name = "backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "anthropic>=0.40",
    "httpx>=0.27",
    "pydantic>=2.7",
    "pydantic-settings>=2.3",
    "python-dotenv>=1.0",
]

[dependency-groups]
dev = [
    "pytest>=8",
    "pytest-asyncio>=0.24",
    "httpx>=0.27",   # for TestClient
    "ruff>=0.4",
]
```

---

## Error Handling

```python
from fastapi import HTTPException

# Always raise with structured detail
raise HTTPException(
    status_code=502,
    detail={"error": "Search service unavailable", "code": "SEARCH_FAILED"},
)
```

---

## Testing

```python
# tests/test_classify.py
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_orchestrator_skips_search_for_general_question():
    with patch("app.agents.orchestrator.OrchestratorAgent._classify", return_value=False):
        agent = OrchestratorAgent()
        # assert direct answer path taken

@pytest.mark.asyncio
async def test_orchestrator_triggers_search_for_stock_question():
    with patch("app.agents.orchestrator.OrchestratorAgent._classify", return_value=True):
        agent = OrchestratorAgent()
        # assert search path taken
```

---

## Anti-Patterns to Avoid

- Never use `asyncio.run()` inside FastAPI route handlers
- Never store API keys in code — always `settings.*`
- Never use bare `except:` — catch specific exceptions
- Never buffer the full SSE stream before sending — stream token by token
- Never put prompt strings inline in agent code — keep in `prompts/` module
