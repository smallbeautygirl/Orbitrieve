# Orbitrieve — Web Search Chatbot Design Spec

**Date:** 2026-04-03
**Assignment:** Senior Software Engineer Assignment — Topic B
**Author:** vivian (smallbeautygirl)

---

## 1. Product Requirements Document (PRD)

### 1.1 Overview

Orbitrieve is a smart AI web-search chatbot that answers time-sensitive questions (stock prices, news, exchange rates, weather, etc.) using a multi-agent architecture. It retrieves citation-backed answers via real-time web search and streams responses to the user.

### 1.2 Core Requirements (from assignment)

| # | Requirement |
|---|---|
| R1 | Multi-agent architecture with exactly 2 AI Agents collaborating |
| R2 | Capable of web search, with inline source citations in responses |
| R3 | Can answer time-sensitive questions (stock prices, news, exchange rates) |
| R4 | Only triggers web search when genuinely needed |
| R5 | Responses rendered as streaming text (SSE) |
| R6 | Frontend: React + TypeScript |
| R7 | Backend: Python |
| R8 | Frontend/backend separation |
| R9 | Git version control with Conventional Commits |

### 1.3 Out of Scope

- User authentication / account management
- Persistent database (conversation history stored in Redis with 24h TTL)
- Multi-language support (English only)
- Mobile-specific responsive breakpoints (desktop-first)

### 1.4 Success Criteria

1. Orchestrator correctly classifies intent — searches only when needed
2. Search answers are accurate and include inline `[1]` `[2]` citations
3. Sources panel renders at the bottom of every search-backed response
4. Streaming works end-to-end with visible stage indicators
5. All tests pass; coverage targets met
6. `docker-compose up --build` starts the entire stack

---

## 2. Architecture Design

### 2.1 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Python 3.12 + FastAPI |
| Agent framework | Anthropic SDK (`claude-sonnet-4-6`) |
| Web search | Tavily Search API |
| Streaming | Server-Sent Events (SSE) |
| State management | Zustand |
| HTTP client | Axios |
| Conversation memory | Redis 7 (TTL 24h, key = `conversation:{id}`) |
| Containerisation | docker-compose |

### 2.2 Multi-Agent Data Flow

```
Browser
  │  POST /api/chat  { message, conversation_id, history }
  ▼
FastAPI  →  RedisService.get_history()
  │
  ▼
OrchestratorAgent
  │  Claude tool_use → { needs_search: bool, reason: str }
  │
  ├── needs_search = false
  │     └── stream direct answer → SSE tokens → Browser
  │
  └── needs_search = true
        ▼
      SearchAgent
        │  1. generate search query
        │  2. TavilyService.search()
        │  3. synthesise answer with [1][2] citations
        └── stream tokens + sources event → Browser
  │
  ▼
RedisService.append_turn()  (saves user + assistant turn)
```

### 2.3 SSE Event Protocol

All events follow `data: <JSON>\n\n` format.

| Event type | Payload | When |
|---|---|---|
| `thinking` | `{ type, content: "Thinking..." }` | Orchestrator classifying intent |
| `searching` | `{ type, content: "Searching the web..." }` | SearchAgent calling Tavily |
| `writing` | `{ type, content: "Writing answer..." }` | Claude synthesising response |
| `token` | `{ type, content: string }` | Each streamed token |
| `sources` | `{ type, sources: Source[] }` | After all tokens (search only) |
| `done` | `{ type }` | Stream complete |
| `error` | `{ type, code: string, error: string }` | Any failure mid-stream |

### 2.4 When to Trigger Web Search

Orchestrator MUST trigger search when the user asks about:
- Current stock / crypto prices
- Today's news / recent events
- Live exchange rates
- Weather forecasts
- Sports scores / live results
- Keywords: "today", "now", "current", "latest", "live", "price of", "rate of"

Orchestrator MUST NOT search for: general knowledge, coding questions, math, definitions, historical facts.

---

## 3. Backend Specification

### 3.1 Directory Structure

