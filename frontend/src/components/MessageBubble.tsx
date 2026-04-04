import type { ReactNode } from 'react'
import type { Message } from '../types/chat'
import { theme } from '../styles/theme'
import { CitationLink } from './CitationLink'
import { SourceList } from './SourceList'

interface MessageBubbleProps {
  message: Message
}

function parseContent(content: string): ReactNode[] {
  const parts = content.split(/(\[\d+\])/g)
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/)
    if (match) {
      return <CitationLink key={i} index={parseInt(match[1])} />
    }
    return part
  })
}

export function MessageBubble({ message }: MessageBubbleProps): JSX.Element {
  const isUser = message.role === 'user'

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '12px',
        padding: '0 16px',
      }}
    >
      <div
        style={{
          maxWidth: '75%',
          padding: '10px 14px',
          borderRadius: isUser
            ? `${theme.radii.lg} ${theme.radii.lg} 4px ${theme.radii.lg}`
            : `${theme.radii.lg} ${theme.radii.lg} ${theme.radii.lg} 4px`,
          backgroundColor: isUser ? theme.colors.primaryLight : theme.colors.surfaceAlt,
          border: `1px solid ${isUser ? '#F0D060' : theme.colors.border}`,
          fontSize: '14px',
          lineHeight: '1.6',
          color: theme.colors.textPrimary,
          fontFamily: theme.fonts.base,
        }}
      >
        <div>{parseContent(message.content)}</div>
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourceList sources={message.sources} />
        )}
      </div>
    </div>
  )
}
