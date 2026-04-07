import { theme } from '../styles/theme';

interface SuggestionPillsProps {
  suggestions: string[];
  onSelect: (text: string) => void;
}

export function SuggestionPills({ suggestions, onSelect }: SuggestionPillsProps): JSX.Element | null {
  if (suggestions.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
      {suggestions.map((text, i) => (
        <button
          key={i}
          onClick={() => onSelect(text)}
          style={{
            background: theme.colors.primaryDim,
            border: `1px solid rgba(245,166,35,0.35)`,
            borderRadius: theme.radii.full,
            padding: '7px 14px',
            fontSize: '13px',
            color: theme.colors.primary,
            cursor: 'pointer',
            fontFamily: theme.fonts.base,
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,166,35,0.22)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = theme.colors.primary;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = theme.colors.primaryDim;
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(245,166,35,0.35)';
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
