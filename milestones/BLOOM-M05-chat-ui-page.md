# BLOOM-M05: Chat UI Page — Full Layout

> **Copilot Thinking Effort:** XHigh
> **Branch:** `feature/bloom-assist`
> **Phase:** 1 — Foundation
> **Milestone:** 5 of 40

---

## Objective

Build the complete Bloom AI page as a first-class CRM route at `/bloom` and `/bloom/:chatId`. This is a full-page conversational interface with a conversation sidebar, main chat area, input zone with mode chips, and a home state with suggested prompts. Every UI element uses Joy UI exclusively — `Sheet`, `Stack`, `Typography`, `Box`, `List`, `ListItem`, `ListItemButton`, `ListItemContent`, `ListItemDecorator`, `IconButton`, `Textarea`, `Chip`, `Avatar`, `CircularProgress`, `Tooltip`, `Divider`. The page must feel **premium, sleek, and beautiful** — matching the Linear/Vercel/Notion aesthetic established across the CRM.

---

## Scope

### Route Registration

Add to `src/App.tsx`:
- `/bloom` → `BloomPage` via `renderProtectedSidebarLazyPage` (lazy-loaded, protected, sidebar shell)
- `/bloom/:chatId` → same `BloomPage` — chatId param selects active conversation

Add to `src/components/navigation/sidebarNavigation.ts`:
- New item in tenant-mode groups: `{ id: "bloom", kind: "link", label: "Bloom", icon: SparklesIcon, to: "/bloom", patterns: ["/bloom", "/bloom/*"] }`
- Position: above Dashboard or as the first item in a new "AI" group

### Page Component: `src/pages/BloomPage.tsx`

Thin wrapper: `<PageContainer fullWidth>` → `<BloomLayout />`. No data fetching in the page itself.

### Core Layout: `src/components/bloom/BloomLayout.tsx`

```
┌──────────────────────────────────────────────────────────────┐
│ CRM Shell (DashboardShell — existing)                          │
├────────────┬─────────────────────────────────────────────────┤
│            │                                                  │
│  Bloom     │        BloomMainArea                             │
│  Sidebar   │                                                  │
│  (280px)   │   ┌──────────────────────────────────────────┐  │
│            │   │  BloomHeader                              │  │
│ ┌────────┐ │   │  Model selector + New Chat + ⌘J hint     │  │
│ │ Search │ │   ├──────────────────────────────────────────┤  │
│ └────────┘ │   │                                          │  │
│            │   │  BloomConversationArea                    │  │
│ Pinned     │   │  (home state OR message list)            │  │
│ ─────────  │   │                                          │  │
│ 📌 Chat 1  │   │  Home: Greeting + Suggested prompts     │  │
│ 📌 Chat 2  │   │  Chat: Message list (user + Bloom)      │  │
│            │   │                                          │  │
│ Today      │   │  Scrollable, auto-scroll to bottom       │  │
│ ─────────  │   │  ScrollToBottomFAB when scrolled up      │  │
│ Chat 3     │   │                                          │  │
│ Chat 4     │   └──────────────────────────────────────────┘  │
│            │   ┌──────────────────────────────────────────┐  │
│ Yesterday  │   │  BloomInputArea                          │  │
│ ─────────  │   │  📎 │ Auto-resize Textarea         Send │  │
│ Chat 5     │   │  🧠 Reasoning │ 🎨 Image │ 🔬 Research  │  │
│            │   └──────────────────────────────────────────┘  │
│            │                                                  │
│ ┌────────┐ │                                                  │
│ │Settings│ │                                                  │
│ └────────┘ │                                                  │
├────────────┴─────────────────────────────────────────────────┤
```

### Component Files to Create

**`src/components/bloom/BloomLayout.tsx`** — Outer grid: sidebar (280px, collapsible on mobile) + main area. Uses Joy `Box` with CSS Grid matching `DashboardShell` pattern. On mobile (<768px), sidebar is a slide-out drawer (Joy `Drawer`) triggered by a hamburger button.

**`src/components/bloom/BloomSidebar.tsx`** — Conversation list with search, grouping (Pinned → Today → Yesterday → Last 7 Days → Last 30 Days → Older), hover actions (pin, rename, archive, delete). Uses Joy `Sheet` variant="solid" for background (brand-navy, matching CRM sidebar), `List`/`ListItem`/`ListItemButton` for conversation entries, `JoySearchInput` for search. Active conversation has teal left border. "+ New Chat" button at top.

**`src/components/bloom/BloomHeader.tsx`** — Top bar of main area: Bloom avatar + title on left, model selector `JoySelect` (Bloom Standard / Bloom Pro) + "+ New Chat" `JoyButton` on right. Subtle bottom border. Background: `background.surface`.

**`src/components/bloom/BloomConversationArea.tsx`** — The scrollable message list. Renders either `BloomHomeState` (when no conversation active) or `BloomMessageList` (when conversation loaded). Uses a `ref` for scroll container with auto-scroll-to-bottom behavior.

**`src/components/bloom/BloomHomeState.tsx`** — Greeting + suggested prompts shown before first message. Joy `Stack` centered vertically: Bloom avatar (animated breathing pulse using existing CSS `gentle-pulse` animation), greeting text ("Good morning, {name}"), subtitle ("I'm your intelligent business companion"), 4 suggested prompt cards as `JoyCard` interactive variant with icon + text. Cards arranged in 2×2 grid.

