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
