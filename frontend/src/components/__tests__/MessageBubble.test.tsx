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
    // The highlighted span contains up to 5 trailing words before the citation
    expect(screen.getByText('Apple hit record highs')).toBeInTheDocument();
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
