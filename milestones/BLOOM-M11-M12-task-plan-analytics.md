# BLOOM-M11: Task Execution Plan & Approval System

> **Copilot Thinking Effort:** XHigh
> **Branch:** `feature/bloom-assist`
> **Phase:** 2 — Query & Mutation System
> **Milestone:** 11 of 40

---

## Objective

Implement the complete Task Execution Plan system from Document 06. Every mutation Bloom performs must first be presented as a structured, reviewable plan. The user approves, modifies, or cancels before execution. This is the trust layer — the user should never be surprised by what Bloom did.

---

## Scope

### Backend: Task Plan Generation

In the orchestrator (`bloom-assist/index.ts`), when a mutation tool returns `confirmation_required: true`:

1. **Planning Phase:** The LLM decomposes the user's request into discrete tasks. Each task has: `task_id`, `action` (create/update/delete/send), `entity_type`, `entity_id` (null for creates), `description` (human-readable), `field_changes` (what will change), `risk_level`, `depends_on` (task dependencies), `editable_fields` (fields the user can modify inline).

2. **Validation Phase:** Each task passes through the 7-step pre-execution validation pipeline from Document 05:
   - Duplicate detection (does this entity already exist?)
   - Ambiguity detection (does the reference match multiple records?)
   - Data quality validation (unusual prices, missing required fields, invalid formats)
   - Constraint checking (permission, plan limits)
   - Cross-reference validation (do referenced entities exist?)
   - Conflict detection (would this break existing relationships?)
   - Smart suggestions (could Bloom enhance the operation?)

3. **Presentation Phase:** Return the plan as a `TaskPlanBlock` via SSE.

### Frontend: Task Plan UI Components

**`src/components/bloom/blocks/TaskPlanBlock.tsx`**

A `JoyCard` variant="outlined" containing:
- Header: "Task Execution Plan" with task count badge (`JoyChip`)
- Each task as a row with:
  - `Checkbox` (Joy) — checked by default, unchecked to skip
  - Task icon (create=Plus, update=Pencil, delete=Trash2, send=Send from lucide-react)
  - Description as `Typography` level="body-sm"
  - Risk badge: `JoyChip` variant="soft" color mapped to risk (safe=success, low=primary, medium=warning, high=danger)
  - Validation annotations: warnings/errors as `JoyChip` variant="soft" color="warning"/"danger" with tooltip explanations
  - Editable fields: `JoyInput` inline for modifiable parameters (e.g., discount percentage, campaign name)
  - Expand/collapse for field change details
- Footer actions:
  - "Approve All" → `JoyButton` variant="solid" color="primary"
  - "Approve Selected" → `JoyButton` variant="outlined" color="primary" (when some tasks unchecked)
  - "Cancel" → `JoyButton` variant="plain" color="neutral"
  - "Discuss" → `JoyButton` variant="plain" color="primary" (asks Bloom a question about the plan)

**`src/components/bloom/blocks/TaskExecutionProgress.tsx`**

Shown after approval. Each task shows real-time status:
- Pending: `CircularProgress` size="sm"
- Executing: `CircularProgress` with animation
- Completed: Check icon in `JoyChip` color="success"
- Failed: X icon in `JoyChip` color="danger" with retry button

**Interaction Flow:**
1. User sends mutation request → LLM generates task plan → rendered as `TaskPlanBlock`
2. User reviews, optionally edits fields, unchecks unwanted tasks
3. User clicks Approve → frontend sends approval to orchestrator via new SSE event `event: approval`
4. Orchestrator executes approved tasks sequentially → streams `TaskExecutionProgress` updates
5. Final `ConfirmationBlock` shows summary: X completed, Y skipped, Z failed (with retry)

### Compact Mode

For simple single-field updates ("Change product price to $25"), show a compact inline confirmation instead of the full task plan:
- "Update Spring Bouquet price from $20 to $25?" with Confirm/Cancel buttons inline
- Rendered as a mini `JoyCard` within the message, not a full plan

---

## Acceptance Criteria

