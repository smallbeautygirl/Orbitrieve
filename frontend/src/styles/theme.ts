// frontend/src/styles/theme.ts
export const theme = {
  colors: {
    bg:             '#111111',
    bgCard:         '#1a1a1a',
    bgInput:        '#1a1a1a',
    bgUserMsg:      '#1c1c1c',
    border:         '#2a2a2a',
    borderSubtle:   '#1e1e1e',
    primary:        '#F5A623',
    primaryDim:     'rgba(245,166,35,0.12)',
    primaryGlow:    'rgba(245,166,35,0.18)',
    textPrimary:    '#e8e8e8',
    textMuted:      '#cccccc',
    textDim:        '#666666',
    textPlaceholder: '#444444',
  },
  fonts: {
    base: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  radii: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    full: '9999px',
  },
} as const;
