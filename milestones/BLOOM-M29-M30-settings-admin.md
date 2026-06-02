# BLOOM-M29: User Preferences & Custom Instructions

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 6 — Settings & Admin
> **Milestone:** 29 of 40

---

## Objective

Build the Bloom settings interface where users can configure their AI experience: response density preference, default mode, custom instructions ("About me" and "How should Bloom respond"), and manage their knowledge base. Stored in `bloom_user_profiles.preferences` JSONB.

---

## Scope

### Settings Route

Add `/bloom/settings` route in `App.tsx` (or render as a `JoyDrawer` from the Bloom sidebar settings icon).

### Settings UI: `src/components/bloom/BloomSettings.tsx`

A `PageContainer` with `JoyCard` sections:

**Section 1: Response Style**
- Response density: `JoySelect` with options "Concise", "Balanced", "Detailed" — stored as `preferences.density`
- Default mode: `JoySelect` with "Standard", "Reasoning", "Research" — stored as `preferences.default_mode`

**Section 2: Custom Instructions**
- "About me and my business": `JoyTextarea` — user describes their role, store type, typical tasks. ~500 char limit. Stored as `preferences.about_me`.
- "How should Bloom respond": `JoyTextarea` — user specifies tone, format, language preferences. ~500 char limit. Stored as `preferences.response_style`.
- These are injected into Layer 3 (User Context) of the system prompt.

**Section 3: Model Preference**
- Default model tier: `JoySelect` — "Auto (recommended)", "Standard (faster)", "Pro (smarter)"
- Stored as `preferences.default_model`

**Section 4: Data & Privacy**
- "Clear all conversations" — `JoyButton` variant="outlined" color="danger" → `JoyAlertDialog` with typed confirmation
- "Export conversation data" — placeholder (disabled with "Coming soon" tooltip)
- "Delete Bloom profile" — `JoyButton` variant="outlined" color="danger" → removes `bloom_user_profiles` row

All settings auto-save on change (no explicit Save button) via `useBloomMessageMutations` or a new `useBloomProfileMutations` hook. Sonner success toast on save.

---

## Acceptance Criteria

- [ ] Settings page/drawer renders with all 4 sections
- [ ] All preferences saved to `bloom_user_profiles.preferences` JSONB
- [ ] Custom instructions injected into system prompt Layer 3
- [ ] Response density affects LLM prompt instructions
- [ ] "Clear all conversations" requires typed confirmation and works
- [ ] Auto-save with success toast
- [ ] All UI uses Joy UI components exclusively

---

## What NOT To Do

- Do NOT require an explicit Save button — auto-save on change
- Do NOT store custom instructions in localStorage — persist to Supabase
- Do NOT generate test files or documentation

---
---
---

# BLOOM-M30: Admin Usage Dashboard & Audit Log Viewer

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 6 — Settings & Admin
> **Milestone:** 30 of 40

---

## Objective

Build an admin-only dashboard showing Bloom usage metrics, cost tracking, and audit log viewer. Admins need visibility into how their team uses Bloom, how much it costs, and what operations were performed.

---

## Scope

### Route

Add `/bloom/admin` route — visible only to admins (check `useIsSuperAdmin()` or admin role from `AuthContext`).

### Admin Dashboard: `src/components/bloom/BloomAdminDashboard.tsx`

**Section 1: Usage Overview (stat cards)**
- Total conversations this month
- Total messages this month
- Total tokens consumed (input + output)
- Estimated cost ($) based on token counts × model pricing
- Active users count
- Rendered as a `CatalogStatsStrip` (existing component) or `StatCardBlock` grid

**Section 2: Usage Chart**
- Daily message volume over last 30 days — `recharts` `BarChart`
- Token consumption by model tier — `recharts` `PieChart`
- Top 10 most-used tools — `JoyTable` with tool name, call count, avg execution time

**Section 3: Audit Log Viewer**
- `JoyTable` reading from `bloom_audit_log`
- Columns: timestamp, user name, event type, tool name, model, tokens, latency
- Filterable by: event type (`JoySelect`), user (`JoySelect`), date range
- Sortable by timestamp
- Paginated with `JoyTablePagination`
- Row click expands to show full `event_data` JSON (using a `JoyDrawer` or expandable row)
- Search by tool name or user

**Section 4: Rate Limit Configuration (future)**
- Placeholder section showing current limits
- "Custom limits coming soon" — disabled controls

### Data Queries

All queries scope by `tenant_id`. Use React Query with appropriate cache times:
- Usage stats: aggregate queries on `bloom_audit_log` grouped by date, event_type, model
- User activity: count distinct user_ids from `bloom_audit_log`
- Cost estimation: `tokens_input × input_price + tokens_output × output_price` per model

---

## Acceptance Criteria

- [ ] Admin dashboard only visible to admin users
- [ ] Usage stats show real metrics from `bloom_audit_log`
- [ ] Charts render daily volume and model distribution
- [ ] Audit log table shows all events with filtering, sorting, pagination
- [ ] Row expansion shows full event data
- [ ] Cost estimation calculated from token counts
- [ ] All UI uses Joy UI — `JoyTable`, `JoyCard`, `JoySelect`, `JoyChip`, `JoyButton`
- [ ] Data scoped by `tenant_id`

---

## What NOT To Do

- Do NOT expose audit log to non-admin users
- Do NOT show raw token costs to non-admin users
- Do NOT delete or modify audit log entries
- Do NOT generate test files or documentation