- [ ] Every mutation tool triggers the task plan flow — no silent mutations
- [ ] Task plan renders as `TaskPlanBlock` with checkboxes, risk badges, and validation annotations
- [ ] Editable fields work inline (e.g., changing discount percentage)
- [ ] Users can uncheck individual tasks for selective approval
- [ ] "Approve All", "Approve Selected", and "Cancel" actions work correctly
- [ ] Execution progress shows real-time status per task with Joy UI indicators
- [ ] Failed tasks show retry button without blocking subsequent tasks
- [ ] Compact mode works for single-field updates
- [ ] Validation annotations from Document 05's 7-step pipeline appear on relevant tasks
- [ ] All UI uses Joy UI — `JoyCard`, `JoyButton`, `JoyChip`, `JoyInput`, `Checkbox`, `CircularProgress`
- [ ] "Discuss" button lets user ask Bloom about the plan before approving

---

## What NOT To Do

- Do NOT allow any mutation to execute without user approval (even "safe" creates)
- Do NOT show the full task plan for trivial single-field updates — use compact mode
- Do NOT block the entire plan if one task fails — continue with remaining tasks
- Do NOT use `ui-legacy` components — Joy UI exclusively
- Do NOT generate test files or documentation

---
---
---

# BLOOM-M12: Analytics Tools

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 2 — Query & Mutation System
> **Milestone:** 12 of 40

---

## Objective

Implement analytics tools that give Bloom access to business intelligence: dashboard summaries, revenue analytics, email health, customer timelines, and integration status. These tools read from existing views, RPCs, and computed metrics — they do not compute analytics from scratch.

---

## Scope

### Tool Implementations

**`analytics-tools.ts`**:

- **`get_dashboard_summary`**: Reads today's key metrics — total customers, new this month, total revenue, active campaigns, pending orders. Follows `useDashboardData.ts` patterns. Returns `block_type: "stat_card"` with 4-6 KPI values.

- **`get_revenue_analytics`**: Reads revenue data by period (today, this week, this month, this quarter, custom range). Can break down by channel (POS, online, provider). Follows `useROIAnalytics` and `useAnalyticsOverview` patterns. Returns `block_type: "chart"` for time-series, `"stat_card"` for single period.

- **`get_email_health`**: Reads deliverability metrics — bounce rate, spam complaints, domain reputation, warmup status. Uses `get_domain_email_stats_30d` RPC and `deliverability_summary_30d` view. Returns `block_type: "stat_card"` or `"data_table"` for per-domain breakdown.

- **`get_customer_timeline`**: Per-customer activity history via `get_customer_purchase_timeline` and `get_customer_engagement_timeline` RPCs. Returns chronological event list with `block_type: "data_table"`.

- **`get_campaign_analytics`**: Already in M09 but enhanced here — adds comparison mode ("compare campaign A vs B"), period-over-period trends, best/worst performing campaigns.

- **`get_integration_status`**: Reads provider connection status, last sync time, sync errors, record counts from `provider_connections`, sync log tables. Follows `useIntegrationDetailData` patterns. Returns `block_type: "data_table"` for multi-provider status.

- **`get_customer_insights`**: Calls existing `generate-customer-insights` Edge Function for AI-generated analysis. Checks `customer_ai_insights` cache (24h). Returns `block_type: "data_card"` with insight text and recommended actions.

---

## Acceptance Criteria

- [ ] Dashboard summary returns real KPIs from the tenant's data
- [ ] Revenue analytics supports date ranges and channel breakdown
- [ ] Email health reads from existing RPCs and views
- [ ] Customer timeline shows chronological activity
- [ ] Integration status shows all connected providers with sync health
- [ ] Customer insights checks cache before calling AI Edge Function
- [ ] All analytics return appropriate `block_type` for frontend rendering
- [ ] All queries scoped by `tenant_id`

---

## What NOT To Do

- Do NOT compute analytics from raw event tables — use existing RPCs and views
- Do NOT call `generate-customer-insights` without checking the 24h cache first
- Do NOT generate test files or documentation
