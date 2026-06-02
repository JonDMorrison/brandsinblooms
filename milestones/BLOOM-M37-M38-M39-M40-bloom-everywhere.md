# BLOOM-M37: Command Palette Integration (⌘K)

> **Copilot Thinking Effort:** XHigh
> **Branch:** `feature/bloom-assist`
> **Phase:** 8 — Bloom Everywhere
> **Milestone:** 37 of 40

---

## Objective

Extend the existing `CommandPalette.tsx` (already using `cmdk`, already wired to `⌘K` in `DashboardShell.tsx`) with a "Ask Bloom" command that transforms the palette into a compact Bloom input. Users can query Bloom from any CRM page without navigating away.

---

## Scope

### Command Registration

In `src/components/search/staticSearchRegistry.ts`:
- Add a "Bloom" category with entry: `{ id: "bloom-ask", label: "Ask Bloom", shortcut: "⌘J", icon: SparklesIcon, category: "Bloom", action: "bloom_input" }`
- This entry appears at the top of search results when no search text is entered
- When search text is entered and no other results match well, show "Ask Bloom: {search text}" as a fallback

### Bloom Compact Mode: `src/components/bloom/BloomCompactMode.tsx`

When the user selects "Ask Bloom" from the command palette:
- The `CommandPalette` dialog transitions to a Bloom input mode:
  - Header changes to show Bloom avatar + "Ask Bloom"
  - The `cmdk` input becomes the Bloom message input
  - Below the input: compact mode chips (Standard, Reasoning — no Image/Research in compact mode)
  - Results area shows the streaming response in a compact format

- Compact response rendering:
  - `TextBlock` renders as compact text (smaller typography, `body-xs`)
  - `DataCardBlock` renders as a simplified single-line: "Customer: Sarah Ahmed — £2,400 spent — [View]"
  - `DataTableBlock` renders as first 5 rows only with "See all in Bloom →" link
  - `StatCardBlock` renders inline: "Revenue: £12,400 (↑15%)"
  - `ChartBlock` does NOT render in compact mode — shows "Open in Bloom to see chart →"

- Conversation management:
  - Compact conversations are ephemeral (not saved to history)
  - "Continue in Bloom →" link at bottom navigates to `/bloom` and transfers the conversation context
  - If the response triggers a task plan, auto-redirect to full Bloom page

### Global Shortcut: ⌘J

In `DashboardShell.tsx`:
- Add `⌘J` handler that navigates directly to `/bloom` (full page)
- `⌘K` opens the command palette (existing behavior)
- Typing "bloom" or "ask" in `⌘K` highlights the Bloom entry

### Context Passing

When opening Bloom from the command palette:
- `resolvePageContext()` captures the current route BEFORE the palette opens
- Page context sent to the orchestrator with the message
- "This" resolution works — if user is on a customer page and types "tag this as VIP" in compact mode, it works

---

## Acceptance Criteria

- [ ] "Ask Bloom" entry appears in command palette
- [ ] Selecting it transforms the palette into Bloom input mode
- [ ] Messages sent from compact mode go to the same `bloom-assist` orchestrator
- [ ] Responses render in compact format within the palette dialog
- [ ] Data blocks render simplified versions appropriate for compact space
- [ ] Charts redirect to full Bloom page
- [ ] "Continue in Bloom →" navigates to `/bloom` with context
- [ ] Task plans auto-redirect to full Bloom page
- [ ] `⌘J` opens full Bloom page, `⌘K` opens command palette
- [ ] Page context captured correctly from the source route
- [ ] Compact conversations are ephemeral (not saved)
- [ ] All compact UI uses Joy UI — within the existing `JoyDialog` modal

---

## What NOT To Do

- Do NOT create a new dialog/modal for compact mode — reuse the existing `CommandPalette` `JoyDialog`
- Do NOT render charts or complex blocks in compact mode — redirect to full page
- Do NOT save compact conversations to history — they're ephemeral
- Do NOT add a new `⌘K` handler — the existing one in `DashboardShell` already works
- Do NOT generate test files or documentation

---
---
---

# BLOOM-M38: Inline Bloom Chips

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 8 — Bloom Everywhere
> **Milestone:** 38 of 40

---

## Objective

Add contextual `BloomChip` components to key CRM pages that let users trigger Bloom actions with one click. Each chip opens the Command Palette (Tier 2) pre-filled with a relevant prompt and entity context.

---

## Scope

### Component: `src/components/bloom/BloomChip.tsx`

A small `JoyChip` variant="outlined" color="primary" size="sm" with the Bloom sparkle icon and a short label:

Props:
- `prompt: string` — the pre-filled prompt text
- `entityType: string` — customer, product, campaign, segment
- `entityId: string` — the specific entity ID
- `label: string` — chip text (e.g., "Ask Bloom", "Generate description")

