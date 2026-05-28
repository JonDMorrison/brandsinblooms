# BLOOM-M13: Data Cards, Tables & Stat Cards

> **Copilot Thinking Effort:** XHigh
> **Branch:** `feature/bloom-assist`
> **Phase:** 2 — Query & Mutation System
> **Milestone:** 13 of 40

---

## Objective

Build the rich response block components that render query results as interactive, premium Joy UI cards and tables within the conversation. These are the visual building blocks that transform Bloom from a text chatbot into a data-rich CRM assistant. Every component must match the existing CRM's visual quality — the same `JoyTable`, `JoyCard`, `JoyChip`, `JoyButton` patterns used by `CRMCustomersPage.tsx` and `ProductsPage.tsx`.

---

## Scope

### Components in `src/components/bloom/blocks/`

**`DataCardBlock.tsx`** — Single entity result. Renders differently per entity type:

- **Customer Card:** Joy `Sheet` variant="outlined" with rounded corners. Left: avatar with initials (matching CRM sidebar pattern). Center: name (`Typography` level="title-sm"), email (level="body-xs" color="neutral"), phone. Right column: total_spent (formatted currency), last_purchase_date, order count. Bottom: persona as `JoyChip` variant="soft", segment chips, tag chips. Action bar: "View in CRM" (`JoyButton` variant="outlined" navigates to `/crm/customers/:id`), "View Orders", "Create Campaign", "Tag" (all trigger follow-up Bloom actions).

- **Product Card:** Image thumbnail (or `Package` icon placeholder in Joy `Sheet` variant="soft"). Name, SKU, price (bold, tabular-nums), status `JoyChip`, source `JoyChip`, inventory count (danger color if low). Actions: "View in CRM", "Update Price", "Generate Description".

- **Campaign Card:** Name, subject line, status `JoyChip` (draft/active/sent/paused with appropriate colors), sent_at date, metrics summary (open rate, click rate as inline stats). Actions: "View Report", "Clone", "Pause/Resume".

- **Segment Card:** Name, type `JoyChip` (dynamic/static), member count, status. Actions: "View Members", "Use in Campaign".

**`DataTableBlock.tsx`** — Multiple entity results. Uses the exact same `JoyTable` / `JoyTableHead` / `JoyTableBody` / `JoyTableRow` / `JoyTableCell` / `JoyTableHeaderCell` / `JoyTablePagination` components from the Joy wrapper library. Features:
- Sortable column headers (click to sort within Bloom — client-side sort of current results)
- Clickable rows (navigate to CRM record page)
- Status badges as `JoyChip` variant="soft"
- Max 10 rows visible, pagination for more
- "Export as CSV" action button in header
- Entity-specific column configurations (customers show name/email/spent/last_order, products show name/sku/price/status/inventory, etc.)

**`StatCardBlock.tsx`** — Single metric display. Uses `JoyStatCard` (existing Joy wrapper) with: icon (from lucide-react), metric value (large `Typography` with `fontVariantNumeric: "tabular-nums"`), label, change indicator (↑12% in success color or ↓5% in danger color). Renders 1-4 stat cards in a responsive grid.

**`ChartBlock.tsx`** — Analytics visualization using `recharts` (already in dependencies). Detects data shape and renders appropriate chart:
- Time-series → `LineChart` or `AreaChart`
- Categorical comparison → `BarChart`
- Composition → `PieChart`
- Uses Joy theme colors: primary-500 for main series, neutral-300 for grid, neutral-500 for labels
- Responsive width (fills conversation area)
- Tooltip on hover with formatted values
- Legend below chart

**`InsightBlock.tsx`** — Proactive insight card. `JoyCard` variant="outlined" with: category `JoyChip` (low_stock, dormant_customers, campaign_performance), insight title (`Typography` level="title-sm"), description, action buttons that pre-fill Bloom prompts.

**`ConfirmationBlock.tsx`** — Post-execution result summary. Shows: success count, failure count, entity links ("View Customer Sarah Ahmed"). Uses `JoyChip` color="success"/"danger" for status. Failed items have retry `JoyButton`.

**`NavigationBlock.tsx`** — Auto-navigation result. Shows "Navigated to Orders" as a system message with `JoyChip` and `navigate()` call. Uses Sonner toast as confirmation.

### Block Registry: `src/components/bloom/blocks/BlockRenderer.tsx`

A switch component that takes `{ block_type, payload }` and renders the appropriate block component. Used by `BloomAssistantMessage.tsx` to render structured content within messages.

---

## Design Requirements

