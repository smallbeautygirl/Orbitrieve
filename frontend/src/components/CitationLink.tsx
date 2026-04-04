import { theme } from '../styles/theme'

interface CitationLinkProps {
  index: number
}

export function CitationLink({ index }: CitationLinkProps): JSX.Element {
  return (
    <sup
      id={`cite-ref-${index}`}
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
      onClick={() => {
        document.getElementById(`source-card-${index}`)?.scrollIntoView({ behavior: 'smooth' })
      }}
    >
      {index}
    </sup>
  )
}