On click:
- Opens the Command Palette in Bloom compact mode (from M37)
- Pre-fills the input with `prompt`
- Sets `sourceContext` with `entityType` and `entityId`
- Auto-sends the message (no need for user to press Enter)

### Placement Across CRM Pages

Add `BloomChip` to these existing pages (import and place next to relevant UI elements):

**`CustomerDashboardPage.tsx`** — Near the activity/insights section:
- `<BloomChip label="Ask Bloom about this customer" prompt="Summarize this customer's history and suggest next steps" entityType="customer" entityId={customerId} />`

**`ProductDetailPage.tsx`** — Near the description field:
- `<BloomChip label="Generate description" prompt="Generate a compelling product description for this product" entityType="product" entityId={productId} />`

**`CRMCampaignEditorPage.tsx`** — Near the content area:
- `<BloomChip label="Draft campaign copy" prompt="Draft email content for this campaign based on its audience and theme" entityType="campaign" entityId={campaignId} />`

**`SegmentBuilderPage.tsx`** — Near the rules section:
- `<BloomChip label="Explain this segment" prompt="Analyze this segment's rules and tell me who it targets" entityType="segment" entityId={segmentId} />`

**`CRMCampaignsPage.tsx`** — In the page header area:
- `<BloomChip label="Campaign insights" prompt="Show me how my campaigns performed this month and suggest improvements" />`

### Visual Design

