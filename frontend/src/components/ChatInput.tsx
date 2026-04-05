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