**`src/components/bloom/BloomMessageList.tsx`** — Renders messages from conversation history. Maps messages to `BloomUserMessage` or `BloomAssistantMessage` components. Handles loading state with `PageSkeleton` variant="default".

**`src/components/bloom/BloomUserMessage.tsx`** — Right-aligned message bubble. Joy `Sheet` variant="soft" color="neutral" with rounded corners (16px, bottom-right square for speech bubble feel). Max-width 75%.

**`src/components/bloom/BloomAssistantMessage.tsx`** — Left-aligned with Bloom avatar. No bubble background (transparent). Full-width for rich content. Renders text via Markdown (placeholder for now — full renderer in BLOOM-M16). Shows follow-up chips below response. Message action bar on hover (copy, bookmark, regenerate).

**`src/components/bloom/BloomInputArea.tsx`** — Bottom input zone. Joy `Sheet` with top border. Contains: file attachment `IconButton`, auto-resize `Textarea` (Joy), send `IconButton` (teal, filled). Below textarea: mode chips as `JoyChip` variant="outlined" with icons — Standard (default), Reasoning (🧠), Image (🎨), Deep Research (🔬). Active mode chip uses variant="solid" color="primary".

**`src/components/bloom/BloomAvatar.tsx`** — Bloom's distinct avatar — stylized leaf icon with teal-to-mint gradient. Sizes: sm (24px for message list), md (40px for header), lg (64px for home state). Breathing animation on home state using `gentle-pulse`.

**`src/components/bloom/BloomScrollToBottom.tsx`** — Floating action button that appears when user scrolls up. Joy `IconButton` variant="solid" color="neutral" with down-arrow icon. Smooth scroll on click.

### State Management

**`src/components/bloom/BloomContext.tsx`** — React Context provider following existing `AuthContext` pattern:
```
BloomContext {
  activeConversationId: string | null
  conversations: Conversation[]
  messages: Message[]
  isStreaming: boolean
  activeMode: "standard" | "reasoning" | "research" | "image"
  setActiveMode: (mode) => void
  sendMessage: (text, attachments?) => Promise<void>
  createConversation: () => void
  switchConversation: (id) => void
  sourceContext: { entityType, entityId, pathname } | null
}
```

Data fetching uses React Query (`@tanstack/react-query`) for conversation list and message history. Client state (streaming, active mode, input text) uses local React state within the context — NOT Zustand for this initial milestone.

---

## Design Requirements

- **Background:** `sand-50` (#FBF9F4) for main area, matching CRM body color
- **Sidebar:** `brandNavy-800` background, white text — matching CRM sidebar exactly
- **Font:** Quicksand for body text, Inter for display elements — matching CRM theme
- **Spacing:** Follow Joy theme spacing scale (4px increments)
- **Borders:** `neutral.200` for subtle dividers
- **Transitions:** `200ms cubic-bezier(0.4, 0, 0.2, 1)` — matching CRM sidebar transition
- **No dark mode variants** — `JoyThemeProvider` forces light mode
- **Responsive:** Sidebar collapses to drawer on mobile (<768px), input area stays fixed at bottom
- **Scrollbar styling:** Match CRM's thin scrollbar (`scrollbarWidth: "thin"`, `scrollbarColor` pattern from `DashboardShell`)

---

## Acceptance Criteria

- [ ] `/bloom` route registered in `App.tsx` via `renderProtectedSidebarLazyPage`
- [ ] "Bloom" appears in CRM sidebar navigation with correct icon and active highlighting
- [ ] Page renders within `DashboardShell` — existing CRM shell, topbar, and sidebar all work
- [ ] Bloom sidebar shows conversation list grouped by date with pinned section
- [ ] Home state renders with greeting, Bloom avatar (animated), and 4 suggested prompt cards
- [ ] Message list renders user messages (right-aligned bubbles) and assistant messages (left-aligned with avatar)
- [ ] Input area has auto-resize textarea, file attachment button, send button, and mode chips
- [ ] Mode chips switch active mode (Standard/Reasoning/Image/Research) with visual feedback
- [ ] Responsive on mobile — sidebar becomes drawer, input stays fixed at bottom
- [ ] All UI elements use Joy UI exclusively — no `ui-legacy`, no raw HTML, no shadcn
- [ ] Visual quality is premium — matches CRM's Linear/Vercel aesthetic
- [ ] Keyboard: Enter sends, Shift+Enter newlines, Escape closes mobile sidebar
- [ ] Scrollbar styling matches CRM thin scrollbar pattern
- [ ] `BloomContext` provides state for conversation management and message sending

---

## What NOT To Do

- Do NOT use shadcn/ui components — this is the CRM, Joy UI exclusively
- Do NOT use `ui-legacy` components — build with Joy wrappers (`JoyButton`, `JoyCard`, `JoyChip`, etc.)
- Do NOT use `dark:` Tailwind variants — light mode only
- Do NOT implement SSE streaming in this milestone — messages appear as complete blocks for now. Streaming comes in BLOOM-M15
- Do NOT implement the Markdown renderer — plain text for now. Full renderer in BLOOM-M16
- Do NOT implement rich response blocks (data cards, tables, charts) — those come in BLOOM-M13/M17
- Do NOT use `usePathname()` — that's Next.js. Use `useLocation()` from React Router
- Do NOT use `router.refresh()` or `window.location.reload()`
- Do NOT generate test files or documentation
