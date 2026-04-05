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
