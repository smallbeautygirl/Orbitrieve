# Orbitrieve — Claude Code Project Guide

**Orbitrieve** is a smart AI web-search chatbot. It navigates the web and retrieves citation-backed answers using a multi-agent architecture.

---

## Project Overview

A web search chatbot powered by **2 collaborative AI Agents**:

| Agent | Role |
|-------|------|
| **Orchestrator Agent** | Receives user message, decides if web search is needed, routes to Search Agent or answers directly |
| **Search & Synthesis Agent** | Executes web searches, collects sources, synthesizes a cited answer |

Key features:
- Answers time-sensitive questions (stock prices, news, exchange rates, weather)
- Only searches the web when genuinely needed (not for every message)
- Every web-sourced answer includes inline source citations
- Streaming responses for real-time UX

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Python 3.12 + FastAPI |
| Agent framework | Claude API (claude-sonnet-4-6) via `anthropic` SDK |
| Web search | Tavily Search API |
| Streaming | Server-Sent Events (SSE) |
| State management | Zustand |
| HTTP client | Axios + React Query |

---

## Project Structure

```
Orbitrieve/
├── CLAUDE.md                  ← this file
├── backend/
│   ├── main.py
│   ├── pyproject.toml
│   ├── app/
│   │   ├── api/               ← FastAPI routers
│   │   ├── agents/            ← Orchestrator + Search agents
│   │   ├── services/          ← Tavily, Claude API wrappers
│   │   ├── models/            ← Pydantic schemas
│   │   └── core/              ← Config, logging, middleware
│   └── tests/
└── frontend/
    ├── src/
    │   ├── components/        ← Chat UI components
    │   ├── hooks/             ← Custom React hooks
    │   ├── store/             ← Zustand stores
    │   ├── api/               ← API client layer
    │   └── types/             ← TypeScript interfaces
    └── package.json
```

---

## Multi-Agent Architecture

```
User Message
     │
     ▼
┌─────────────────────────────┐
│   Orchestrator Agent        │  Claude claude-sonnet-4-6
│   - Classify intent         │
│   - Decide: search or not   │
│   - Pass context forward    │
└──────────┬──────────────────┘
           │ needs web search?
    ┌──────┴──────┐
   Yes            No
    │              │
    ▼              ▼
┌──────────┐   Direct Answer
│  Search  │   (streamed)
│  Agent   │   Claude claude-sonnet-4-6
│          │
│ 1. Query │──► Tavily Search API
│ 2. Rank  │◄── Raw results + URLs
│ 3. Synth │
│ 4. Cite  │──► Cited answer (streamed)
└──────────┘
```

### When to trigger web search
The Orchestrator must search when the user asks about:
- Current stock prices / financial data
- Today's news / recent events
- Live exchange rates / crypto prices
- Weather forecasts
- Sports scores / live results
- Any question containing words: "today", "now", "current", "latest", "live", "price of", "rate of"

Do NOT search for: general knowledge, coding questions, math, definitions, historical facts.

---

## API Contract

### POST `/api/chat` — streaming endpoint

**Request**
```json
{
  "message": "What is Apple's stock price today?",
  "conversation_id": "uuid",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response** (SSE stream)
```
data: {"type": "thinking", "content": "Searching the web..."}
data: {"type": "token", "content": "Apple (AAPL) is currently "}
data: {"type": "token", "content": "trading at $213.42 "}
data: {"type": "sources", "sources": [{"title": "...", "url": "...", "snippet": "..."}]}
data: {"type": "done"}
```

---

## Skill Files

- [Python Backend Skill](docs/skills/python-backend.md) — FastAPI, agents, SSE, Tavily
- [Python Best Practices](docs/skills/python-best-practices.md) — type hints, async, error handling, testing, tooling
- [React Frontend Skill](docs/skills/react-frontend.md) — React/TS, Zustand, SSE streaming, citations

---

## Environment Variables

```bash
# Backend (.env)
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...
CORS_ORIGINS=http://localhost:5173
PORT=8000

# Frontend (.env)
VITE_API_BASE_URL=http://localhost:8000
```

---

## Development Commands

```bash
# Backend
cd backend
uv run uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm run dev

# Tests
cd backend && uv run pytest
cd frontend && npm test
```

---

## Code Standards

- All Python functions have type hints
- All TypeScript components have explicit prop interfaces
- No `any` types in TypeScript
- API errors must return structured `{ error: string, code: string }` JSON
- Agent prompts live in dedicated `prompts/` module, never inline
- Citations use `[1]`, `[2]` inline markers linked to the `sources` array
- Streaming must work end-to-end; never buffer the full response before sending
