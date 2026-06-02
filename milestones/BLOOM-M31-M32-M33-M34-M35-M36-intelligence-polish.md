# BLOOM-M31: Page-Aware Context Injection

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 7 — Intelligence & Polish
> **Milestone:** 31 of 40

---

## Objective

Implement the `resolvePageContext()` utility that reads `useLocation().pathname` from React Router and maps it to a structured context object. This context is sent to the orchestrator and injected into the system prompt, making Bloom aware of where the user currently is in the CRM.

---

## Scope

### Utility: `src/components/bloom/utils/resolvePageContext.ts`

Uses React Router's `matchPath()` to pattern-match routes:

```
/dashboard → { pageCategory: "dashboard", entityType: null, entityId: null, suggestions: [...] }
/crm/customers → { pageCategory: "customers", entityType: null, ... }
/crm/customers/:id → { pageCategory: "customers", entityType: "customer", entityId: id, ... }
/products → { pageCategory: "products", entityType: null, ... }
/products/:id → { pageCategory: "products", entityType: "product", entityId: id, ... }
/crm/campaigns → { pageCategory: "campaigns", entityType: null, ... }
/crm/campaigns/:id/edit → { pageCategory: "campaigns", entityType: "campaign", entityId: id, ... }
/crm/segments → { pageCategory: "segments", entityType: null, ... }
/analytics → { pageCategory: "analytics", entityType: null, ... }
/integrations → { pageCategory: "integrations", entityType: null, ... }
/settings → { pageCategory: "settings", entityType: null, ... }
```

Each mapping includes `availableActions[]` and `suggestions[]` appropriate to that page.

### Context Injection

In `BloomContext.tsx`:
- Read `useLocation()` on every route change
- Call `resolvePageContext(pathname)`
- Include the result in every `sendMessage()` call payload as `page_context`
- The orchestrator includes this in Layer 3 of the context assembly

### Dynamic Suggestions

In `BloomHomeState.tsx`:
- Instead of static prompt cards, use `page_context.suggestions[]` to render contextual cards
- If page context provides an entity, include entity-specific prompts

---

## Acceptance Criteria

- [ ] `resolvePageContext` correctly maps all major CRM routes
- [ ] Dynamic routes extract entity type and ID from path params
- [ ] Page context sent to orchestrator on every message
- [ ] Home screen suggestions adapt based on current route
- [ ] Context injected into Layer 3 of the system prompt
- [ ] Uses React Router `matchPath()` — NOT Next.js `usePathname()`

---

## What NOT To Do

- Do NOT use `usePathname()` — that's Next.js. Use `useLocation()` from react-router-dom
- Do NOT hardcode route strings — use `matchPath()` patterns
- Do NOT generate test files or documentation

---
---
---

# BLOOM-M32: Entity "This" Resolution

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 7 — Intelligence & Polish
> **Milestone:** 32 of 40

---

## Objective

When a user navigates to Bloom from a specific record page (e.g., `/crm/customers/abc123`), Bloom should understand deictic references like "this customer", "it", "this order". The navigation context carries the entity type and ID, and the orchestrator resolves references before tool calls.

---

## Scope

### Navigation Context Storage

In `BloomContext.tsx`:
- Track `sourceContext: { entityType, entityId, entitySummary }` — set when user navigates to Bloom from another page
- Persist in React state (not Supabase — ephemeral per session)
- Reset when user starts a new conversation

### Entity Pre-Fetch

When `sourceContext` has an entity:
- Use React Query to pre-fetch the entity summary:
  - Customer: `useCRMCustomers` for name, email, phone, total_spent
  - Product: `useProducts` for name, price, status
  - Campaign: query `crm_campaigns` for name, subject, status
- Summary included in the orchestrator request as `page_context.entity_summary`

### Orchestrator Pre-Processing

In `bloom-assist/context-builder.ts`:
- If `page_context.entity_type` and `page_context.entity_id` are present, inject into Layer 3: "The user is currently viewing {entity_type} '{entity_summary.name}' (ID: {entity_id}). When they say 'this', 'it', 'this customer', 'this product', etc., they are referring to this specific entity."

