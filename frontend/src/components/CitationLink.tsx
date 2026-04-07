import { theme } from '../styles/theme'

const HIGHLIGHT_CLASS = 'source-card-highlight'

function ensureAnimation(): void {
  if (document.getElementById('orbitrieve-source-animation')) return
  const style = document.createElement('style')
  style.id = 'orbitrieve-source-animation'
  style.textContent = `
    @keyframes sourceCardBounce {
      0%   { transform: scale(1);     box-shadow: 0 0 0 0   rgba(245,166,35,0.9); border-color: #F5A623; }
      25%  { transform: scale(1.025); box-shadow: 0 0 0 6px rgba(245,166,35,0.5); border-color: #F5A623; }
      50%  { transform: scale(0.99);  box-shadow: 0 0 0 8px rgba(245,166,35,0.25); border-color: #F5A623; }
      75%  { transform: scale(1.01);  box-shadow: 0 0 0 4px rgba(245,166,35,0.15); border-color: #F5A623; }
      100% { transform: scale(1);     box-shadow: 0 0 0 0   rgba(245,166,35,0);   border-color: #2a2a2a; }
    }
    .${HIGHLIGHT_CLASS} {
      animation: sourceCardBounce 0.75s ease-out forwards !important;
    }
  `
  document.head.appendChild(style)
}

interface CitationLinkProps {
  index: number
  messageId: string
}

export function CitationLink({ index, messageId }: CitationLinkProps): JSX.Element {
  const handleClick = (): void => {
    ensureAnimation()
    const el = document.getElementById(`source-card-${messageId}-${index}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.remove(HIGHLIGHT_CLASS)
    // Force reflow so re-clicking the same citation re-triggers the animation
    void el.offsetWidth
    el.classList.add(HIGHLIGHT_CLASS)
    el.addEventListener('animationend', () => el.classList.remove(HIGHLIGHT_CLASS), { once: true })
  }

  return (
    <sup
      id={`cite-ref-${messageId}-${index}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '16px',
        height: '16px',
        backgroundColor: theme.colors.primary,
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 700,
        cursor: 'pointer',
        marginLeft: '1px',
        verticalAlign: 'super',
        lineHeight: 1,
        textDecoration: 'none',
        color: theme.colors.textPrimary,
      }}
      onClick={handleClick}
    >
      {index}
    </sup>
  )
}