```
backend/
├── main.py
├── pyproject.toml
├── docker/
│   └── Dockerfile
├── app/
│   ├── api/
│   │   └── chat.py            # POST /api/chat, GET /api/health
│   ├── agents/
│   │   ├── orchestrator.py    # OrchestratorAgent
│   │   └── search_agent.py    # SearchAgent
│   ├── services/
│   │   ├── tavily.py          # TavilyService
│   │   ├── claude.py          # Claude API wrapper
│   │   └── redis_service.py   # RedisService (conversation history)
│   ├── models/
│   │   └── chat.py            # ChatRequest, ChatMessage, Source, SSEEvent
│   ├── prompts/
│   │   ├── orchestrator.py    # system prompt for OrchestratorAgent
│   │   └── search_agent.py    # system prompt for SearchAgent
│   └── core/
│       ├── config.py          # pydantic-settings
│       ├── logging.py         # structured logging setup
│       ├── middleware.py      # CORS
│       └── exceptions.py     # OrbitrieveError, SearchError, AgentError
└── tests/
    ├── conftest.py
    ├── api/
    │   └── test_chat.py
    ├── agents/
    │   ├── test_orchestrator.py
    │   └── test_search_agent.py
    └── services/
        └── test_tavily.py
```

### 3.2 Pydantic Models (`app/models/chat.py`)

```python
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str  # UUID v4
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)

class Source(BaseModel):
    index: int
    title: str
    url: str
    snippet: str

class SSEEvent(BaseModel):
    type: Literal["thinking", "searching", "writing", "token", "sources", "done", "error"]
    content: str | None = None
    sources: list[Source] | None = None
    code: str | None = None
    error: str | None = None
```

### 3.3 OrchestratorAgent (`app/agents/orchestrator.py`)

**Input:** `message: str`, `history: list[ChatMessage]`

**Behaviour:**
- Calls Claude with `tool_use` — tool schema:
  ```json
  {
    "name": "route_decision",
    "input_schema": {
      "needs_search": { "type": "boolean" },
      "reason": { "type": "string" }
    }
  }
  ```
- Returns `RouteDecision(needs_search: bool, reason: str)`
- Does NOT generate the final answer itself

**Yields SSE events:** `thinking`

### 3.4 SearchAgent (`app/agents/search_agent.py`)

**Input:** `message: str`, `history: list[ChatMessage]`, `reason: str`

**Behaviour:**
1. Yields `searching` SSE event
2. Generates a concise Tavily search query
3. Calls `TavilyService.search(query, max_results=5)`
4. Yields `writing` SSE event
5. Calls Claude with search results as context; streams tokens
6. Yields `sources` SSE event with ranked sources
7. Yields `done` SSE event

**Citation format:** inline `[1]`, `[2]` markers in text, corresponding to `sources` array index.

### 3.5 RedisService (`app/services/redis_service.py`)

```python
class RedisService:
    async def get_history(self, conversation_id: str) -> list[ChatMessage]: ...
    async def append_turn(
        self, conversation_id: str,
        user_msg: ChatMessage, assistant_msg: ChatMessage
    ) -> None: ...  # resets TTL to 24h on each append
    async def clear(self, conversation_id: str) -> None: ...
```

Key format: `conversation:{conversation_id}`
Value: JSON-encoded `list[ChatMessage]`
TTL: 86400 seconds (24h), reset on each `append_turn`

### 3.6 API Endpoints

**POST `/api/chat`**
- Request: `ChatRequest`
- Response: `text/event-stream` (SSE)
- On Pydantic validation failure: `422 { error: string, code: "INVALID_REQUEST" }`

**GET `/api/health`**
```json
{ "status": "ok", "redis": "ok", "version": "1.0.0" }
```

### 3.7 Error Handling

Custom exception hierarchy:
```python
class OrbitrieveError(Exception): ...
class SearchError(OrbitrieveError): ...   # Tavily failures
class AgentError(OrbitrieveError): ...    # Claude API failures
```

All errors mid-stream are delivered as SSE `error` events — never silently dropped.
HTTP-level errors return `{ "error": str, "code": str }` JSON.

