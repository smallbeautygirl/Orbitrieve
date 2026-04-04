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
    expect(useChatStore.getState().error).toContain('search')
    expect(useChatStore.getState().isLoading).toBe(false)
  })
})
