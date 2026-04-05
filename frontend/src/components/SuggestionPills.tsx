import { theme } from '../styles/theme';

interface SuggestionPillsProps {
  suggestions: string[];
  onSelect: (text: string) => void;
}

export function SuggestionPills({ suggestions, onSelect }: SuggestionPillsProps): JSX.Element | null {
  if (suggestions.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {suggestions.map((text, i) => (
        <button key={i} onClick={() => onSelect(text)} style={{ background: theme.colors.bgUserMsg, border: '1px solid #2e2e2e', borderRadius: theme.radii.full, padding: '8px 16px', fontSize: '13px', color: '#bbbbbb', cursor: 'pointer', fontFamily: theme.fonts.base }}>
          {text}
        </button>
      ))}
    </div>
  );
}
