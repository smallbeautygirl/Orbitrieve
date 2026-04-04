import type { Source } from '../types/chat'
import { theme } from '../styles/theme'

interface SourceCardProps {
  source: Source
}

export function SourceCard({ source }: SourceCardProps): JSX.Element {
  const domain = (() => {
    try {
      return new URL(source.url).hostname.replace('www.', '')
    } catch {
      return source.url
    }
  })()

  return (
    <a
      id={`source-card-${source.index}`}
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        gap: '10px',
        padding: '8px 12px',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radii.sm,
        textDecoration: 'none',
        color: theme.colors.textPrimary,
        backgroundColor: theme.colors.surface,
        transition: 'border-color 0.15s',
      }}
    >
      <span
        style={{
          minWidth: '22px',
          height: '22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.primaryLight,
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        [{source.index}]
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>{source.title}</div>
        <div
          style={{
            fontSize: '11px',
            color: theme.colors.textMuted,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {domain}
        </div>
      </div>
    </a>
  )
}
