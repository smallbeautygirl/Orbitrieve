# Orbitrieve

A smart AI search system that explores the web for relevant information and generates accurate, citation-backed answers.

> "Orbitrieve comes from the words 'orbit' and 'retrieve', symbolizing its ability to navigate the vast expanse of the web and retrieve relevant information efficiently."

---

## Architecture

```
User Message
     │
     ▼
┌─────────────────────────────┐
│      Orchestrator Agent     │  ← qwen3-32b
│                             │
│  - Classify user intent     │
│  - Decide: search or not    │
└──────────┬──────────────────┘
           │
    ┌──────┴──────┐
   Yes            No
    │              │
    ▼              ▼
┌──────────────┐  Direct Answer
│ Search Agent │  (streamed via SSE)
│              │
│ 1. Query     │──► Tavily Search API
│ 2. Rank      │◄── Raw results + URLs
│ 3. Synthesize│
│ 4. Cite [1]  │──► Cited answer (streamed via SSE)
└──────────────┘
```

### SSE Event Flow

```
Backend                          Frontend
  │                                 │
  │── data: {type:"thinking"} ─────►│  "Searching the web..."
  │── data: {type:"token"} ────────►│  stream tokens to UI
  │── data: {type:"sources"} ──────►│  render citation cards
  │── data: {type:"done"} ─────────►│  finalize message
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Python 3.12 + FastAPI |
| Agents | Qwen3-32B (via custom LLM endpoint) or Gemini API |
| Web Search | Tavily Search API |
| Streaming | Server-Sent Events (SSE) |
| State | Zustand |

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- [`uv`](https://github.com/astral-sh/uv) (Python package manager)
- API keys: `LLM_API_KEY` **or** `GEMINI_API_KEY` (choose one LLM provider), plus `TAVILY_API_KEY`

### Environment Variables

**Backend** — create `backend/.env`:

```bash
# Option A: custom LLM endpoint (e.g. Qwen3-32B)
LLM_API_KEY=...
LLM_BASE_URL=https://...
LLM_MODEL=qwen3-32b

# Option B: Gemini API
GEMINI_API_KEY=...

TAVILY_API_KEY=tvly-...
CORS_ORIGINS=["http://localhost:5173"]
PORT=8000
LOG_LEVEL=INFO
```

**Frontend** — create `frontend/.env`:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

### Option 1 — Docker Compose (recommended)

```bash
docker compose up -d
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

### Option 2 — Local Dev

**Backend:**

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

---

## Project Structure

```
Orbitrieve/
├── backend/
│   ├── main.py
│   ├── pyproject.toml
│   └── app/
│       ├── api/               ← FastAPI routers
│       ├── agents/            ← Orchestrator + Search agents
│       ├── services/          ← Tavily, Claude API wrappers
│       ├── models/            ← Pydantic schemas
│       └── core/              ← Config, logging, middleware
└── frontend/
    └── src/
        ├── components/        ← Chat UI components
        ├── hooks/             ← Custom React hooks
        ├── store/             ← Zustand stores
        ├── api/               ← API client layer
        └── types/             ← TypeScript interfaces
```

---

## Running Tests

```bash
# Backend
cd backend
uv run pytest
uv run pytest --cov=app --cov-report=term-missing   # with coverage

# Frontend
cd frontend
npm test
```