### Workspace Memory Update

After resolving an entity via "this" reference:
- Add the entity to `workspace_memory.recent_entities` in `bloom_user_profiles`

---

## Acceptance Criteria

- [ ] Navigation context captured when user arrives from a record page
- [ ] Entity summary pre-fetched and sent to orchestrator
- [ ] "This customer" / "this product" / "it" correctly resolves to the navigation entity
- [ ] Orchestrator includes entity context in system prompt
- [ ] Entity added to workspace memory after resolution
- [ ] Works for customers, products, campaigns, and segments

---

## What NOT To Do

- Do NOT persist navigation context across sessions — it's ephemeral
- Do NOT skip the entity pre-fetch — Bloom needs the summary for context
- Do NOT generate test files or documentation

---
---
---

# BLOOM-M33: Workspace Memory

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 7 — Intelligence & Polish
> **Milestone:** 33 of 40

---

## Objective

Implement the persistent workspace memory that tracks recent entities, recent actions, learned preferences, and pinned context across sessions. Stored in `bloom_user_profiles.workspace_memory` JSONB. Loaded into Layer 3 of every request.

---

## Scope

### Memory Structure

```jsonc
{
  "recent_entities": [
    { "type": "customer", "id": "uuid", "name": "Sarah Ahmed", "accessed_at": "ISO" },
    { "type": "product", "id": "uuid", "name": "Spring Bouquet", "accessed_at": "ISO" }
    // Last 10, FIFO
  ],
  "recent_actions": [
    { "action": "created_campaign", "entity_name": "Mother's Day Sale", "status": "completed", "at": "ISO" }
    // Last 5, FIFO
  ],
  "preferences": {
    "currency_format": "USD",
    "response_density": "concise",
    "preferred_chart_type": "bar"
  },
  "pinned_context": [
    { "type": "segment", "id": "uuid", "name": "VIP Customers", "pinned_at": "ISO" }
    // Max 3 pins
  ]
}
```

### Memory Update Logic (in orchestrator)

After every response:
1. If tools queried/modified entities → add to `recent_entities` (deduplicate by ID, update `accessed_at`)
2. If task plan was executed → add to `recent_actions`
3. If user expressed a preference ("show me in PKR", "be more concise") → update `preferences`
4. Batch update `bloom_user_profiles.workspace_memory` via service-role client

### Memory Injection

In `context-builder.ts` Layer 3:
- "Recent context: User recently worked with: {recent_entities[0..4].name}. Last actions: {recent_actions[0..2]}. Preferences: {preferences}."
- Pinned context always included: "User has pinned: {pinned_context items}"
- Budget: ~300-600 tokens for memory injection

### Pin/Unpin UI

In Bloom conversation:
- When an entity is mentioned in a response, a subtle "Pin" action appears
- Pinned items show in a "Pinned" section on the home screen
- Max 3 pins per user
- Pin management in Bloom settings

---

## Acceptance Criteria

- [ ] Recent entities tracked (last 10, FIFO, deduplicated)
- [ ] Recent actions tracked (last 5, FIFO)
- [ ] Preferences learned from conversation signals
- [ ] Pinned context persists and shows on home screen
- [ ] Memory loaded into Layer 3 of every request
- [ ] Memory stays within ~600 token budget
- [ ] Pin/unpin actions work from conversation and settings
- [ ] All data scoped by `tenant_id + user_id`

---

## What NOT To Do

- Do NOT store memory in the LLM — it has no cross-session memory
- Do NOT exceed 3 pinned items
- Do NOT store sensitive data (passwords, API keys) in memory
- Do NOT generate test files or documentation

---
---
---

# BLOOM-M34: Proactive Insights Engine

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 7 — Intelligence & Polish
> **Milestone:** 34 of 40

---

## Objective

Build the scheduled Edge Function that analyzes tenant data and generates proactive insights stored in `bloom_proactive_insights`. Insights appear on Bloom's home screen as actionable cards.

---

## Scope