| Code | HTTP | Scenario |
|---|---|---|
| `INVALID_REQUEST` | 422 | Pydantic validation failure |
| `SEARCH_FAILED` | — (SSE) | Tavily API failure |
| `AGENT_FAILED` | — (SSE) | Claude API failure |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected error |

### 3.8 Environment Variables

```bash
# backend/.env
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...
REDIS_URL=redis://localhost:6379
CORS_ORIGINS=http://localhost:5173
PORT=8000
LOG_LEVEL=INFO
```

### 3.9 Logging Rules

- Each module: `logger = logging.getLogger(__name__)`
- Always log: request received (conversation_id, message length), routing decision, search query, request duration
- Never log: full message text (privacy), API keys, full LLM responses, SSE token chunks

---

## 4. Frontend Specification

### 4.1 Directory Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ChatInput.tsx          # input box + send button
│   │   ├── MessageList.tsx        # scrollable message list
│   │   ├── MessageBubble.tsx      # single message (user / assistant)
│   │   ├── SourceCard.tsx         # individual source citation card
│   │   ├── SourceList.tsx         # sources panel below assistant message
│   │   ├── ThinkingIndicator.tsx  # animated stage status (Thinking... / Searching... / Writing...)
│   │   └── CitationLink.tsx       # inline [1][2] clickable markers
│   ├── hooks/
│   │   ├── useChat.ts             # core: send message + SSE stream handling
│   │   └── useConversation.ts     # manages conversation_id (localStorage uuid)
│   ├── store/
│   │   └── chatStore.ts           # Zustand: messages, isLoading, currentStage, error
│   ├── api/
│   │   └── chatApi.ts             # fetch SSE stream, parse events
│   ├── types/
│   │   └── chat.ts                # Message, Source, SSEEvent, Stage interfaces
│   ├── styles/
│   │   └── theme.ts               # yellow-toned color tokens
│   └── App.tsx
├── package.json
├── vite.config.ts
└── docker/
    └── Dockerfile
```

### 4.2 UI Layout

```
┌─────────────────────────────────────────┐
│  🟡 Orbitrieve                [New Chat] │  ← Header
├─────────────────────────────────────────┤
│                                          │
│                  [User bubble]           │
│                                          │
│  [Assistant bubble]                      │
│   Answer text with [1] [2] markers       │
│                                          │
│  ┌───────────────────────────────────┐   │
│  │ Sources                           │   │
│  │ [1] favicon  Yahoo Finance  ↗ url │   │
│  │ [2] favicon  Reuters        ↗ url │   │
│  └───────────────────────────────────┘   │
│                                          │
│  [ThinkingIndicator: Searching... ●●●]   │
│                                          │
├─────────────────────────────────────────┤
│  [Type a message...............] [Send]  │  ← fixed bottom
└─────────────────────────────────────────┘
```

### 4.3 Color System (Yellow-toned Minimal)

| Token | Value | Usage |
|---|---|---|
| `primary` | `#F5C518` | Header accent, Send button, active states |
| `primary-light` | `#FFF8DC` | User bubble background |
| `primary-hover` | `#E6B800` | Send button hover |
| `surface` | `#FFFFFF` | Page background |
| `surface-alt` | `#F9F9F9` | Assistant bubble background |
| `text-primary` | `#1A1A1A` | Main text |
| `text-muted` | `#6B7280` | Source URLs, timestamps |
| `border` | `#E5E7EB` | Card borders, dividers |

### 4.4 Stage Indicator Behaviour

| SSE event | ThinkingIndicator text |
|---|---|
| `thinking` | "Thinking..." |
| `searching` | "Searching the web..." |
| `writing` | "Writing answer..." |
| first `token` | indicator disappears |

If Orchestrator decides no search is needed: only `thinking` → first `token` (no `searching` or `writing` stage shown).

### 4.5 Citation Behaviour

- Inline `[1]` markers rendered as `<CitationLink>` — clickable, scrolls to corresponding `<SourceCard>` in `SourceList`
- `SourceList` appears below the assistant bubble only when `sources` event is received
- Each `SourceCard` shows: favicon, title, truncated URL, snippet
- All source links open in new tab with `rel="noopener noreferrer"`

