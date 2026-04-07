import { useState, type ReactNode } from "react";
import type { Message, Source } from "../types/chat";
import { theme } from "../styles/theme";
import { CitationLink } from "./CitationLink";
import { SourceList } from "./SourceList";
import { SuggestionPills } from "./SuggestionPills";
import { OrbitrieveIcon } from "./OrbitrieveIcon";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
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

function parseContent(
  content: string,
  remapMap: Map<number, number>,
  messageId: string,
  validDisplayIndices: Set<number>,
): ReactNode[] {
  const parts = content.split(/(\[\d+\])/g);
  const result: ReactNode[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const citationMatch = part.match(/^\[(\d+)\]$/);

    if (citationMatch) {
      const originalIdx = parseInt(citationMatch[1]);
      const displayIdx = remapMap.get(originalIdx) ?? originalIdx;
      // Only render a badge if the source card actually exists
      if (validDisplayIndices.has(displayIdx)) {
        result.push(<CitationLink key={`cite-${i}`} index={displayIdx} messageId={messageId} />);
      }
    } else {
      result.push(...renderTextWithBold(part, `${i}`));
    }
  }

  return result;
}

function CopyButton({ text }: { text: string }): JSX.Element {
  const [copied, setCopied] = useState(false);

  function handleCopy(): void {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy message"
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "4px 6px",
        borderRadius: "6px",
        color: copied ? theme.colors.primary : theme.colors.textMuted,
        fontSize: "12px",
        opacity: 0.7,
        transition: "opacity 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.7"; }}
    >
      {copied ? (
        // Checkmark icon
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        // Clipboard icon
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2" width="6" height="4" rx="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        </svg>
      )}
    </button>
  );
}

export function MessageBubble({
  message,
  isStreaming = false,
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", maxWidth: "72%" }}>
          <div
            style={{
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
          {!isStreaming && <CopyButton text={message.content} />}
        </div>
      </div>
    );
  }

  const remapMap = buildCitationRemap(message.content);
  const displaySources = message.sources && message.sources.length > 0
    ? remapSources(message.sources, remapMap)
    : [];
  const validDisplayIndices = new Set(displaySources.map((s) => s.index));

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
        {parseContent(message.content, remapMap, message.id, validDisplayIndices)}
      </div>

      {/* Sources */}
      {displaySources.length > 0 && (
        <SourceList sources={displaySources} messageId={message.id} />
      )}

      {/* Copy button */}
      {!isStreaming && (
        <div>
          <CopyButton text={message.content.replace(/\[\d+\]/g, "").trim()} />
        </div>
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