### Scheduled Edge Function: `supabase/functions/bloom-insights-generator/index.ts`

Runs daily (or on-demand). For each active tenant:

1. **Low Stock Detection:** Query `products` where `track_inventory = true AND inventory_count < low_stock_threshold`. Generate insight: "X products are running low on stock."

2. **Dormant Customers:** Query `crm_customers` where `last_purchase_date < now() - interval '90 days'` and `total_spent > threshold`. Generate insight: "X high-value customers haven't ordered in 90+ days."

3. **Campaign Performance Anomalies:** Query recent `crm_campaigns` where open_rate or click_rate significantly above/below tenant average. Generate insight: "Campaign X has 2× your average open rate."

4. **Revenue Anomalies:** Compare today's/this week's revenue to historical average. Generate insight if >30% deviation.

5. **Pending Drafts:** Count draft campaigns and products. Generate insight: "You have X draft campaigns waiting for review."

Each insight saved to `bloom_proactive_insights` with: `tenant_id`, `insight_type`, `title`, `description`, `action_prompt`, `severity`, `entity_type`, `entity_id`.

### Home Screen Insights Section: `src/components/bloom/BloomInsightsSection.tsx`

- Fetches non-dismissed, non-expired insights for the current user+tenant
- Renders as a horizontal scrollable `Stack` of `InsightBlock` cards (from M13)
- Each card has: category `JoyChip`, title, description, "Ask Bloom" `JoyButton` (sends `action_prompt` as a message), dismiss `IconButton`
- Maximum 5 visible, older ones auto-dismissed
- If no insights: section hidden (no empty state)

---

## Acceptance Criteria

- [ ] Scheduled Edge Function generates insights from real tenant data
- [ ] Insights stored in `bloom_proactive_insights` with correct metadata
- [ ] Home screen shows insight cards for the current user
- [ ] "Ask Bloom" button sends the action prompt as a conversation starter
- [ ] Dismiss action adds user ID to `dismissed_by` array
- [ ] Insights expire via `expires_at` timestamp
- [ ] All insights scoped by `tenant_id`

---

## What NOT To Do

- Do NOT generate insights from hypothetical data — use real queries
- Do NOT show more than 5 insights at a time
- Do NOT generate test files or documentation

---
---
---

# BLOOM-M35: Onboarding & Progressive Disclosure

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 7 — Intelligence & Polish
> **Milestone:** 35 of 40

---

## Objective

Implement the progressive capability disclosure system that introduces Bloom's features gradually based on user experience level. New users see simple query suggestions; experienced users unlock mutations, reasoning, research, and image generation.

---

## Scope

### Onboarding Stages

Tracked in `bloom_user_profiles.onboarding_stage` (integer 0-3):

**Stage 0 (first visit, 0 interactions):**
- Home screen shows welcome `JoyCard` with Bloom avatar, greeting, 4 basic query prompts
- Mode chips: only "Standard" visible
- System prompt includes: "This is a new user. Suggest simple queries first. Do not mention advanced features yet."
- Contextual tip after 3 interactions: "Tip: Type / for quick commands."

**Stage 1 (5+ interactions):**
- Welcome card replaced by dynamic suggestions
- Mutation capabilities surface: "Did you know I can create campaigns for you?"
- System prompt unlocks mutation tool mentions
- Contextual tip after first mutation: "Tip: I always show you a plan before making changes."

**Stage 2 (15+ interactions):**
- Reasoning and Research mode chips appear
- System prompt mentions analytical capabilities
- Contextual tip: "Tip: Try Reasoning mode for strategic questions."

**Stage 3 (30+ interactions or explicit unlock):**
- All features visible: Image generation, export, advanced analytics
- Full mode chip set
- Contextual tip: "Tip: Press ⌘K from any page to ask me something without leaving your work."

### Stage Advancement

In the orchestrator, after every response:
- Increment `bloom_user_profiles.interaction_count`
- Check if `interaction_count` crosses a stage threshold
- If stage advances, update `onboarding_stage` and set the next contextual tip

### Contextual Tips: `src/components/bloom/BloomContextualTip.tsx`

