# BLOOM-M15: SSE Streaming Pipeline

> **Copilot Thinking Effort:** XHigh
> **Branch:** `feature/bloom-assist`
> **Phase:** 3 — Streaming & Core UX
> **Milestone:** 15 of 40

---

## Objective

Implement full SSE streaming from the Edge Function to the frontend. Text appears token-by-token. Tool executions show inline loading states. Thinking traces stream into collapsible blocks. The existing `stream-thinking-text` Edge Function (which already uses `ReadableStream` + `text/event-stream`) is the pattern template.

---

## Scope

### Backend: Stream Handler Enhancement

In `supabase/functions/bloom-assist/stream-handler.ts`:
- Read OpenAI's SSE stream chunk by chunk
- Parse `delta.content` tokens → emit `event: token\ndata: {"text": "..."}\n\n`
- Parse `delta.tool_calls` → detect tool call accumulation → on complete tool call, emit `event: tool_start`, execute tool, emit `event: tool_result`
- For reasoning mode: detect `<thinking>` tags → emit `event: thinking_token` for thinking content, `event: token` for answer content
- On stream end: emit `event: done` with metadata (tokens, model, conversation_id)
- Handle errors mid-stream: emit `event: error` with friendly message

### Frontend: Streaming Consumer

**`src/hooks/bloom/useBloomStreaming.ts`**:
- Calls the `bloom-assist` Edge Function via `fetch()` (NOT `supabase.functions.invoke()` — need raw SSE access)
- Uses `EventSource` pattern or manual `ReadableStream` reader with `TextDecoder`
- Dispatches events to `BloomContext`:
  - `token` → append to current assistant message content
  - `thinking_token` → append to thinking block content
  - `tool_start` → show inline loading pill
  - `tool_result` → render data block, remove loading pill
  - `error` → show error in conversation
  - `done` → finalize message, enable actions, save to DB

**`src/components/bloom/BloomStreamingMessage.tsx`**:
- Renders the in-progress assistant message during streaming
- Uses a `ref`-based append strategy during streaming (direct DOM manipulation for performance — not React re-renders per token)
- On `done` event, switches to React-rendered final message
- Shows cursor blink animation using existing `text-stream-animation.css`
- Cursor fades out on completion using `gentle-pulse` animation from Tailwind config

**`src/components/bloom/BloomToolLoadingPill.tsx`**:
- Inline loading indicator during tool execution
- `JoyChip` variant="soft" color="neutral" with `CircularProgress` size="sm" and tool description text ("Querying customers...")
- Animates in with `framer-motion` `AnimatePresence` (already in deps)
- Transforms into the actual result block when `tool_result` arrives

### Streaming Behavior

- First token appears within 400ms of send (target)
- Tokens batch-append every 3-5 tokens to reduce DOM updates (configurable)
- Tool execution pauses text streaming, shows loading pill, resumes after result
- If multiple tool calls happen, they execute sequentially with individual loading pills
- Partial Markdown renders gracefully (incomplete bold, links handled without visual glitches)
- On network disconnect mid-stream: preserve partial response, show "Connection lost" chip with "Retry" button

---

## Acceptance Criteria

- [ ] Text streams token-by-token with cursor animation
- [ ] Tool executions show loading pills that transform into result blocks
- [ ] Thinking tokens stream into collapsible thinking block (reasoning mode)
- [ ] `done` event finalizes message and enables message actions
- [ ] Error events show friendly error messages inline
- [ ] Performance: no jank during streaming (60fps), batch token updates
- [ ] Network disconnect preserves partial response
- [ ] Follows `stream-thinking-text` Edge Function pattern for SSE format

---

## What NOT To Do

- Do NOT re-render the entire message on every token — use ref-based DOM append
- Do NOT use `supabase.functions.invoke()` for streaming — use raw `fetch()` for SSE access
- Do NOT block the UI during tool execution — show loading pill and continue
- Do NOT generate test files or documentation

