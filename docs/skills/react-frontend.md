---
name: react-frontend
description: React 18 + TypeScript + Vite patterns for Orbitrieve — chatbot UI with SSE streaming, source citations, Zustand state, and React Query.
type: skill
---

# React Frontend Skill — Orbitrieve

## When to Activate
- Building or modifying chat UI components
- Implementing SSE streaming from the backend
- Managing conversation state with Zustand
- Displaying source citations inline
- Writing custom hooks for chat or search state

---

## Core Principles

1. **No `any` types** — every prop and state has an explicit interface
2. **Composition over monolithic components** — `ChatWindow` → `MessageList` → `Message` → `CitationBadge`
3. **Custom hooks own all logic** — components only render; hooks fetch/transform/manage state
4. **SSE streaming in a hook** — never manage `EventSource` directly in components
5. **Optimistic UI** — append user message immediately, stream assistant response token by token

---

## Project Layout

```
frontend/src/
├── components/
│   ├── ChatWindow.tsx       ← main layout shell
│   ├── MessageList.tsx      ← scrollable message history
│   ├── Message.tsx          ← single message bubble
│   ├── CitationBadge.tsx    ← [1] inline citation with popover
│   ├── SourceList.tsx       ← collapsible sources footer
│   ├── ChatInput.tsx        ← textarea + send button
│   └── ThinkingIndicator.tsx ← animated "Searching the web..."
├── hooks/
│   ├── useChat.ts           ← orchestrates send + streaming
│   └── useAutoScroll.ts     ← auto-scroll to latest message
├── store/
│   └── chatStore.ts         ← Zustand conversation store
├── api/
│   └── chatApi.ts           ← fetch wrapper for /api/chat SSE
├── types/
│   └── chat.ts              ← shared TypeScript interfaces
└── App.tsx
```

---

## TypeScript Types

```typescript
// src/types/chat.ts

export type Role = 'user' | 'assistant';

export interface Source {
  title: string;
  url: string;
  snippet: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  sources?: Source[];
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  messages: ChatMessage[];
}

// SSE event shapes from backend
export type SSEEvent =
  | { type: 'thinking'; content: string }
  | { type: 'token'; content: string }
  | { type: 'sources'; sources: Source[] }
  | { type: 'done' };
```

---

## Zustand Store

```typescript
// src/store/chatStore.ts
import { create } from 'zustand';
import { ChatMessage, Source } from '../types/chat';
import { nanoid } from 'nanoid';

interface ChatStore {
  messages: ChatMessage[];
  isThinking: boolean;
  thinkingText: string;
  addUserMessage: (content: string) => void;
  startAssistantMessage: () => string; // returns id
  appendToken: (id: string, token: string) => void;
  setSources: (id: string, sources: Source[]) => void;
  finishMessage: (id: string) => void;
  setThinking: (text: string | null) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isThinking: false,
  thinkingText: '',

  addUserMessage: (content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { id: nanoid(), role: 'user', content },
      ],
    })),

  startAssistantMessage: () => {
    const id = nanoid();
    set((state) => ({
      messages: [
        ...state.messages,
        { id, role: 'assistant', content: '', isStreaming: true },
      ],
    }));
    return id;
  },

  appendToken: (id, token) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + token } : m
      ),
    })),

  setSources: (id, sources) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, sources } : m
      ),
    })),

  finishMessage: (id) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, isStreaming: false } : m
      ),
    })),

  setThinking: (text) =>
    set({ isThinking: text !== null, thinkingText: text ?? '' }),
}));
```

---

## SSE Streaming API Client

```typescript
// src/api/chatApi.ts
import { SSEEvent } from '../types/chat';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export async function streamChat(
  message: string,
  history: Array<{ role: string; content: string }>,
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event: SSEEvent = JSON.parse(line.slice(6));
          onEvent(event);
        } catch {
          // skip malformed lines
        }
      }
    }
  }
}
```

---

## useChat Hook

```typescript
// src/hooks/useChat.ts
import { useCallback, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import { streamChat } from '../api/chatApi';

export function useChat() {
  const store = useChatStore();
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      // Cancel any in-flight stream
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      // Optimistic user message
      store.addUserMessage(text);

      // Build history (exclude last user message we just added)
      const history = store.messages
        .filter((m) => !m.isStreaming)
        .map((m) => ({ role: m.role, content: m.content }));

      const assistantId = store.startAssistantMessage();

      try {
        await streamChat(
          text,
          history,
          (event) => {
            if (event.type === 'thinking') {
              store.setThinking(event.content);
            } else if (event.type === 'token') {
              store.setThinking(null);
              store.appendToken(assistantId, event.content);
            } else if (event.type === 'sources') {
              store.setSources(assistantId, event.sources);
            } else if (event.type === 'done') {
              store.finishMessage(assistantId);
            }
          },
          abortRef.current.signal
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          store.appendToken(assistantId, '\n\n_Error: could not reach the server._');
          store.finishMessage(assistantId);
        }
      }
    },
    [store]
  );

  return { messages: store.messages, isThinking: store.isThinking, thinkingText: store.thinkingText, sendMessage };
}
```

---

## Components

### ChatWindow

```tsx
// src/components/ChatWindow.tsx
import { ChatInput } from './ChatInput';
import { MessageList } from './MessageList';
import { ThinkingIndicator } from './ThinkingIndicator';
import { useChat } from '../hooks/useChat';

export function ChatWindow() {
  const { messages, isThinking, thinkingText, sendMessage } = useChat();

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto">
      <header className="p-4 border-b font-semibold text-lg">Orbitrieve</header>
      <MessageList messages={messages} />
      {isThinking && <ThinkingIndicator text={thinkingText} />}
      <ChatInput onSend={sendMessage} disabled={isThinking} />
    </div>
  );
}
```

### Message with Citations

```tsx
// src/components/Message.tsx
import { ChatMessage } from '../types/chat';
import { SourceList } from './SourceList';

interface MessageProps {
  message: ChatMessage;
}

export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5" />
        )}
        {message.sources && message.sources.length > 0 && (
          <SourceList sources={message.sources} />
        )}
      </div>
    </div>
  );
}
```

### SourceList

```tsx
// src/components/SourceList.tsx
import { useState } from 'react';
import { Source } from '../types/chat';

interface SourceListProps {
  sources: Source[];
}

export function SourceList({ sources }: SourceListProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 border-t border-gray-200 pt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-blue-500 hover:underline"
      >
        {open ? 'Hide' : 'Show'} {sources.length} source{sources.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <ul className="mt-2 space-y-1">
          {sources.map((src, i) => (
            <li key={src.url} className="text-xs">
              <span className="font-mono text-gray-400">[{i + 1}]</span>{' '}
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                {src.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### ChatInput

```tsx
// src/components/ChatInput.tsx
import { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 border-t flex gap-2 items-end">
      <textarea
        className="flex-1 resize-none rounded-xl border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={2}
        placeholder="Ask anything… (Enter to send, Shift+Enter for new line)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="rounded-xl bg-blue-600 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-blue-700"
      >
        Send
      </button>
    </div>
  );
}
```

---

## `package.json` Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^5.0.0",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "vite": "^5.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

---

## Anti-Patterns to Avoid

- Never manage `EventSource` or raw `fetch` streams inside components — use hooks
- Never use `any` — define explicit types in `src/types/chat.ts`
- Never mutate Zustand state directly — use set functions
- Never skip the `key` prop on list items
- Never store derived state — compute from `messages` in the component
- Never ignore the AbortController — cancel streams when component unmounts or new message is sent