- Renders as a subtle `JoyChip` variant="soft" color="neutral" within the conversation flow
- Dismissible (click X removes it)
- Each tip shown once — tracked in `bloom_user_profiles.seen_tips` text array
- Tips injected as system messages in the conversation (not LLM-generated)

### Stage Override

In Bloom settings (M29), add a toggle: "Unlock all features now" — jumps to Stage 3 regardless of interaction count.

---

## Acceptance Criteria

- [ ] Onboarding stages 0-3 work with correct feature visibility
- [ ] Mode chips show/hide based on stage
- [ ] System prompt adapts tool mentions based on stage
- [ ] Contextual tips appear once per user at correct triggers
- [ ] Tips are dismissible and tracked in `seen_tips`
- [ ] Stage advancement automatic based on interaction count
- [ ] Manual override in settings works
- [ ] Welcome card shown only at Stage 0, replaced by dynamic suggestions at Stage 1+

---

## What NOT To Do

- Do NOT show all features at once for new users — progressive disclosure is intentional
- Do NOT show the same tip twice
- Do NOT block features entirely at lower stages — they just aren't suggested. If user explicitly asks for reasoning mode, honor it regardless of stage.
- Do NOT generate test files or documentation

---
---
---

# BLOOM-M36: Performance Optimization

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 7 — Intelligence & Polish
> **Milestone:** 36 of 40

---

## Objective

Optimize Bloom for production performance: chunked token rendering at 60fps, lazy loading of heavy components, efficient React Query caching, reduced bundle size, and meeting all latency targets from Document 07 Section 7.4.

---

## Scope

### Rendering Optimization

- **Chunked token append:** Batch 3-5 tokens before DOM update (reduce from per-token re-renders)
- **Ref-based streaming:** During streaming, use `ref.current.textContent +=` instead of React state updates
- **Virtualized message list:** For long conversations (50+ messages), use `@tanstack/react-virtual` (already in deps) to only render visible messages
- **Lazy block loading:** Heavy blocks (ChartBlock, DataTableBlock) use `React.lazy()` with `Suspense` fallback of `JoySkeleton`
- **Image lazy loading:** All images in ImageBlock use `loading="lazy"` attribute

### Caching Optimization

- React Query stale times aligned with entity update frequency:
  - Conversations list: 30s
  - Messages: 60s (but invalidated on new message)
  - Dashboard stats: 60s
  - Products: 120s
  - Email health: 300s
- `bloom_user_profiles`: cached for 5 minutes, invalidated on update

### Bundle Optimization

- `react-markdown` + `remark-gfm` loaded via `React.lazy()` (not in main bundle)
- `recharts` already in a manual chunk (Vite config)
- `highlight.js` loaded dynamically — only import needed language parsers

### Latency Monitoring

- Track and log:
  - Time to first token (target: <400ms)
  - Time to first block (target: <2s)
  - Full simple response (target: <3s)
  - Full complex response (target: <8s)
- Log via `bloom_audit_log.latency_ms`

### Reduced Motion

- Check `prefers-reduced-motion` via `useMediaQuery("(prefers-reduced-motion: reduce)")` (hook exists in CRM)
- Disable: streaming cursor, block entrance animations, chart animations, thinking-dot pulse
- Instant transitions replace animated ones

---

## Acceptance Criteria

- [ ] Token streaming at 60fps with no jank
- [ ] Virtualized message list for conversations with 50+ messages
- [ ] Heavy components lazy-loaded with Suspense fallbacks
- [ ] React Query caching reduces redundant requests
- [ ] Bundle size for Bloom page reasonable (<200KB initial JS)
- [ ] `prefers-reduced-motion` respected for all animations
- [ ] Latency metrics logged to audit table
- [ ] Performance targets met (first token <400ms, simple response <3s)

---

## What NOT To Do

- Do NOT use `window.requestAnimationFrame` for token rendering — use batched ref updates
- Do NOT load `recharts` and `react-markdown` in the main bundle
- Do NOT re-render the entire message list on every token — only the streaming message
- Do NOT generate test files or documentation
