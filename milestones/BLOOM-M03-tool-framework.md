# BLOOM-M03: Tool Framework & Registry

> **Copilot Thinking Effort:** XHigh
> **Branch:** `feature/bloom-assist`
> **Phase:** 1 — Foundation
> **Milestone:** 3 of 40

---

## Objective

Build the tool registry, validation layer, and execution pipeline that sits between the LLM and the CRM data layer. Every CRM operation Bloom can perform is defined as a tool with a precise JSON schema. The LLM selects tools and constructs parameters; this framework validates inputs, enforces security, executes tools, and returns structured results.

---

## Scope

### Files to Create

**`supabase/functions/bloom-assist/tools/registry.ts`**

Exports the complete tool registry — an array of tool definitions following OpenAI's function calling format. Each tool definition includes:
- `name` — unique identifier (e.g. `query_customers`)
- `description` — rich description with natural language aliases for LLM selection. Include WHEN to use this tool vs. similar tools.
- `parameters` — JSON Schema with enums for every enumerable field. No free-text where enums are possible.
- `category` — `query`, `mutation`, `analytics`, `content`, `navigation`, `utility`
- `risk_level` — `safe` (reads), `low` (creates), `medium` (updates), `high` (deletes, sends, bulk ops)
- `requires_confirmation` — boolean, true for `medium` and `high` risk
- `allowed_roles` — which user roles can use this tool: `admin`, `staff`, `viewer`
- `allowed_modes` — which Bloom modes expose this tool: `standard`, `reasoning`, `research`, `image`

Register all tools from Documents 03 and 07:
- **Query tools:** `query_customers`, `query_products`, `query_campaigns`, `query_segments`, `query_orders`, `get_customer_detail`, `get_product_detail`, `get_segment_members`
- **Mutation tools:** `create_customer`, `update_customer`, `delete_customer`, `create_product`, `update_product`, `toggle_product_status`, `create_campaign`, `update_campaign`, `clone_campaign`, `schedule_campaign`, `send_campaign`, `pause_resume_campaign`, `create_segment`, `update_segment`, `assign_segment`, `bulk_tag_customers`, `manage_consent`
- **Analytics tools:** `get_dashboard_summary`, `get_revenue_analytics`, `get_email_health`, `get_customer_timeline`, `get_campaign_analytics`, `get_integration_status`, `get_customer_insights`
- **Content tools:** `generate_content`, `generate_image`
- **Navigation tools:** `navigate_to`
- **Utility tools:** `export_data`, `compute_audience_size`

**`supabase/functions/bloom-assist/tools/executor.ts`**

Exports `executeTool(toolName, params, context)` that:
1. Looks up the tool definition from the registry
2. Validates input parameters against the JSON schema
3. Checks user role against `allowed_roles`
4. For mutation tools with `requires_confirmation = true`, returns a `confirmation_required` response instead of executing
5. Executes the tool function against Supabase using the service-role client with explicit `.eq("tenant_id", tenantId)`
6. Returns the consistent result wrapper:
   ```
   { success, data, count, message, error, block_type, confirmation_required, confirmation_details }
   ```
7. Logs execution to `bloom_tool_executions`

**`supabase/functions/bloom-assist/tools/filter-engine.ts`**

The composable filter system from Document 03. Exports `applyFilters(query, filters)` that takes a Supabase query builder and an array of filter objects and applies them:
- Operators: `equals`, `not_equals`, `contains`, `not_contains`, `starts_with`, `ends_with`, `gt`, `lt`, `gte`, `lte`, `between`, `in`, `not_in`, `is_null`, `is_not_null`
- Special handling for junction table filters (`has`, `has_not`, `has_count`) — e.g. "customers who have tag X"
- Date resolution — "last 7 days", "this month", "yesterday" resolved to actual timestamps

**`supabase/functions/bloom-assist/tools/intent-classifier.ts`**

Exports `classifyIntent(message)` that calls gpt-4o-mini to classify the user's message into an intent category (`query`, `mutation`, `analytics`, `content`, `navigation`, `general`). Returns the category string. Used by the orchestrator to filter which tools are sent to the main LLM call (token optimization from Document 07 Section 7.2).

**`supabase/functions/bloom-assist/tools/types.ts`**

Shared TypeScript types for tool definitions, filter objects, execution results, and context.

---

## Security Guarantees

- `tenant_id` and `user_id` NEVER appear in tool parameter schemas — injected server-side by the executor
- Role-based tool filtering happens server-side before tools are sent to the LLM
- Mutation tools with `risk_level >= medium` always return `confirmation_required` first — never execute directly
- Filter values are parameterized via Supabase query builder — no raw SQL injection possible
- Intent classifier uses gpt-4o-mini with a minimal system prompt — no CRM data exposed

---

## Acceptance Criteria

- [ ] Tool registry contains all tools listed above with correct schemas, descriptions, and metadata
- [ ] Every enumerable field uses an enum — no free-text where specific values exist
- [ ] Tool executor validates inputs against JSON schema before execution
- [ ] Tool executor checks user role and rejects unauthorized tool calls with clear error
- [ ] Mutation tools with `requires_confirmation` return confirmation response, not execution
- [ ] Filter engine supports all 15 operators correctly
- [ ] Filter engine handles junction table filters (segment membership, tag assignment, persona)
- [ ] Filter engine resolves relative dates ("last 7 days", "this month") correctly
- [ ] Intent classifier returns one of 6 categories in <200ms
- [ ] All tool executions logged to `bloom_tool_executions` with timing data
- [ ] Every tool returns the consistent `{ success, data, count, message, error, block_type }` wrapper
- [ ] No `site_id` references — `tenant_id` everywhere

---

## What NOT To Do

- Do NOT implement the actual tool logic (querying customers, creating campaigns) — that comes in BLOOM-M04, M09-M14. This milestone creates the FRAMEWORK only.
- Do NOT expose `tenant_id`, `user_id`, or `auth_token` in any tool parameter schema
- Do NOT use raw SQL — use Supabase query builder with parameterized values
- Do NOT skip the intent classification step — it saves ~2,000-4,000 tokens per request
- Do NOT hardcode tool definitions inline — use the registry pattern for extensibility
- Do NOT generate test files or documentation
