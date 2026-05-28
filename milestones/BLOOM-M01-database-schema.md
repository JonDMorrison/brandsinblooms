# BLOOM-M01: Database Schema Foundation

> **Copilot Thinking Effort:** XHigh
> **Branch:** `feature/bloom-assist`
> **Phase:** 1 — Foundation
> **Milestone:** 1 of 40

---

## Objective

Create all Supabase database tables required for the Bloom Assist AI agent. This includes conversation storage, message persistence, tool execution audit trail, user profiles with workspace memory, proactive insights, and immutable audit logging. Every table must be tenant-scoped via `tenant_id`, use RLS policies that follow the CRM's existing tenant-first security model, and be append-only where specified.

---

## Scope

### Tables to Create

**1. `bloom_conversations`**
- `id` uuid PK default `gen_random_uuid()`
- `tenant_id` uuid NOT NULL FK → `tenants.id`
- `user_id` uuid NOT NULL FK → `auth.users.id`
- `title` text — auto-generated from first message, user-renamable
- `status` text NOT NULL default `'active'` — enum: `active`, `pinned`, `archived`, `deleted`
- `mode` text NOT NULL default `'standard'` — enum: `standard`, `reasoning`, `research`, `image`
- `message_count` integer NOT NULL default 0
- `last_message_preview` text — truncated preview of last message (~80 chars)
- `metadata` jsonb default `'{}'::jsonb` — extensible metadata (compaction state, branch info)
- `created_at` timestamptz NOT NULL default `now()`
- `updated_at` timestamptz NOT NULL default `now()`
- Index on `(tenant_id, user_id, status, updated_at DESC)` for sidebar listing
- Index on `(tenant_id, user_id, updated_at DESC)` for recent conversations

**2. `bloom_messages`**
- `id` uuid PK default `gen_random_uuid()`
- `conversation_id` uuid NOT NULL FK → `bloom_conversations.id` ON DELETE CASCADE
- `tenant_id` uuid NOT NULL FK → `tenants.id`
- `role` text NOT NULL — enum: `user`, `assistant`, `system`
- `content` text — the message text (Markdown for assistant messages)
- `thinking_content` text — reasoning mode thinking trace (null for non-reasoning)
- `block_data` jsonb — structured response block data (data cards, tables, charts, task plans)
- `mode` text — mode used for this message: `standard`, `reasoning`, `research`, `image`
- `model` text — model used: `gpt-4o`, `gpt-4o-mini`, `gpt-4.1-2025-04-14`
- `tokens_input` integer — input token count
- `tokens_output` integer — output token count
- `attachments` jsonb — uploaded file references: `[{ name, type, size, storage_path }]`
- `follow_up_chips` jsonb — LLM-generated follow-up suggestions: `["Show as chart", "Export CSV"]`
- `is_bookmarked` boolean NOT NULL default false
- `is_compacted` boolean NOT NULL default false — true if this message has been replaced by a compaction summary
- `metadata` jsonb default `'{}'::jsonb`
- `created_at` timestamptz NOT NULL default `now()`
- Index on `(conversation_id, created_at ASC)` for message history loading
- Index on `(tenant_id, user_id, is_bookmarked)` WHERE `is_bookmarked = true` for bookmark listing

**3. `bloom_tool_executions`**
- `id` uuid PK default `gen_random_uuid()`
- `message_id` uuid NOT NULL FK → `bloom_messages.id` ON DELETE CASCADE
- `conversation_id` uuid NOT NULL FK → `bloom_conversations.id` ON DELETE CASCADE
- `tenant_id` uuid NOT NULL FK → `tenants.id`
- `tool_name` text NOT NULL — e.g. `query_customers`, `create_campaign`, `navigate_to`
- `tool_input` jsonb NOT NULL — the parameters passed to the tool
- `tool_output` jsonb — the result returned by the tool
- `status` text NOT NULL default `'pending'` — enum: `pending`, `executing`, `completed`, `failed`
- `error_message` text — error details if status = `failed`
- `execution_time_ms` integer — how long the tool took to execute
- `created_at` timestamptz NOT NULL default `now()`
- **This table is append-only: RLS allows INSERT and SELECT only. No UPDATE, no DELETE policies.**
- Index on `(conversation_id, created_at ASC)` for tool history
- Index on `(tenant_id, tool_name, created_at DESC)` for analytics

**4. `bloom_user_profiles`**
- `id` uuid PK default `gen_random_uuid()`
- `tenant_id` uuid NOT NULL FK → `tenants.id`
- `user_id` uuid NOT NULL FK → `auth.users.id`
- `interaction_count` integer NOT NULL default 0 — total messages sent across all conversations
- `onboarding_stage` integer NOT NULL default 0 — progressive disclosure level (0–3)
- `seen_tips` text[] NOT NULL default `'{}'::text[]` — list of tip IDs already shown
- `workspace_memory` jsonb NOT NULL default `'{}'::jsonb` — recent entities, preferences, pinned items
- `preferences` jsonb NOT NULL default `'{}'::jsonb` — response density, default mode, custom instructions
- `created_at` timestamptz NOT NULL default `now()`
- `updated_at` timestamptz NOT NULL default `now()`
- UNIQUE constraint on `(tenant_id, user_id)` — one profile per user per tenant

