// frontend/src/components/Header.tsx
import { OrbitrieveIcon } from './OrbitrieveIcon';

interface HeaderProps {
  onNewChat: () => void;
}

export function Header({ onNewChat: _onNewChat }: HeaderProps): JSX.Element {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 24px',
        backgroundColor: '#111111',
        borderBottom: '1px solid #2a2a2a',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <OrbitrieveIcon size={26} />
        <span
          style={{
            fontSize: '17px',
            fontWeight: 700,
            color: '#F5A623',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            letterSpacing: '0.01em',
          }}
        >
          Orbitrieve
        </span>
      </div>

      {/* Nav tabs — visual only */}
      <nav style={{ display: 'flex', gap: '32px' }} aria-label="Main navigation">
        {(['Models', 'History', 'Library'] as const).map((label) => (
          <span
            key={label}
            style={{
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: label === 'History' ? '#F5A623' : '#666666',
              paddingBottom: '2px',
              borderBottom: label === 'History' ? '2px solid #F5A623' : '2px solid transparent',
              cursor: 'default',
              userSelect: 'none',
            }}
          >
            {label}
          </span>
        ))}
      </nav>

      {/* Icon bar — decorative */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {[
          { label: '⚙', title: 'Settings' },
          { label: '?', title: 'Help' },
          { label: '👤', title: 'Account' },
        ].map(({ label, title }) => (
          <div
            key={title}
            title={title}
            aria-label={title}
            style={{
              width: '28px',
              height: '28px',
              background: '#1e1e1e',
              border: '1px solid #2a2a2a',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              color: '#888',
              cursor: 'default',
              userSelect: 'none',
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </header>
  );
}
