import { useState, type KeyboardEvent } from 'react'
import { theme } from '../styles/theme'

interface ChatInputProps {
  onSend: (message: string) => void
  isLoading: boolean
}

export function ChatInput({ onSend, isLoading }: ChatInputProps): JSX.Element {
  const [value, setValue] = useState('')

  const handleSend = (): void => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 16px',
        borderTop: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.surface,
      }}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        placeholder="Ask anything..."
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radii.md,
          padding: '10px 14px',
          fontFamily: theme.fonts.base,
          fontSize: '14px',
          lineHeight: '1.5',
          outline: 'none',
          backgroundColor: isLoading ? theme.colors.surfaceAlt : theme.colors.surface,
        }}
      />
      <button
        onClick={handleSend}
        disabled={isLoading || !value.trim()}
        aria-label="Send"
        style={{
          padding: '10px 20px',
          backgroundColor: isLoading || !value.trim() ? theme.colors.border : theme.colors.primary,
          border: 'none',
          borderRadius: theme.radii.md,
          fontWeight: 600,
          fontSize: '14px',
          cursor: isLoading || !value.trim() ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.15s',
        }}
      >
        Send
      </button>
    </div>
  )
}