**5. `bloom_audit_log`**
- `id` uuid PK default `gen_random_uuid()`
- `tenant_id` uuid NOT NULL FK → `tenants.id`
- `user_id` uuid NOT NULL FK → `auth.users.id`
- `conversation_id` uuid — nullable (some events are conversation-independent)
- `message_id` uuid — nullable
- `event_type` text NOT NULL — enum: `prompt`, `tool_call`, `tool_result`, `response`, `approval`, `execution`, `error`
- `event_data` jsonb NOT NULL — full event payload
- `model_used` text
- `tokens_input` integer
- `tokens_output` integer
- `latency_ms` integer
- `created_at` timestamptz NOT NULL default `now()`
- **This table is append-only: RLS allows INSERT and SELECT only for authenticated tenant members. No UPDATE, no DELETE policies.**
- Index on `(tenant_id, created_at DESC)` for admin audit log viewer
- Index on `(tenant_id, event_type, created_at DESC)` for filtered audit views

**6. `bloom_proactive_insights`**
- `id` uuid PK default `gen_random_uuid()`
- `tenant_id` uuid NOT NULL FK → `tenants.id`
- `insight_type` text NOT NULL — e.g. `low_stock`, `dormant_customers`, `campaign_performance`, `revenue_anomaly`
- `title` text NOT NULL
- `description` text NOT NULL
- `action_prompt` text — pre-filled Bloom prompt when user clicks the insight
- `entity_type` text — `customer`, `product`, `campaign`, `segment` (nullable)
- `entity_id` uuid — the related entity ID (nullable)
- `severity` text NOT NULL default `'info'` — enum: `info`, `warning`, `critical`
- `dismissed_by` uuid[] NOT NULL default `'{}'::uuid[]` — user IDs who dismissed this insight
- `expires_at` timestamptz — auto-expire stale insights
- `created_at` timestamptz NOT NULL default `now()`
- Index on `(tenant_id, created_at DESC)` WHERE `expires_at IS NULL OR expires_at > now()`

### RLS Policies

Every table gets tenant-scoped RLS following the CRM's existing pattern:

**For bloom_conversations, bloom_messages, bloom_user_profiles:**
- SELECT: `auth.uid() = user_id AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())`
- INSERT: `auth.uid() = user_id AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())`
- UPDATE: `auth.uid() = user_id AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())`
- DELETE: `auth.uid() = user_id AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())`

**For bloom_tool_executions, bloom_audit_log (append-only):**
- SELECT: same as above
- INSERT: same as above
- UPDATE: **NO POLICY** — no updates allowed
- DELETE: **NO POLICY** — no deletes allowed

**For bloom_proactive_insights:**
- SELECT: `tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())`
- INSERT: service-role only (generated by scheduled Edge Function)
- UPDATE: `tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())` — only for `dismissed_by` array append
- DELETE: service-role only

### Migration File

Create a single migration file: `supabase/migrations/YYYYMMDDHHMMSS_bloom_assist_schema.sql`

### Trigger

Create an `updated_at` trigger for `bloom_conversations` and `bloom_user_profiles` — auto-update `updated_at` on every UPDATE.

---

## Security Guarantees

- `tenant_id` is NEVER client-supplied — always derived from `auth.uid()` → `users.tenant_id`
- Append-only tables (`bloom_tool_executions`, `bloom_audit_log`) cannot be modified or deleted by any user
- Cross-tenant reads are impossible — every RLS policy joins on the user's tenant
- `bloom_proactive_insights` can only be created by service-role (scheduled jobs), never by end users

---

## Acceptance Criteria

- [ ] All 6 tables created with correct column types, constraints, and defaults
- [ ] All indexes created for the query patterns specified above
- [ ] RLS enabled on every table
- [ ] RLS policies enforce tenant isolation via `users.tenant_id` lookup
- [ ] Append-only tables have NO update/delete policies
- [ ] `bloom_user_profiles` has a UNIQUE constraint on `(tenant_id, user_id)`
- [ ] `updated_at` triggers fire correctly on `bloom_conversations` and `bloom_user_profiles`
- [ ] Migration file runs cleanly with `supabase db push` or `supabase migration up`
- [ ] No references to `site_id` anywhere — this codebase uses `tenant_id`

---

## What NOT To Do

- Do NOT use `site_id` — this CRM uses `tenant_id` exclusively
- Do NOT create any RPC functions in this milestone — schema only
- Do NOT create any Edge Functions — those come in BLOOM-M02
- Do NOT add `ON DELETE CASCADE` from `bloom_conversations` to `tenants` — conversations should survive tenant deactivation
- Do NOT make `bloom_audit_log` or `bloom_tool_executions` updatable or deletable
- Do NOT create views — those come later if needed
- Do NOT generate test files or documentation unless explicitly requested
