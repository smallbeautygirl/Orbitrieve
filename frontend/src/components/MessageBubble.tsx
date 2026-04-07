import type { ReactNode } from "react";
import type { Message, Source } from "../types/chat";
import { theme } from "../styles/theme";
import { CitationLink } from "./CitationLink";
import { SourceList } from "./SourceList";
import { SuggestionPills } from "./SuggestionPills";
import { OrbitrieveIcon } from "./OrbitrieveIcon";

interface MessageBubbleProps {
  message: Message;
  onSuggestionSelect: (text: string) => void;
}

/** Remap [3][4][5] → [1][2][3] in order of first appearance. */
function buildCitationRemap(content: string): Map<number, number> {
  const remapMap = new Map<number, number>();
  let displayIdx = 1;
  const pattern = /\[(\d+)\]/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const n = parseInt(match[1]);
    if (!remapMap.has(n)) remapMap.set(n, displayIdx++);
  }
  return remapMap;
}

/** Reorder sources to match the remapped citation order. */
function remapSources(sources: Source[], remapMap: Map<number, number>): Source[] {
  const sourceMap = new Map(sources.map((s) => [s.index, s]));
  const result: Source[] = [];
  for (const [original, display] of remapMap) {
    const s = sourceMap.get(original);
    if (s) result.push({ ...s, index: display });
  }
  // Append uncited sources at the end
  let nextIdx = result.length + 1;
  for (const s of sources) {
    if (!remapMap.has(s.index)) result.push({ ...s, index: nextIdx++ });
  }
  return result;
}

/** Parse a text segment and render **bold** markdown as <strong>. */
function renderTextWithBold(text: string, keyPrefix: string): ReactNode[] {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return segments.map((seg, idx) => {
    if (seg.startsWith("**") && seg.endsWith("**")) {
      return (
        <strong
          key={`${keyPrefix}-b${idx}`}
          style={{ fontWeight: 700, color: theme.colors.textPrimary }}
        >
          {seg.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${keyPrefix}-t${idx}`}>{seg}</span>;
  });
}

function parseContent(content: string, remapMap: Map<number, number>, messageId: string): ReactNode[] {
  const parts = content.split(/(\[\d+\])/g);
  const result: ReactNode[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const citationMatch = part.match(/^\[(\d+)\]$/);

    if (citationMatch) {
      const originalIdx = parseInt(citationMatch[1]);
      const displayIdx = remapMap.get(originalIdx) ?? originalIdx;
      result.push(<CitationLink key={`cite-${i}`} index={displayIdx} messageId={messageId} />);
    } else {
      result.push(...renderTextWithBold(part, `${i}`));
    }
  }

  return result;
}

export function MessageBubble({
  message,
  onSuggestionSelect,
}: MessageBubbleProps): JSX.Element {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "end",
          padding: "0 16px",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            maxWidth: "72%",
            padding: "16px 22px",
            borderRadius: "14px",
            backgroundColor: theme.colors.bgUserMsg,
            border: `1px solid ${theme.colors.border}`,
            fontSize: "15px",
            lineHeight: "1.55",
            color: theme.colors.textMuted,
            fontFamily: theme.fonts.base,
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  const remapMap = buildCitationRemap(message.content);
  const displaySources = message.sources && message.sources.length > 0
    ? remapSources(message.sources, remapMap)
    : [];

  return (
    <div
      style={{
        padding: "0 16px 12px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      {/* ORBITRIEVE ANALYSIS label */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <OrbitrieveIcon size={26} />
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: theme.colors.primary,
          }}
        >
          Orbitrieve Analysis
        </span>
      </div>

      {/* Body */}
      <div
        style={{
          fontSize: "15px",
          lineHeight: "1.7",
          color: theme.colors.textMuted,
          fontFamily: theme.fonts.base,
        }}
      >
        {parseContent(message.content, remapMap, message.id)}
      </div>

      {/* Sources */}
      {displaySources.length > 0 && (
        <SourceList sources={displaySources} messageId={message.id} />
      )}

      {/* Suggestion pills */}
      {message.suggestions && message.suggestions.length > 0 && (
        <SuggestionPills
          suggestions={message.suggestions}
          onSelect={onSuggestionSelect}
        />
      )}
    </div>
  );
}
