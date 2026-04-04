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
