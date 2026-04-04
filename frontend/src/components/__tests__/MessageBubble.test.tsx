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