- All cards use `JoyCard` variant="outlined" with `borderRadius: "var(--joy-radius-lg)"`
- All action buttons use `JoyButton` size="sm" variant="outlined"/"plain"
- Status chips use `JoyChip` size="sm" variant="soft" with standard color mapping: active=success, draft=warning, archived=neutral, sent=primary, paused=warning, failed=danger
- Currency values use `Intl.NumberFormat` with tabular-nums
- Dates use `date-fns` `format()` (already in deps)
- Cards have subtle hover state: `translateY(-1px)` + `shadow-sm` transition (matching `JoyCard` interactive variant)
- Responsive: stack vertically on mobile, 2-column grid for stat cards on desktop

---

## Acceptance Criteria

- [ ] Customer, Product, Campaign, Segment data cards render with all specified fields and actions
- [ ] Data cards use entity-appropriate layouts and field configurations
- [ ] Data tables use exact same `JoyTable` wrappers as CRM list pages
- [ ] Tables support client-side sorting and pagination
- [ ] Stat cards render 1-4 metrics in responsive grid with change indicators
- [ ] Charts auto-detect data shape and render appropriate chart type
- [ ] Charts use Joy theme colors and have hover tooltips
- [ ] Insight blocks render with category badges and action buttons
- [ ] Confirmation blocks show success/failure summary with entity links
- [ ] Navigation blocks auto-navigate and show toast confirmation
- [ ] `BlockRenderer` correctly routes `block_type` to component
- [ ] All components use Joy UI exclusively — no ui-legacy, no shadcn
- [ ] Visual quality matches existing CRM pages

---

## What NOT To Do

- Do NOT create custom table components — use existing `JoyTable` wrappers
- Do NOT use raw HTML tables or `<table>` elements
- Do NOT use hardcoded colors — use Joy theme tokens
- Do NOT use `dark:` Tailwind variants — light mode only
- Do NOT generate test files or documentation

---
---
---

# BLOOM-M14: Content Generation Integration

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 2 — Query & Mutation System
> **Milestone:** 14 of 40

---

## Objective

Implement the content generation tools that let Bloom draft emails, subject lines, SMS messages, product descriptions, and social content by calling existing Edge Functions. Bloom doesn't reinvent content generation — it calls the same backend the CRM UI already uses.

---

## Scope

### Tool Implementations

**`content-tools.ts`**:

- **`generate_content`**: A versatile content tool with a `content_type` parameter:
  - `email_body` → calls `generate-email-content` Edge Function
  - `subject_lines` → calls `generate-subject-lines` Edge Function (returns 3-5 options)
  - `sms` → calls `generate-sms` Edge Function
  - `product_description` → calls `generate-email-content` with product context
  - `social_post` → calls `generate-social-content` Edge Function
  
  Each call passes: tenant context (company name, industry), persona context (if specified), tone preference (professional/casual/playful/urgent), and any specific instructions from the user.

  Returns generated content as `TextBlock` with follow-up chips: "Use this", "Make it shorter", "More formal", "Generate alternatives".

- **`generate_image`**: Calls existing `generate-ai-image` Edge Function (uses `LOVABLE_API_KEY`). Passes prompt through `enhance-image-prompt` first for better results. Uses climate constraints from `_shared/climateConstraints.ts` and location guardrails. Result stored in Supabase Storage `global-ai-images` bucket. Returns `ImageBlock` with download/save actions.

### Content Refinement Loop

When the user says "Make it shorter" or "More formal" after a generation:
- The orchestrator detects this as a refinement (not a new generation)
- Appends the original content + refinement instruction to a new generation call
- Streams the refined version
- Follow-up chips update: "Use this version", "Try again", "Revert to original"

### Integration with Campaign Tools

When `create_campaign` task plan includes content fields (subject, body), the content generation tool is called inline during plan construction to pre-fill those fields. The user can edit them in the task plan before approval.

---

## Acceptance Criteria

- [ ] Email body generation calls existing `generate-email-content` Edge Function
- [ ] Subject line generation returns 3-5 options
- [ ] SMS generation respects character limits
- [ ] Image generation uses existing pipeline with climate/location guardrails
- [ ] Content refinement ("make it shorter") works as an iterative loop
- [ ] Generated content integrates with campaign task plans
- [ ] All generation calls pass tenant context for brand-appropriate content
- [ ] Follow-up chips allow iterative refinement

---

## What NOT To Do

- Do NOT reimplement content generation logic — call existing Edge Functions
- Do NOT skip `enhance-image-prompt` before image generation
- Do NOT generate images without climate constraints
- Do NOT generate test files or documentation
