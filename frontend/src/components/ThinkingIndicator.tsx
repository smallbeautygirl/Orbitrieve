import { theme } from '../styles/theme'
import type { Stage } from '../types/chat'

const STAGE_LABELS: Record<NonNullable<Stage>, string> = {
  thinking: 'Thinking',
  searching: 'Searching the web',
  writing: 'Writing answer',
}

interface ThinkingIndicatorProps {
  stage: Stage
}

export function ThinkingIndicator({ stage }: ThinkingIndicatorProps): JSX.Element | null {
  if (!stage) return null
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 0',
        color: theme.colors.textMuted,
        fontSize: '13px',
      }}
    >
      <span>{STAGE_LABELS[stage]}</span>
      <span className="dots">
        <DotAnimation />
      </span>
    </div>
  )
}

function DotAnimation(): JSX.Element {
  return (
    <span aria-hidden="true">
      {'●●●'.split('').map((dot, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            animation: `pulse 1.2s ${i * 0.2}s infinite`,
            opacity: 0.3,
            marginLeft: '2px',
            fontSize: '8px',
          }}
        >
          {dot}
        </span>
      ))}
    </span>
  )
}
