import { theme } from '../styles/theme'
import { OrbitrieveIcon } from './OrbitrieveIcon'

interface HeaderProps {
  onNewChat: () => void
}

export function Header({ onNewChat }: HeaderProps): JSX.Element {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: `2px solid ${theme.colors.primary}`,
        backgroundColor: theme.colors.surface,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <OrbitrieveIcon size={28} />
        <span
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: theme.colors.textPrimary,
            fontFamily: theme.fonts.base,
          }}
        >
          Orbitrieve
        </span>
      </div>
      <button
        onClick={onNewChat}
        style={{
          padding: '6px 14px',
          backgroundColor: 'transparent',
          border: `1.5px solid ${theme.colors.primary}`,
          borderRadius: theme.radii.full,
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          color: theme.colors.textPrimary,
        }}
      >
        New Chat
      </button>
    </header>
  )
}
