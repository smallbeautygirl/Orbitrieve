# Dark Theme Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the frontend from a light theme to a dark editorial theme matching the reference screenshot, and add AI-generated follow-up suggestion pills.

**Architecture:** Incremental — theme tokens first, then each component, then store/hooks wiring, then backend. Each task is independently committable and keeps tests green throughout.

**Tech Stack:** React 18 + TypeScript + Vite, Zustand, Vitest + React Testing Library, FastAPI + OpenAI SDK (backend)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/types/chat.ts` | Modify | Add `suggestions` to SSE types; add `published_date?` to Source |
| `frontend/src/styles/theme.ts` | Modify | Full dark palette replacement |
| `frontend/src/store/chatStore.ts` | Modify | Add `setSuggestions` action |
| `frontend/src/hooks/useChat.ts` | Modify | Handle `suggestions` SSE event in switch |
| `frontend/src/components/Header.tsx` | Modify | Dark header: logo + nav tabs + icon bar |
| `frontend/src/components/MessageBubble.tsx` | Modify | Dark bubbles, ORBITRIEVE ANALYSIS label, citation phrase highlight |
| `frontend/src/components/SourceCard.tsx` | Modify | Dark card, SOURCE N label, ↗ icon |
| `frontend/src/components/SourceList.tsx` | Modify | 2-column grid wrapper |
| `frontend/src/components/SuggestionPills.tsx` | Create | Pill buttons for follow-up suggestions |
| `frontend/src/components/ChatInput.tsx` | Modify | Dark bar, tooltip paperclip, circular send button, disclaimer |
| `frontend/src/App.tsx` | Modify | Full-width dark layout |
| `frontend/src/components/__tests__/MessageBubble.test.tsx` | Modify | Update for new label + citation output |
| `frontend/src/components/__tests__/SourceCard.test.tsx` | Modify | Update for new SOURCE N label (no `[1]` badge) |
| `frontend/src/components/__tests__/SuggestionPills.test.tsx` | Create | Tests for new component |
| `frontend/src/components/__tests__/chatStore.test.ts` | Modify | Add `setSuggestions` test |
| `backend/app/models/chat.py` | Modify | Add `published_date: str | None = None` to Source |
| `backend/app/agents/search_agent.py` | Modify | Buffer answer, generate suggestions, emit `suggestions` event |
| `backend/tests/agents/test_search_agent.py` | Modify | Test that `suggestions` event is emitted |

**Note:** `published_date` is optional — Tavily does not currently return it, so source cards will display domain only. The field is added for future extensibility.

---

## Task 1: Update TypeScript types

**Files:**
- Modify: `frontend/src/types/chat.ts`

- [ ] **Step 1: Replace the file content**

```typescript
// frontend/src/types/chat.ts
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Source {
  index: number;
  title: string;
  url: string;
  snippet: string;
  published_date?: string;
}

export type Stage = 'thinking' | 'searching' | 'writing' | null;

export type SSEEventType =
  | 'thinking'
  | 'searching'
  | 'writing'
  | 'token'
  | 'sources'
  | 'suggestions'
  | 'done'
  | 'error';

export interface SSEEvent {
  type: SSEEventType;
  content?: string;
  sources?: Source[];
  suggestions?: string[];
  code?: string;
  error?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  suggestions?: string[];
}

