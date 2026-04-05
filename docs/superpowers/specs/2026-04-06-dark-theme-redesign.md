# Orbitrieve Dark Theme Redesign

**Date:** 2026-04-06  
**Branch:** develop  
**Approach:** Incremental (component by component, theme first)

---

## Overview

Redesign the frontend UI from the current light theme to a dark editorial theme, matching the provided reference screenshot. Changes span the visual layer only — data flow, hooks, and backend API contract remain unchanged except for one new SSE event type (`suggestions`).

---

## Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Nav items (MODELS / HISTORY / LIBRARY) | Visual-only placeholders | No routing needed yet |
| Microphone icon | Removed | No voice input implemented; fake affordance misleads users |
| Paperclip icon | Kept with tooltip "Attachments coming soon" | Signals future intent without misleading clicks |
| Follow-up suggestion pills | AI-generated via new `suggestions` SSE event | Better UX than hardcoded text |
| Citation phrase highlight | Frontend heuristic — highlight last word/phrase before `[N]` | No backend format change needed |

---

## Color System (`theme.ts`)

Replace the current light palette with:

```ts
colors: {
  bg:           '#111111'   // app background
  bgCard:       '#1a1a1a'   // cards, source cards
  bgInput:      '#1a1a1a'   // input bar background
  bgUserMsg:    '#1c1c1c'   // user message bubble
  border:       '#2a2a2a'   // all card/input borders
  borderSubtle: '#1e1e1e'   // input area top border
  primary:      '#F5A623'   // amber accent (logo, active nav, badges, send btn)
  primaryDim:   'rgba(245,166,35,0.12)'  // badge bg, source label bg
  primaryGlow:  'rgba(245,166,35,0.18)'  // cite highlight background
  textPrimary:  '#e8e8e8'
  textMuted:    '#cccccc'
  textDim:      '#666666'
  textPlaceholder: '#444444'
}
```

---

## Components

### 1. Header (`Header.tsx`)

**Layout:** `logo | nav-center | icon-right`

- **Logo:** amber circle icon + "Orbitrieve" in amber (`#F5A623`)
- **Nav tabs:** MODELS · HISTORY · LIBRARY — uppercase, 12px, letter-spacing 0.12em
  - Active tab (HISTORY): amber color + 2px amber underline
  - Inactive tabs: `#666`
  - All tabs are non-functional (no routing, no onClick)
- **Right icons:** gear ⚙, help ?, avatar — each a 28px dark circle (`#1e1e1e`, border `#2a2a2a`)
  - All decorative (no onClick handlers)
- **Background:** `#111`, bottom border `1px solid #2a2a2a`

`HeaderProps` stays as `{ onNewChat: () => void }` — the "New Chat" button UI is removed, but the prop is kept in the interface so `App.tsx` requires no change. The avatar icon is decorative and does not call `onNewChat`.

---

### 2. Theme (`theme.ts`)

Full replacement of the existing color map. Font stack and radius values unchanged. New tokens added: `bgCard`, `bgInput`, `bgUserMsg`, `borderSubtle`, `primaryDim`, `primaryGlow`, `textDim`, `textPlaceholder`.

---

### 3. MessageBubble (`MessageBubble.tsx`)

**User messages:**
- `align-self: center` (centered horizontally in the column)
- Dark card: background `bgUserMsg`, border `border`, radius 14px
- No bubble tail
- Font: 15px, color `textMuted`

**Assistant messages:**
- No bubble wrapper — full-width content block
- Header row: amber circle icon (26px) + "ORBITRIEVE ANALYSIS" label (11px, uppercase, amber, letter-spacing 0.12em)
- Body paragraphs: 15px, line-height 1.7, color `textMuted`

**Citation parsing (updated heuristic):**

Current: `[N]` → `<CitationLink>`

New logic:
1. Split content on `[N]` markers
2. For the segment immediately before each `[N]`, split on punctuation (`.` `,` `;` `!` `?`) and take the trailing part — up to 5 words
3. Wrap that phrase in `<span>` with amber highlight background (`primaryGlow`) and amber text (`primary`)
4. Render `[N]` as a small amber circle badge (18px, border `primary`, background `#2a1800`, font 10px bold)

---

### 4. SourceCard (`SourceCard.tsx`)

**Layout changes:**
- Container: `display: grid; grid-template-columns: 1fr 1fr; gap: 10px` (moved to `SourceList`)
- Card: dark background `bgCard`, border `border`, radius 10px, padding 12px 14px
- Top-left: amber pill label "SOURCE N" (9px uppercase, background `primaryDim`)
- Top-right: external link icon ↗ (absolute positioned, color `#555`)
- Title: 13px bold, color `textPrimary`, padding-right 20px (avoid overlap with ↗)
- Meta: 11px, color `textDim` — shows `domain` (extracted from URL). If backend returns `published_date`, shown as `domain · Published {date}`, otherwise just `domain`

