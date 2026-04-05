import type { Source } from '../types/chat';
import { theme } from '../styles/theme';

interface SourceCardProps {
  source: Source;
}

export function SourceCard({ source }: SourceCardProps): JSX.Element {
  const domain = (() => {
    try {
      return new URL(source.url).hostname.replace('www.', '');
    } catch {
      return source.url;
    }
  })();

  const meta = source.published_date ? `${domain} · Published ${source.published_date}` : domain;

  return (
    <a
      id={`source-card-${source.index}`}
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        position: 'relative',
        padding: '12px 14px',
        background: theme.colors.bgCard,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '10px',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 0.15s',
      }}
    >
      {/* SOURCE N label */}
      <span
        style={{
          display: 'inline-block',
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: theme.colors.primary,
          background: theme.colors.primaryDim,
          padding: '2px 6px',
          borderRadius: '4px',
          marginBottom: '8px',
        }}
      >
        Source {source.index}
      </span>

      {/* External link icon */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          fontSize: '12px',
          color: theme.colors.textDim,
        }}
      >
        ↗
      </span>

      {/* Title */}
      <div
        style={{
          fontSize: '13px',
          fontWeight: 700,
          color: theme.colors.textPrimary,
          marginBottom: '5px',
          paddingRight: '20px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {source.title}
      </div>

      {/* Meta */}
      <div style={{ fontSize: '11px', color: theme.colors.textDim }}>{meta}</div>
    </a>
  );
}