---
---
---

# BLOOM-M16: Markdown Renderer & Code Highlighting

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 3 — Streaming & Core UX
> **Milestone:** 16 of 40

---

## Objective

Add `react-markdown` + `remark-gfm` to the project and build a streaming-aware Markdown renderer for Bloom messages. Code blocks get syntax highlighting via `highlight.js` (already in dependencies). The renderer must handle partial Markdown during streaming gracefully.

---

## Scope

### Dependencies to Add

- `react-markdown` — Markdown rendering
- `remark-gfm` — GitHub Flavored Markdown (tables, strikethrough, task lists)

### Component: `src/components/bloom/BloomMarkdown.tsx`

A styled Markdown renderer that:
- Uses `react-markdown` with `remark-gfm` plugin
- Custom component overrides for Joy UI styling:
  - Headings → Joy `Typography` with appropriate `level` (h1→h2 within conversation, h2→h3, etc.)
  - Paragraphs → Joy `Typography` level="body-sm" with `color: "neutral.700"`
  - Code blocks → `<pre>` with `highlight.js` syntax highlighting + copy button (`JoyButton` size="icon")
  - Inline code → Joy `Typography` with `fontFamily: "code"` and subtle background
  - Tables → `JoyTable` components (not raw HTML tables)
  - Links → styled anchors with teal color, open in new tab
  - Lists → proper spacing and indent with disc/decimal markers
  - Blockquotes → left border in `primary.200` with `neutral.50` background
  - Horizontal rules → Joy `Divider`
  - Bold/italic → appropriate `fontWeight`/`fontStyle`

### Streaming-Aware Rendering

