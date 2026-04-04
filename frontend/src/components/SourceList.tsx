import type { Source } from '../types/chat'
import { theme } from '../styles/theme'
import { SourceCard } from './SourceCard'

interface SourceListProps {
  sources: Source[]
}

export function SourceList({ sources }: SourceListProps): JSX.Element | null {
  if (!sources.length) return null
  return (
    <div style={{ marginTop: '12px' }}>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: theme.colors.textMuted,
          marginBottom: '8px',
        }}
      >
        Sources
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
        {sources.map((s) => (
          <SourceCard key={s.index} source={s} />
        ))}
      </div>
    </div>
  )
}