**Source type:** `published_date?: string` added as optional field to `Source` interface. Backend may omit it; frontend degrades gracefully.

---

### 5. SourceList (`SourceList.tsx`)

Change wrapper from vertical stack to `display: grid; grid-template-columns: 1fr 1fr; gap: 10px`.

---

### 6. SuggestionPills (new component: `SuggestionPills.tsx`)

**Props:** `{ suggestions: string[]; onSelect: (text: string) => void }`

- Renders a flex-wrap row of rounded pill buttons
- Each pill: background `bgUserMsg`, border `#2e2e2e`, radius 99px, padding 8px 16px, font 13px, color `#bbb`
- Hover: border and text turn amber
- `onClick` calls `onSelect(text)` which sends the suggestion as a new chat message

Rendered inside `MessageBubble` below the source cards, only when `message.suggestions` is non-empty.

---

### 7. ChatInput (`ChatInput.tsx`)

**Input bar:**
- Outer wrapper: dark background `bgInput`, border `border`, radius 14px, padding 10px 14px
- Left: paperclip icon 📎 (color `#555`) wrapped in a tooltip container
  - Tooltip text: "Attachments coming soon"
  - Tooltip: absolute-positioned above the icon, shown on hover, dark bg `#2a2a2a`, border `#3a3a3a`, 11px
  - No onClick handler
- Center: `<textarea>` (existing), placeholder "Ask Orbitrieve anything...", background transparent, color `textMuted`, placeholder color `textPlaceholder`
- Right: circular send button — 36px, background `primary`, border-radius 50%, amber

**Below bar:**
- Disclaimer text: "ORBITRIEVE CAN MAKE MISTAKES. VERIFY IMPORTANT INFO." — 10px, color `#444`, uppercase, letter-spacing 0.06em, centered

---

### 8. App layout (`App.tsx`)

- Remove `maxWidth: 800px` constraint — app fills full viewport width
- Keep `margin: 0 auto` only on the inner content column if needed for readability on ultra-wide screens (decision deferred to implementation)
- Root background: `#0a0a0a`; app column background: `#111`

---

## Backend: `suggestions` SSE Event

### New event type

```json
{ "type": "suggestions", "suggestions": ["Question A?", "Question B?"] }
```

Sent after the `sources` event and before `done`. The Search Agent (and optionally the direct-answer path of the Orchestrator) generates 2–3 follow-up questions based on the answer content.

### Types (`types/chat.ts`)

```ts
// Add to SSEEventType union:
| 'suggestions'

// Add to SSEEvent:
suggestions?: string[]

// Add to Message:
suggestions?: string[]

// Add to Source:
published_date?: string
```

### Store (`chatStore.ts`)

When a `suggestions` event arrives, append `suggestions` to the current streaming assistant message.

### API client (`chatApi.ts`)

Handle the `suggestions` event case in the SSE parser — pass `event.suggestions` to the store update.

---

## What is NOT changing

- `useChat.ts` — no changes
- `useConversation.ts` — no changes
- `chatStore.ts` state shape — only `Message` type gains optional `suggestions` field
- Backend API route (`POST /api/chat`) — SSE contract extended, not broken
- All existing tests remain valid; new tests cover `SuggestionPills` and the updated citation parser

---

## File Change Summary

| File | Change |
|---|---|
| `src/styles/theme.ts` | Full dark palette replacement |
| `src/components/Header.tsx` | Dark header with nav + icon bar |
| `src/components/MessageBubble.tsx` | Dark bubbles, ORBITRIEVE ANALYSIS label, updated cite parser |
| `src/components/SourceCard.tsx` | Dark card, SOURCE N label, ↗ icon, meta line |
| `src/components/SourceList.tsx` | 2-column grid wrapper |
| `src/components/SuggestionPills.tsx` | New component |
| `src/components/ChatInput.tsx` | Dark bar, tooltip paperclip, circular send btn, disclaimer |
| `src/App.tsx` | Full-width dark layout |
| `src/types/chat.ts` | `suggestions` event + field, `published_date` on Source |
| `src/api/chatApi.ts` | Handle `suggestions` SSE event |
| `src/store/chatStore.ts` | Store `suggestions` on streaming message |
| `backend/app/agents/` | Search Agent emits `suggestions` event |