export interface ChatRequest {
  message: string;
  conversation_id: string;
  history: ChatMessage[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/types/chat.ts
git commit -m "feat(chat): ✨ add suggestions to SSE types and published_date to Source"
```

---

## Task 2: Replace the theme with dark palette

**Files:**
- Modify: `frontend/src/styles/theme.ts`

- [ ] **Step 1: Replace the file content**

```typescript
// frontend/src/styles/theme.ts
export const theme = {
  colors: {
    bg:             '#111111',
    bgCard:         '#1a1a1a',
    bgInput:        '#1a1a1a',
    bgUserMsg:      '#1c1c1c',
    border:         '#2a2a2a',
    borderSubtle:   '#1e1e1e',
    primary:        '#F5A623',
    primaryDim:     'rgba(245,166,35,0.12)',
    primaryGlow:    'rgba(245,166,35,0.18)',
    textPrimary:    '#e8e8e8',
    textMuted:      '#cccccc',
    textDim:        '#666666',
    textPlaceholder: '#444444',
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
} as const;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors (components that reference removed color keys like `surface`, `surfaceAlt`, `primaryLight`, `primaryHover` will show errors — fix them in subsequent tasks).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/theme.ts
git commit -m "style(ui): 🎨 replace light theme with dark editorial palette"
```

---

## Task 3: Add setSuggestions to store and handle in useChat

**Files:**
- Modify: `frontend/src/store/chatStore.ts`
- Modify: `frontend/src/hooks/useChat.ts`
- Modify: `frontend/src/components/__tests__/chatStore.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test to `frontend/src/components/__tests__/chatStore.test.ts`:

```typescript
it('setSuggestions attaches suggestions to the correct message', () => {
  const id = useChatStore.getState().startAssistantMessage();
  useChatStore.getState().setSuggestions(id, ['What next?', 'Tell me more']);
  expect(useChatStore.getState().messages[0].suggestions).toEqual([
    'What next?',
    'Tell me more',
  ]);
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd frontend && npm test -- chatStore
```

Expected: FAIL — `setSuggestions is not a function`.

- [ ] **Step 3: Add setSuggestions to the store**

Replace `frontend/src/store/chatStore.ts` with:

```typescript
import { create } from 'zustand';
import type { Message, Source, Stage } from '../types/chat';

interface ChatStore {
  messages: Message[];
  isLoading: boolean;
  currentStage: Stage;
  error: string | null;
  addUserMessage: (content: string) => string;
  startAssistantMessage: () => string;
  appendToken: (id: string, token: string) => void;
  setStage: (stage: Stage) => void;
  setSources: (id: string, sources: Source[]) => void;
  setSuggestions: (id: string, suggestions: string[]) => void;
  setError: (error: string) => void;
  finishLoading: () => void;
  reset: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isLoading: false,
  currentStage: null,
  error: null,

  addUserMessage: (content) => {
    const id = crypto.randomUUID();
    set((state) => ({
      messages: [...state.messages, { id, role: 'user', content }],
      isLoading: true,
      currentStage: 'thinking',
      error: null,
    }));
    return id;
  },

  startAssistantMessage: () => {
    const id = crypto.randomUUID();
    set((state) => ({
      messages: [...state.messages, { id, role: 'assistant', content: '' }],
    }));
    return id;
  },

  appendToken: (id, token) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, content: m.content + token } : m)),
    })),

  setStage: (currentStage) => set({ currentStage }),

  setSources: (id, sources) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, sources } : m)),
    })),

  setSuggestions: (id, suggestions) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, suggestions } : m)),
    })),

  setError: (error) => set({ error, isLoading: false, currentStage: null }),

  finishLoading: () => set({ isLoading: false, currentStage: null }),

  reset: () => set({ messages: [], isLoading: false, currentStage: null, error: null }),
}));
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd frontend && npm test -- chatStore
```

Expected: all chatStore tests PASS.

- [ ] **Step 5: Handle suggestions event in useChat**

Replace the `switch` block in `frontend/src/hooks/useChat.ts` to add the `suggestions` case:

```typescript
switch (event.type) {
  case 'thinking':
  case 'searching':
  case 'writing':
    store.setStage(event.type);
    break;
  case 'token':
    store.setStage(null);
    if (event.content) store.appendToken(assistantId, event.content);
    break;
  case 'sources':
    if (event.sources) store.setSources(assistantId, event.sources);
    break;
  case 'suggestions':
    if (event.suggestions) store.setSuggestions(assistantId, event.suggestions);
    break;
  case 'done':
    store.finishLoading();
    break;
  case 'error':
    store.setError(
      USER_MESSAGES[event.code ?? 'INTERNAL_ERROR'] ?? USER_MESSAGES['INTERNAL_ERROR'],
    );
    break;
}
```

- [ ] **Step 6: Run all frontend tests**

```bash
cd frontend && npm test
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/store/chatStore.ts frontend/src/hooks/useChat.ts \
        frontend/src/components/__tests__/chatStore.test.ts
git commit -m "feat(store): ✨ add setSuggestions action and handle suggestions SSE event"
```

---

## Task 4: Redesign Header

**Files:**
- Modify: `frontend/src/components/Header.tsx`

- [ ] **Step 1: Replace Header.tsx**

```typescript
// frontend/src/components/Header.tsx
import { OrbitrieveIcon } from './OrbitrieveIcon';

interface HeaderProps {
  onNewChat: () => void;
}

export function Header({ onNewChat: _onNewChat }: HeaderProps): JSX.Element {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 24px',
        backgroundColor: '#111111',
        borderBottom: '1px solid #2a2a2a',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <OrbitrieveIcon size={26} />
        <span
          style={{
            fontSize: '17px',
            fontWeight: 700,
            color: '#F5A623',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            letterSpacing: '0.01em',
          }}
        >
          Orbitrieve
        </span>
      </div>

      {/* Nav tabs — visual only */}
      <nav style={{ display: 'flex', gap: '32px' }} aria-label="Main navigation">
        {(['Models', 'History', 'Library'] as const).map((label) => (
          <span
            key={label}
            style={{
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: label === 'History' ? '#F5A623' : '#666666',
              paddingBottom: '2px',
              borderBottom: label === 'History' ? '2px solid #F5A623' : '2px solid transparent',
              cursor: 'default',
              userSelect: 'none',
            }}
          >
            {label}
          </span>
        ))}
      </nav>

      {/* Icon bar — decorative */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {[
          { label: '⚙', title: 'Settings' },
          { label: '?', title: 'Help' },
          { label: '👤', title: 'Account' },
        ].map(({ label, title }) => (
          <div
            key={title}
            title={title}
            aria-label={title}
            style={{
              width: '28px',
              height: '28px',
              background: '#1e1e1e',
              border: '1px solid #2a2a2a',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              color: '#888',
              cursor: 'default',
              userSelect: 'none',
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Run all frontend tests**

```bash
cd frontend && npm test
```

Expected: all tests PASS (Header has no dedicated test file).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Header.tsx
git commit -m "style(ui): 🎨 dark header with nav tabs and icon bar"
```

---

## Task 5: Redesign MessageBubble with citation phrase highlighting

**Files:**
- Modify: `frontend/src/components/MessageBubble.tsx`
- Modify: `frontend/src/components/__tests__/MessageBubble.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace `frontend/src/components/__tests__/MessageBubble.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from '../MessageBubble';
import type { Message } from '../../types/chat';

describe('MessageBubble', () => {
  it('renders user message content', () => {
    const msg: Message = { id: '1', role: 'user', content: 'Hello there' };
    render(<MessageBubble message={msg} onSuggestionSelect={() => {}} />);
    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('renders ORBITRIEVE ANALYSIS label for assistant messages', () => {
    const msg: Message = { id: '2', role: 'assistant', content: 'I am an AI' };
    render(<MessageBubble message={msg} onSuggestionSelect={() => {}} />);
    expect(screen.getByText('Orbitrieve Analysis')).toBeInTheDocument();
  });

  it('renders the phrase before [1] with amber highlight', () => {
    const msg: Message = { id: '3', role: 'assistant', content: 'Apple hit record highs [1]' };
    render(<MessageBubble message={msg} onSuggestionSelect={() => {}} />);
    // The highlighted span contains the trailing phrase
    expect(screen.getByText('record highs')).toBeInTheDocument();
  });

  it('renders source list when assistant message has sources', () => {
    const msg: Message = {
      id: '4',
      role: 'assistant',
      content: 'Apple is $213 [1]',
      sources: [
        { index: 1, title: 'Yahoo Finance', url: 'https://finance.yahoo.com', snippet: 'AAPL $213' },
      ],
    };
    render(<MessageBubble message={msg} onSuggestionSelect={() => {}} />);
    expect(screen.getByText('Yahoo Finance')).toBeInTheDocument();
  });

  it('renders suggestion pills when message has suggestions', () => {
    const msg: Message = {
      id: '5',
      role: 'assistant',
      content: 'Here is an answer.',
      suggestions: ['What next?', 'Tell me more'],
    };
    render(<MessageBubble message={msg} onSuggestionSelect={() => {}} />);
    expect(screen.getByText('What next?')).toBeInTheDocument();
    expect(screen.getByText('Tell me more')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend && npm test -- MessageBubble
```

Expected: FAIL — `onSuggestionSelect` prop missing, `Orbitrieve Analysis` not in DOM.

- [ ] **Step 3: Implement the new MessageBubble**

Replace `frontend/src/components/MessageBubble.tsx`:

```typescript
import type { ReactNode } from 'react';
import type { Message } from '../types/chat';
import { theme } from '../styles/theme';
import { SourceList } from './SourceList';
import { SuggestionPills } from './SuggestionPills';
import { OrbitrieveIcon } from './OrbitrieveIcon';

interface MessageBubbleProps {
  message: Message;
  onSuggestionSelect: (text: string) => void;
}

/** Extract the trailing phrase (up to 5 words) before a citation marker. */
function extractTrailingPhrase(text: string): string {
  // Split on sentence-ending punctuation, take the last segment
  const afterPunct = text.split(/[.,;!?]/).pop()?.trim() ?? '';
  const source = afterPunct || text.trim();
  const words = source.split(/\s+/).filter(Boolean);
  return words.slice(-5).join(' ');
}

function parseContent(content: string): ReactNode[] {
  const parts = content.split(/(\[\d+\])/g);
  const result: ReactNode[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const citationMatch = part.match(/^\[(\d+)\]$/);

    if (citationMatch) {
      result.push(
        <span
          key={`badge-${i}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '18px',
            height: '18px',
            background: '#2a1800',
            border: `1px solid ${theme.colors.primary}`,
            borderRadius: '50%',
            fontSize: '10px',
            fontWeight: 700,
            color: theme.colors.primary,
            marginLeft: '2px',
            verticalAlign: 'middle',
            position: 'relative',
            top: '-1px',
          }}
        >
          {parseInt(citationMatch[1])}
        </span>,
      );
    } else {
      const nextIsCitation = parts[i + 1]?.match(/^\[\d+\]$/);
      if (nextIsCitation && part.trim()) {
        const phrase = extractTrailingPhrase(part);
        const prefix = part.slice(0, part.length - phrase.length);
        if (prefix) result.push(<span key={`pre-${i}`}>{prefix}</span>);
        result.push(
          <span
            key={`hi-${i}`}
            style={{
              background: theme.colors.primaryGlow,
              color: theme.colors.primary,
              borderRadius: '3px',
              padding: '1px 3px',
            }}
          >
            {phrase}
          </span>,
        );
      } else {
        result.push(<span key={`text-${i}`}>{part}</span>);
      }
    }
  }

  return result;
}

export function MessageBubble({ message, onSuggestionSelect }: MessageBubbleProps): JSX.Element {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '0 16px', marginBottom: '12px' }}>
        <div
          style={{
            maxWidth: '72%',
            padding: '16px 22px',
            borderRadius: '14px',
            backgroundColor: theme.colors.bgUserMsg,
            border: `1px solid ${theme.colors.border}`,
            fontSize: '15px',
            lineHeight: '1.55',
            color: theme.colors.textMuted,
            fontFamily: theme.fonts.base,
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* ORBITRIEVE ANALYSIS label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <OrbitrieveIcon size={26} />
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: theme.colors.primary,
          }}
        >
          Orbitrieve Analysis
        </span>
      </div>

      {/* Body */}
      <div
        style={{
          fontSize: '15px',
          lineHeight: '1.7',
          color: theme.colors.textMuted,
          fontFamily: theme.fonts.base,
        }}
      >
        {parseContent(message.content)}
      </div>

      {/* Sources */}
      {message.sources && message.sources.length > 0 && (
        <SourceList sources={message.sources} />
      )}

      {/* Suggestion pills */}
      {message.suggestions && message.suggestions.length > 0 && (
        <SuggestionPills suggestions={message.suggestions} onSelect={onSuggestionSelect} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd frontend && npm test -- MessageBubble
```

Expected: all MessageBubble tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/MessageBubble.tsx \
        frontend/src/components/__tests__/MessageBubble.test.tsx
git commit -m "style(chat): 🎨 dark MessageBubble with ORBITRIEVE ANALYSIS label and citation highlights"
```

---

## Task 6: Redesign SourceCard and SourceList

**Files:**
- Modify: `frontend/src/components/SourceCard.tsx`
- Modify: `frontend/src/components/SourceList.tsx`
- Modify: `frontend/src/components/__tests__/SourceCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Replace `frontend/src/components/__tests__/SourceCard.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SourceCard } from '../SourceCard';

const source = {
  index: 1,
  title: 'Reuters Finance',
  url: 'https://reuters.com/finance',
  snippet: 'Apple stock rose 1.2% today.',
};

describe('SourceCard', () => {
  it('renders the source title', () => {
    render(<SourceCard source={source} />);
    expect(screen.getByText('Reuters Finance')).toBeInTheDocument();
  });

  it('renders SOURCE 1 label', () => {
    render(<SourceCard source={source} />);
    expect(screen.getByText('Source 1')).toBeInTheDocument();
  });

  it('renders the domain as meta text', () => {
    render(<SourceCard source={source} />);
    expect(screen.getByText('reuters.com')).toBeInTheDocument();
  });

  it('renders a link with noopener noreferrer', () => {
    render(<SourceCard source={source} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('href', 'https://reuters.com/finance');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend && npm test -- SourceCard
```

Expected: FAIL — `Source 1` label not found, `reuters.com` not found, `[1]` still rendered.

- [ ] **Step 3: Implement the new SourceCard**

Replace `frontend/src/components/SourceCard.tsx`:

```typescript
import type { Source } from '../types/chat';
import { theme } from '../styles/theme';

interface SourceCardProps {
  source: Source;
}

export function SourceCard({ source }: SourceCardProps): JSX.Element {
  const domain = (() => {
    try {
      return new URL(source.url).hostname.replace('www.', '');
    } catch {
      return source.url;
    }
  })();

  const meta = source.published_date ? `${domain} · Published ${source.published_date}` : domain;

  return (
    <a
      id={`source-card-${source.index}`}
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        position: 'relative',
        padding: '12px 14px',
        background: theme.colors.bgCard,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '10px',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 0.15s',
      }}
    >
      {/* SOURCE N label */}
      <span
        style={{
          display: 'inline-block',
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: theme.colors.primary,
          background: theme.colors.primaryDim,
          padding: '2px 6px',
          borderRadius: '4px',
          marginBottom: '8px',
        }}
      >
        Source {source.index}
      </span>

      {/* External link icon */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          fontSize: '12px',
          color: theme.colors.textDim,
        }}
      >
        ↗
      </span>

      {/* Title */}
      <div
        style={{
          fontSize: '13px',
          fontWeight: 700,
          color: theme.colors.textPrimary,
          marginBottom: '5px',
          paddingRight: '20px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {source.title}
      </div>

      {/* Meta */}
      <div style={{ fontSize: '11px', color: theme.colors.textDim }}>{meta}</div>
    </a>
  );
}
```

- [ ] **Step 4: Update SourceList to use 2-column grid**

Replace `frontend/src/components/SourceList.tsx`:

```typescript
import type { Source } from '../types/chat';
import { SourceCard } from './SourceCard';

interface SourceListProps {
  sources: Source[];
}

export function SourceList({ sources }: SourceListProps): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '10px',
        marginTop: '4px',
      }}
    >
      {sources.map((source) => (
        <SourceCard key={source.index} source={source} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run tests**

```bash
cd frontend && npm test -- SourceCard
```

Expected: all SourceCard tests PASS.

- [ ] **Step 6: Run all frontend tests**

```bash
cd frontend && npm test
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/SourceCard.tsx \
        frontend/src/components/SourceList.tsx \
        frontend/src/components/__tests__/SourceCard.test.tsx
git commit -m "style(chat): 🎨 dark SourceCard with SOURCE N label and 2-column SourceList grid"
```

---

## Task 7: Create SuggestionPills component

**Files:**
- Create: `frontend/src/components/SuggestionPills.tsx`
- Create: `frontend/src/components/__tests__/SuggestionPills.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/__tests__/SuggestionPills.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuggestionPills } from '../SuggestionPills';

describe('SuggestionPills', () => {
  it('renders each suggestion as a button', () => {
    render(
      <SuggestionPills
        suggestions={['What next?', 'Tell me more']}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'What next?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tell me more' })).toBeInTheDocument();
  });

  it('calls onSelect with the pill text when clicked', async () => {
    const onSelect = vi.fn();
    render(
      <SuggestionPills
        suggestions={['Deep dive?']}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Deep dive?' }));
    expect(onSelect).toHaveBeenCalledWith('Deep dive?');
  });

  it('renders nothing when suggestions array is empty', () => {
    const { container } = render(
      <SuggestionPills suggestions={[]} onSelect={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend && npm test -- SuggestionPills
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement SuggestionPills**

Create `frontend/src/components/SuggestionPills.tsx`:

```typescript
import { theme } from '../styles/theme';

interface SuggestionPillsProps {
  suggestions: string[];
  onSelect: (text: string) => void;
}

export function SuggestionPills({ suggestions, onSelect }: SuggestionPillsProps): JSX.Element | null {
  if (suggestions.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
      {suggestions.map((text, i) => (
        <button
          key={i}
          onClick={() => onSelect(text)}
          style={{
            background: theme.colors.bgUserMsg,
            border: `1px solid #2e2e2e`,
            borderRadius: theme.radii.full,
            padding: '8px 16px',
            fontSize: '13px',
            color: '#bbbbbb',
            cursor: 'pointer',
            fontFamily: theme.fonts.base,
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = theme.colors.primary;
            (e.currentTarget as HTMLButtonElement).style.color = theme.colors.primary;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#2e2e2e';
            (e.currentTarget as HTMLButtonElement).style.color = '#bbbbbb';
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd frontend && npm test -- SuggestionPills
```

Expected: all SuggestionPills tests PASS.

- [ ] **Step 5: Run all frontend tests**

```bash
cd frontend && npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/SuggestionPills.tsx \
        frontend/src/components/__tests__/SuggestionPills.test.tsx
git commit -m "feat(chat): ✨ add SuggestionPills component for AI-generated follow-up questions"
```

---

## Task 8: Redesign ChatInput

**Files:**
- Modify: `frontend/src/components/ChatInput.tsx`
- Modify: `frontend/src/components/__tests__/ChatInput.test.tsx`

The send button changes from text "Send" to an arrow icon, but keeps `aria-label="Send"` so existing tests continue to find it via `getByRole('button', { name: /send/i })`. The paperclip tooltip is added as a `title` attribute (CSS-only tooltip from the mockup becomes a native browser tooltip here for simplicity and test-friendliness).

- [ ] **Step 1: Verify existing tests still pass as-is (they should — aria-label is preserved)**

```bash
cd frontend && npm test -- ChatInput
```

Expected: all PASS (before any code change — confirms baseline).

- [ ] **Step 2: Replace ChatInput.tsx**

```typescript
import { useState, useRef, type KeyboardEvent } from 'react';
import { theme } from '../styles/theme';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps): JSX.Element {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = (): void => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        padding: '14px 20px 10px',
        backgroundColor: '#111111',
        borderTop: `1px solid ${theme.colors.borderSubtle}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: theme.colors.bgInput,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '14px',
          padding: '10px 14px',
        }}
      >
        {/* Paperclip — decorative, tooltip signals future feature */}
        <span
          title="Attachments coming soon"
          aria-label="Attachments coming soon"
          style={{
            fontSize: '16px',
            color: theme.colors.textDim,
            flexShrink: 0,
            cursor: 'default',
            userSelect: 'none',
          }}
        >
          📎
        </span>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="Ask Orbitrieve anything..."
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            fontFamily: theme.fonts.base,
            fontSize: '14px',
            lineHeight: '1.5',
            color: theme.colors.textMuted,
          }}
        />

        <button
          onClick={handleSend}
          disabled={isLoading || !value.trim()}
          aria-label="Send"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor:
              isLoading || !value.trim() ? theme.colors.border : theme.colors.primary,
            color: '#111111',
            fontSize: '16px',
            cursor: isLoading || !value.trim() ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.15s',
          }}
        >
          ➤
        </button>
      </div>

      <p
        style={{
          textAlign: 'center',
          fontSize: '10px',
          color: '#444444',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          margin: 0,
        }}
      >
        Orbitrieve can make mistakes. Verify important info.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Run ChatInput tests**

```bash
cd frontend && npm test -- ChatInput
```

Expected: all PASS (aria-label="Send" preserved; placeholder text changed but tests don't test placeholder).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ChatInput.tsx
git commit -m "style(chat): 🎨 dark ChatInput with paperclip tooltip and circular send button"
```

---

## Task 9: Update App layout and wire onSuggestionSelect

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/MessageList.tsx`

`MessageBubble` now requires `onSuggestionSelect`. This prop needs to flow from `App` → `MessageList` → `MessageBubble`. `App` already has `sendMessage` from `useChat`, so we pass it as `onSuggestionSelect`.

- [ ] **Step 1: Update MessageList to pass onSuggestionSelect down**

Replace `frontend/src/components/MessageList.tsx`:

```typescript
import { useEffect, useRef } from 'react';
import type { Message, Stage } from '../types/chat';
import { MessageBubble } from './MessageBubble';
import { ThinkingIndicator } from './ThinkingIndicator';
import { theme } from '../styles/theme';

interface MessageListProps {
  messages: Message[];
  currentStage: Stage;
  onSuggestionSelect: (text: string) => void;
}

export function MessageList({ messages, currentStage, onSuggestionSelect }: MessageListProps): JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStage]);

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 0',
        backgroundColor: theme.colors.bg,
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
            color: theme.colors.textDim,
            fontSize: '14px',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '32px' }}>🔍</span>
          <span>Ask me anything — I'll search the web when needed.</span>
        </div>
      )}
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} onSuggestionSelect={onSuggestionSelect} />
      ))}
      {currentStage && (
        <div style={{ padding: '0 30px' }}>
          <ThinkingIndicator stage={currentStage} />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 2: Update App.tsx**

Replace `frontend/src/App.tsx`:

```typescript
import { useChatStore } from './store/chatStore';
import { useChat } from './hooks/useChat';
import { useConversation } from './hooks/useConversation';
import { Header } from './components/Header';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';

export default function App(): JSX.Element {
  const { messages, isLoading, currentStage } = useChatStore();
  const { sendMessage } = useChat();
  const { resetConversation } = useConversation();
  const reset = useChatStore((s) => s.reset);

  const handleNewChat = (): void => {
    resetConversation();
    reset();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#111111',
      }}
    >
      <Header onNewChat={handleNewChat} />
      <MessageList
        messages={messages}
        currentStage={currentStage}
        onSuggestionSelect={sendMessage}
      />
      <ChatInput onSend={sendMessage} isLoading={isLoading} />
    </div>
  );
}
```

- [ ] **Step 3: Run all frontend tests**

```bash
cd frontend && npm test
```

Expected: all tests PASS.

- [ ] **Step 4: Start the dev server and visually verify**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173 and confirm the dark theme renders correctly.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/MessageList.tsx
git commit -m "style(ui): 🎨 full-width dark App layout and wire suggestion pills to sendMessage"
```

---

## Task 10: Backend — emit suggestions SSE event

**Files:**
- Modify: `backend/app/agents/search_agent.py`
- Modify: `backend/app/models/chat.py`
- Modify: `backend/tests/agents/test_search_agent.py`

The existing `test_search_agent.py` uses Anthropic-style stream mocks (`client.messages.stream`) but the code already uses OpenAI SDK — those tests are already broken. Replace the full test file with corrected mocks and then add the suggestions test.

- [ ] **Step 1: Replace the full test file with corrected OpenAI mocks**

Replace `backend/tests/agents/test_search_agent.py`:

```python
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
```

- [ ] **Step 2: Run the new tests to confirm the suggestions test fails (others should pass once code is updated)**

```bash
cd backend && uv run pytest tests/agents/test_search_agent.py -v
```

Expected: `test_search_agent_emits_suggestions_event` FAIL; others may fail too until implementation is updated in the next step.

- [ ] **Step 3: Add published_date to backend Source model**

In `backend/app/models/chat.py`, add the optional field to `Source`:

```python
class Source(BaseModel):
    index: int
    title: str
    url: str
    snippet: str
    published_date: str | None = None
```

- [ ] **Step 4: Update SearchAgent to emit suggestions**

Replace `backend/app/agents/search_agent.py`:

```python
from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator

from openai import AsyncOpenAI

from app.core.config import settings
from app.core.exceptions import AgentError
from app.models.chat import ChatMessage
from app.prompts.search_agent import SYSTEM_PROMPT_TEMPLATE, format_search_results
from app.services.tavily import TavilyService

logger = logging.getLogger(__name__)


class SearchAgent:
    def __init__(self, client: AsyncOpenAI, tavily: TavilyService) -> None:
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

        full_answer = ""
        try:
            stream = await self._client.chat.completions.create(
                model=settings.llm_model,
                max_tokens=1024,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": message},
                ],
                stream=True,
            )
            async for chunk in stream:
                text = chunk.choices[0].delta.content
                if text:
                    full_answer += text
                    yield json.dumps({"type": "token", "content": text})
        except Exception as e:
            raise AgentError("Search agent synthesis failed") from e

        yield json.dumps(
            {"type": "sources", "sources": [s.model_dump() for s in sources]}
        )

        suggestions = await self._generate_suggestions(message, full_answer)
        yield json.dumps({"type": "suggestions", "suggestions": suggestions})

        yield json.dumps({"type": "done"})

    async def _generate_suggestions(self, question: str, answer: str) -> list[str]:
        """Generate 2 follow-up questions based on the question and answer."""
        prompt = (
            "Based on this Q&A, write exactly 2 short follow-up questions a curious reader would ask. "
            "Output only the 2 questions, one per line, no numbering, no extra text.\n\n"
            f"Q: {question}\nA: {answer[:500]}"
        )
        try:
            response = await self._client.chat.completions.create(
                model=settings.llm_model,
                max_tokens=120,
                messages=[{"role": "user", "content": prompt}],
                stream=False,
            )
            content = response.choices[0].message.content or ""
            lines = [line.strip() for line in content.strip().splitlines() if line.strip()]
            return lines[:3]
        except Exception:
            logger.warning("Failed to generate follow-up suggestions")
            return []
```

- [ ] **Step 5: Run the new test**

```bash
cd backend && uv run pytest tests/agents/test_search_agent.py::test_search_agent_emits_suggestions_event -v
```

Expected: PASS.

- [ ] **Step 6: Run the full backend test suite**

```bash
cd backend && uv run pytest -v
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/agents/search_agent.py \
        backend/app/models/chat.py \
        backend/tests/agents/test_search_agent.py
git commit -m "feat(search): ✨ emit suggestions SSE event with AI-generated follow-up questions"
```

---

## Done

Run the full stack to do an end-to-end check:

```bash
# Terminal 1
cd backend && uv run uvicorn app.main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

Open http://localhost:5173, ask a question that triggers a web search (e.g. "What is Apple's stock price today?"), and verify:

1. Dark theme renders throughout
2. User message appears as a centered dark card
3. Response shows "ORBITRIEVE ANALYSIS" label
4. Cited phrases are highlighted in amber before `[N]` badges
5. Source cards appear in a 2-column grid with SOURCE N labels
6. Follow-up suggestion pills appear below sources
7. Clicking a pill sends that text as a new message
8. Paperclip shows "Attachments coming soon" tooltip on hover
9. Send button is circular amber