During streaming, the renderer must handle:
- Incomplete bold markers (`**partial` without closing `**`) — render as plain text until closed
- Incomplete code blocks (opening ``` without closing) — buffer code content, don't render until closed
- Incomplete links (`[text](url` without closing `)`) — render as plain text until closed
- Partial tables — render accumulated rows as they complete

Strategy: Use `BloomStreamingMessage` (M15) for raw text during streaming. Switch to `BloomMarkdown` on `done` event for final polished render.

### Code Block Component: `src/components/bloom/BloomCodeBlock.tsx`

- Syntax highlighting via `highlight.js` (already in deps)
- Language auto-detection or specified in code fence
- Copy button (top-right corner) — copies code content to clipboard
- Language label (top-left corner) as `JoyChip` size="sm"
- Dark background (`neutral.800`) with light text for code
- Horizontal scroll for long lines
- Line numbers (optional, enabled for >5 lines)

---

## Acceptance Criteria

- [ ] `react-markdown` and `remark-gfm` installed and working
- [ ] All Markdown elements render with Joy UI styling
- [ ] Code blocks have syntax highlighting via `highlight.js`
- [ ] Code blocks have copy button and language label
- [ ] Tables render using `JoyTable` components
- [ ] Streaming partial Markdown handled gracefully (no visual glitches)
- [ ] Final render on `done` event produces clean, polished Markdown
- [ ] Links open in new tab
- [ ] Blockquotes styled with left border and subtle background

---

## What NOT To Do

- Do NOT add `prism-react-renderer` — use `highlight.js` which is already in deps
- Do NOT render Markdown per-token during streaming — stream raw text, render Markdown on completion
- Do NOT use raw HTML elements — all custom components use Joy UI
- Do NOT generate test files or documentation

---
---
---

# BLOOM-M17: Response Block System & Block Renderer

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 3 — Streaming & Core UX
> **Milestone:** 17 of 40

---

## Objective

Build the `BlockRenderer` that routes `block_type` values from the orchestrator to the appropriate UI component. Wire it into `BloomAssistantMessage` so that tool results render as rich interactive blocks within the conversation flow. This connects BLOOM-M13 (block components) with BLOOM-M15 (streaming) into a unified rendering pipeline.

---

## Scope

### Block Renderer: `src/components/bloom/blocks/BlockRenderer.tsx`

Switch component that takes `{ blockType: string, payload: any, onAction: (action) => void }` and renders:

| `blockType` | Component | Payload Shape |
|---|---|---|
| `text` | `BloomMarkdown` | `{ content: string }` |
| `data_card` | `DataCardBlock` | `{ entity_type, entity, actions[] }` |
| `data_table` | `DataTableBlock` | `{ entity_type, columns[], rows[], total_count, page }` |
| `stat_card` | `StatCardBlock` | `{ metrics: [{ label, value, change, icon }] }` |
| `chart` | `ChartBlock` | `{ chart_type, data[], x_key, y_key, title }` |
| `task_plan` | `TaskPlanBlock` | `{ tasks[], validation_annotations[] }` |
| `interaction` | `InteractionBlock` | `{ interaction_type, options[], context }` |
| `thinking` | `ThinkingBlock` | `{ content: string }` |
| `research_progress` | `ResearchProgressBlock` | `{ steps[], current_step }` |
| `image` | `ImageBlock` | `{ url, alt, width, height }` |
| `code` | `BloomCodeBlock` | `{ code, language }` |
| `navigation` | `NavigationBlock` | `{ target_path, label }` |
| `confirmation` | `ConfirmationBlock` | `{ results[], success_count, failure_count }` |
| `insight` | `InsightBlock` | `{ category, title, description, action_prompt }` |

### Integration into BloomAssistantMessage

Update `BloomAssistantMessage.tsx` to:
1. Render `BloomMarkdown` for the text content
2. Intersperse `BlockRenderer` calls for any blocks in `message.block_data[]`
3. Each block appears inline within the message flow (not appended at the end)
4. Blocks animate in with `framer-motion` `motion.div` — `initial={{ opacity: 0, y: 8 }}` `animate={{ opacity: 1, y: 0 }}` `transition={{ duration: 0.2 }}`

### Block Actions

When a user clicks an action button on a block (e.g., "View Orders" on a customer card), the `onAction` callback sends the action as a new user message to Bloom. The conversation continues naturally.

### Thinking Block: `src/components/bloom/blocks/ThinkingBlock.tsx`

- Collapsible `JoyCard` variant="plain" with `borderLeft: 3px solid` in `neutral.200`
- Header: "Reasoning" with expand/collapse `IconButton` (ChevronDown/ChevronUp)
- Content: thinking trace text in `Typography` level="body-xs" color="neutral.500"
- Collapsed by default after streaming completes
- Expanded during streaming to show reasoning in real-time

### Interaction Block: `src/components/bloom/blocks/InteractionBlock.tsx`

From Document 05 — renders interactive choices:
- **Selection Cards:** Multiple `JoyCard` interactive variant for entity disambiguation ("Which Sarah did you mean?")
- **Option Chips:** Row of `JoyChip` variant="outlined" for simple choices ("This Friday or next Friday?")
- **Inline Input:** `JoyInput` for corrections ("That email doesn't look right — did you mean...")
- **Diff View:** Side-by-side `Sheet` comparison for conflict resolution

---

## Acceptance Criteria

- [ ] `BlockRenderer` correctly routes all 14 block types to components
- [ ] Blocks render inline within assistant messages (interspersed with text)
- [ ] Block entrance animation works via framer-motion
- [ ] Action buttons on blocks send follow-up messages to Bloom
- [ ] Thinking block is collapsible, expanded during streaming, collapsed after
- [ ] Interaction block renders selection cards, option chips, and inline inputs
- [ ] All block components use Joy UI exclusively
- [ ] Unknown block types render as JSON in a code block (graceful fallback)

---

## What NOT To Do

- Do NOT render blocks outside the message flow — they're inline content
- Do NOT use raw HTML for any block — Joy UI components only
- Do NOT skip the animation — blocks appearing instantly feels jarring
- Do NOT generate test files or documentation
