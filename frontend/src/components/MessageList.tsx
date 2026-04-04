import { useEffect, useRef } from 'react'
import type { Message, Stage } from '../types/chat'
import { MessageBubble } from './MessageBubble'
import { ThinkingIndicator } from './ThinkingIndicator'
import { theme } from '../styles/theme'

interface MessageListProps {
  messages: Message[]
  currentStage: Stage
}

export function MessageList({ messages, currentStage }: MessageListProps): JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentStage])

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 0',
        backgroundColor: theme.colors.surface,
      }}
    >
      {messages.length === 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: theme.colors.textMuted,
            fontSize: '14px',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '32px' }}>🔍</span>
          <span>Ask me anything — I'll search the web when needed.</span>
        </div>
      )}
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      {currentStage && (
        <div style={{ padding: '0 30px' }}>
          <ThinkingIndicator stage={currentStage} />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
