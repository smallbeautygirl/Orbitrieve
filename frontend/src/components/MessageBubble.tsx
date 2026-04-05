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
  return words.slice(-2).join(' ');
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
