import type { Source } from '../types/chat';
import { SourceCard } from './SourceCard';

interface SourceListProps {
  sources: Source[];
  messageId: string;
}

export function SourceList({ sources, messageId }: SourceListProps): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '10px',
        marginTop: '4px',
      }}
    >
      {sources.map((source) => (
        <SourceCard key={source.index} source={source} messageId={messageId} />
      ))}
    </div>
  );
}