- Chip appears with subtle sparkle icon (Sparkles from lucide-react, 14px)
- Color: `primary` outlined — matches the CRM's teal accent
- Position: inline with existing UI elements, right-aligned or below relevant sections
- Hover: slight background fill (`primary.50`)
- Subtle entrance animation on page load: fade-in after 500ms delay (so it doesn't compete with page content)

---

## Acceptance Criteria

- [ ] `BloomChip` component renders as a styled `JoyChip` with sparkle icon
- [ ] Clicking a chip opens Command Palette in Bloom compact mode
- [ ] Prompt pre-filled and entity context passed correctly
- [ ] Message auto-sends on chip click
- [ ] Chips placed on Customer Dashboard, Product Detail, Campaign Editor, Segment Builder, and Campaigns list pages
- [ ] Chips don't interfere with existing page layouts
- [ ] Visual design is subtle and premium — not intrusive

---

## What NOT To Do

- Do NOT add chips to every page — only the 5 specified pages
- Do NOT make chips oversized or attention-grabbing — they should be subtle
- Do NOT skip entity context passing — the whole point is contextual
- Do NOT generate test files or documentation

---
---
---

# BLOOM-M39: Proactive Notification Delivery

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 8 — Bloom Everywhere
> **Milestone:** 39 of 40

---

## Objective

Connect the proactive insights engine (M34) to the CRM's notification system. Insights appear as notification items that, when clicked, open Bloom with the relevant context pre-loaded.

---

## Scope

### Notification Integration

In the `bloom-insights-generator` Edge Function (M34):
- After generating insights, also write notification records to the CRM's existing notification table (if one exists — check for `notifications` or `support_notifications` table)
- Each notification includes: title, description, link to `/bloom?insight={insightId}`, icon type

### Bloom URL Parameter Handling

In `BloomPage.tsx`:
- Check URL search params for `insight` parameter: `useSearchParams().get("insight")`
- If present, fetch the insight from `bloom_proactive_insights` by ID
- Auto-send the insight's `action_prompt` as the first message in a new conversation
- Clear the URL parameter after processing

### Notification Badge

If the CRM has a notification bell in `DashboardTopBar.tsx`:
- Bloom insights appear alongside other notifications
- Clicking a Bloom notification navigates to `/bloom?insight={id}`
- Bloom notifications have the sparkle icon to distinguish them from other notifications

### Fallback (No Notification System)

If the CRM doesn't have a centralized notification system:
- Show a badge on the Bloom sidebar item: `JoyBadge` variant="solid" color="danger" with insight count
- Badge disappears after user views the home screen (marks insights as seen)

---

## Acceptance Criteria

- [ ] Proactive insights delivered as CRM notifications (if notification system exists)
- [ ] Clicking a notification opens Bloom with insight context
- [ ] URL parameter `?insight=id` triggers auto-send of the insight's prompt
- [ ] Bloom sidebar shows badge for unread insights
- [ ] Notifications distinguish Bloom insights with sparkle icon

---

## What NOT To Do

- Do NOT create a new notification system — use whatever exists in the CRM
- Do NOT spam notifications — max 3 per tenant per day
- Do NOT generate test files or documentation

---
---
---

# BLOOM-M40: Keyboard Shortcuts & Slash Commands

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 8 — Bloom Everywhere
> **Milestone:** 40 of 40

---

## Objective

Implement the complete keyboard shortcut system and slash command menu for Bloom. Power users can operate Bloom entirely from the keyboard. Slash commands provide quick access to common operations without typing full prompts.

---

## Scope

### Global Shortcuts (in `DashboardShell.tsx`)

| Shortcut | Action | Implementation |
|---|---|---|
| `⌘K` | Open Command Palette | Already exists — no changes needed |
| `⌘J` | Navigate to Bloom (`/bloom`) | New `keydown` listener, calls `navigate("/bloom")` |
| `⌘ Shift J` | New Bloom conversation | Navigates to `/bloom` and calls `createConversation()` |

### Chat Shortcuts (in `BloomInputArea.tsx`)

| Shortcut | Action |
|---|---|
| `Enter` | Send message |
| `Shift+Enter` | New line in textarea |
| `⌘ Shift R` | Regenerate last assistant response |
| `⌘ Shift E` | Edit last user message |
| `⌘ Shift C` | Copy last assistant response to clipboard |
| `⌘+1/2/3/4` | Switch mode (Standard/Reasoning/Research/Image) |
| `↑` (in empty input) | Load last user message for editing |
| `/` (in empty input) | Open slash command menu |
| `Escape` | Close mobile sidebar / Close slash menu |

### Slash Command Menu: `src/components/bloom/BloomSlashMenu.tsx`

When the user types `/` in an empty input, a `cmdk` powered menu appears above the input (dropdown-up direction):

| Command | Action | Category |
|---|---|---|
| `/customers [query]` | Search customers | Query |
| `/products [query]` | Search products | Query |
| `/campaigns [query]` | Search campaigns | Query |
| `/stats` | Dashboard summary | Analytics |
| `/revenue [period]` | Revenue analytics | Analytics |
| `/export [entity]` | Export data as CSV | Utility |
| `/navigate [page]` | Go to CRM page | Navigation |
| `/mode [name]` | Switch mode | Settings |
| `/clear` | Clear current conversation | Management |
| `/new` | Start new conversation | Management |
| `/help` | Show all available commands | Help |

Menu rendered as a floating `JoyCard` with `cmdk` `Command.List` + `Command.Item` inside. Position: above the textarea, anchored to the `/` character position. Max height 300px with scroll. Each item shows: command name (bold), description (neutral), keyboard shortcut (if any).

Selecting a command:
- Commands with parameters (e.g., `/customers Sarah`) → replace input text with the command's natural language equivalent ("Search customers for Sarah") and auto-send
- Commands without parameters (e.g., `/stats`) → auto-send directly
- Mode commands → switch mode and clear input
- Management commands → execute directly (no LLM call)

### Keyboard Shortcuts Panel: `src/components/bloom/BloomShortcutsPanel.tsx`

Accessed via `/help` command or a keyboard icon in Bloom's header:
- `JoyDialog` listing all shortcuts in a clean table
- Grouped by category: Global, Chat, Modes, Commands
- Each row: shortcut key combo (`JoyChip` variant="soft"), description

---

## Acceptance Criteria

- [ ] `⌘J` navigates to Bloom from any CRM page
- [ ] `⌘ Shift J` creates a new Bloom conversation
- [ ] All chat shortcuts work: Enter, Shift+Enter, ⌘ Shift R/E/C, ⌘+1-4, ↑, /
- [ ] Slash menu appears when typing `/` in empty input
- [ ] All slash commands execute correctly
- [ ] Slash menu uses `cmdk` with fuzzy search
- [ ] Shortcuts panel shows all available shortcuts
- [ ] Menu dismisses on Escape or click outside
- [ ] All UI uses Joy UI — `JoyCard`, `JoyDialog`, `JoyChip`, `Typography`
- [ ] No conflicts with existing CRM keyboard shortcuts

---

## What NOT To Do

- Do NOT override existing CRM shortcuts (⌘K already used for command palette)
- Do NOT make slash commands visible in the message history — they're UI-only
- Do NOT require the slash menu for any operation — it's an accelerator, not a requirement
- Do NOT generate test files or documentation

---

# 🎉 Bloom Assist — All 40 Milestones Complete

This concludes the full milestone generation across all 8 phases:

| Phase | Milestones | Status |
|---|---|---|
| **Phase 1: Foundation** | M01–M08 | ✅ Generated |
| **Phase 2: Query & Mutation System** | M09–M14 | ✅ Generated |
| **Phase 3: Streaming & Core UX** | M15–M20 | ✅ Generated |
| **Phase 4: Advanced Modes** | M21–M24 | ✅ Generated |
| **Phase 5: Rich Media & Knowledge** | M25–M28 | ✅ Generated |
| **Phase 6: Settings & Admin** | M29–M30 | ✅ Generated |
| **Phase 7: Intelligence & Polish** | M31–M36 | ✅ Generated |
| **Phase 8: Bloom Everywhere** | M37–M40 | ✅ Generated |