### 4.6 SSE Parsing (`chatApi.ts`)

```typescript
async function* streamChat(req: ChatRequest): AsyncGenerator<SSEEvent> {
  const response = await fetch('/api/chat', { method: 'POST', body: JSON.stringify(req) })
  const reader = response.body!.getReader()
  // parse `data: {...}\n\n` chunks, yield SSEEvent objects
}
```

### 4.7 Zustand Store Shape (`chatStore.ts`)

```typescript
interface ChatStore {
  messages: Message[]
  isLoading: boolean
  currentStage: 'thinking' | 'searching' | 'writing' | null
  error: string | null
  addUserMessage: (content: string) => void
  appendToken: (token: string) => void
  setStage: (stage: ChatStore['currentStage']) => void
  setSources: (sources: Source[]) => void
  setError: (code: string) => void
  reset: () => void
}
```

### 4.8 Conversation ID

Generated via `crypto.randomUUID()` on first load, persisted in `localStorage` under key `orbitrieve_conversation_id`. "New Chat" button clears localStorage and resets store.

### 4.9 User-Friendly Error Messages

```typescript
const USER_MESSAGES: Record<string, string> = {
  SEARCH_FAILED:  "Couldn't search the web right now. Please try again.",
  AGENT_FAILED:   "AI service is temporarily unavailable. Please try again.",
  RATE_LIMITED:   "Too many requests. Please wait a moment.",
  INTERNAL_ERROR: "Something went wrong. Please refresh the page.",
}
```

### 4.10 Environment Variables

```bash
# frontend/.env
VITE_API_BASE_URL=http://localhost:8000
```

---

## 5. Testing Strategy

### 5.1 Backend — pytest + pytest-asyncio

`asyncio_mode = "auto"` in `pyproject.toml`. All external APIs mocked — no real HTTP calls in unit tests.

| File | Key scenarios |
|---|---|
| `test_orchestrator.py` | stock price query → `needs_search=true`; math question → `false` |
| `test_search_agent.py` | mock Tavily → answer contains `[1]`; Tavily timeout → `SearchError` raised |
| `test_tavily.py` | mock httpx → correct format returned; timeout → `SearchError` |
| `test_chat.py` | POST returns SSE stream; empty message → 422; health endpoint → 200 |

Coverage targets:
- Agent logic: 90%
- API routes: 80%
- Services: 70%

### 5.2 Frontend — Vitest + React Testing Library

Test files co-located with components.

| File | Key scenarios |
|---|---|
| `ChatInput.test.tsx` | Enter sends message; blank input does not send |
| `MessageBubble.test.tsx` | renders user / assistant bubbles correctly |
| `SourceCard.test.tsx` | renders title + URL; has `rel="noopener noreferrer"` |
| `useChat.test.ts` | mock fetch SSE → messages append correctly; error event → error state set |

Coverage targets:
- React hooks: 80%
- React components: 60%

---

## 6. Infrastructure

### 6.1 docker-compose

```yaml
version: "3.9"
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build:
      context: ./backend
      dockerfile: docker/Dockerfile
    ports:
      - "8000:8000"
    env_file: ./backend/.env
    depends_on:
      - redis

  frontend:
    build:
      context: ./frontend
      dockerfile: docker/Dockerfile
    ports:
      - "5173:80"
    depends_on:
      - backend
```

### 6.2 Development Commands

```bash
# Full stack (Docker)
docker-compose up --build

# Backend only
cd backend && uv run uvicorn app.main:app --reload --port 8000

# Frontend only
cd frontend && npm run dev

# Tests
cd backend && uv run pytest --cov=app --cov-report=term-missing
cd frontend && npm test
```

---

## 7. README Requirements

Per assignment, README must include:

1. **Project startup & environment setup** — prerequisites, env var setup, `docker-compose up` instructions
2. **Architecture design explanation** — multi-agent diagram, SSE flow, data model
3. **AI tool usage** — prompts and usage patterns for Claude Code (as required by assignment)
4. **Demo** — recording or live URL link
