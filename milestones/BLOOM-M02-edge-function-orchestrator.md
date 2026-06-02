# BLOOM-M02: Edge Function Orchestrator

> **Copilot Thinking Effort:** XHigh
> **Branch:** `feature/bloom-assist`
> **Phase:** 1 — Foundation
> **Milestone:** 2 of 40

---

## Objective

Create the `bloom-assist` Supabase Edge Function — the central orchestrator that receives user messages, assembles the 6-layer context window, calls OpenAI via raw `fetch()`, executes tools against CRM data, and streams responses back to the frontend via SSE. This is the backend brain of Bloom. It follows the exact same Edge Function patterns used by the existing 43 AI functions in this codebase.

---

## Scope

### Files to Create

**`supabase/functions/bloom-assist/index.ts`** — Main entry point

The function must:

1. **Handle CORS** using `_shared/cors.ts` (existing helper)
2. **Authenticate the user** from the `Authorization` header — create an inline user-scoped Supabase client following the existing pattern: `createClient(url, anonKey, { global: { headers: { Authorization: req.headers.get('Authorization')! } } })`
3. **Resolve tenant** — query `users.tenant_id` where `id = auth.uid()`. If no tenant, return 403.
4. **Parse the request body:**
   ```
   {
     conversation_id: string | null,     // null = new conversation
     message: string,                     // user's message text
     mode: "standard" | "reasoning" | "research" | "image",
     page_context: {                      // from useLocation().pathname
       pathname: string,
       entity_type: string | null,
       entity_id: string | null
     } | null,
     timezone: string,                    // from Intl.DateTimeFormat
     attachments: [] | null               // file references (future)
   }
   ```
5. **Assemble the 6-layer context** (Document 02):
   - Layer 1: Base system prompt (static — Bloom's identity, personality, guardrails)
   - Layer 2: Store/tenant profile (query `tenants` for name, industry context)
   - Layer 3: User context (name from `users.user_metadata.full_name`, role, page context, timezone, interaction count from `bloom_user_profiles`, workspace memory)
   - Layer 4: Tool definitions (filtered by mode — standard loads CRM tools, image loads image tool only, etc.)
   - Layer 5: Conversation history (last 8 messages from `bloom_messages` ordered by `created_at ASC`)
   - Layer 6: Current user message with mode metadata
6. **Call OpenAI** via raw `fetch("https://api.openai.com/v1/chat/completions", ...)` with `stream: true` — following the exact pattern in `supabase/functions/generate-content/openai-client.ts`
7. **Process the stream** in an agent loop:
   - Stream text tokens → SSE `event: token`
   - Detect tool calls → SSE `event: tool_start` → execute tool → SSE `event: tool_result` → feed result back to OpenAI for synthesis
   - Maximum 10 tool call iterations per request (hard cap)
   - On completion → SSE `event: done` with metadata
8. **Persist everything:**
   - Create or update `bloom_conversations` (new conversation if `conversation_id` is null)
   - Save user message to `bloom_messages`
   - Save assistant response to `bloom_messages` (with `block_data`, `follow_up_chips`, token counts)
   - Save each tool execution to `bloom_tool_executions`
   - Log to `bloom_audit_log`
   - Increment `bloom_user_profiles.interaction_count`
   - Auto-generate conversation title from first message (use gpt-4o-mini for a 4-6 word summary)
9. **Return SSE stream** with content type `text/event-stream`

**`supabase/functions/bloom-assist/context-builder.ts`** — Context assembly helper

Exports `buildContextLayers(tenantId, userId, conversationId, mode, pageContext, timezone)` that returns the assembled messages array for OpenAI.

**`supabase/functions/bloom-assist/stream-handler.ts`** — SSE stream processing

Exports `processOpenAIStream(response, toolExecutor)` that reads the OpenAI stream, detects tool calls, executes them, and yields SSE events.

**`supabase/functions/bloom-assist/types.ts`** — Shared TypeScript types

### SSE Event Format

```
event: token
data: {"text": "I found"}

event: tool_start
data: {"tool": "query_customers", "params": {"filters": [...]}}

event: tool_result
data: {"tool": "query_customers", "block_type": "data_table", "result": {...}}

event: thinking_token
data: {"text": "Step 1: Looking at..."}

event: error
data: {"message": "Rate limit exceeded", "code": "rate_limit"}

event: done
data: {"tokens_input": 1200, "tokens_output": 450, "model": "gpt-4o", "conversation_id": "uuid"}
```

### Environment Variables Used

- `OPENAI_API_KEY` (already available in Edge Functions)
- `SUPABASE_URL` (already available)
- `SUPABASE_SERVICE_ROLE_KEY` (for persisting data after auth)
- `SUPABASE_ANON_KEY` (for user-scoped client)

---

## Security Guarantees

- User authenticated via `Authorization` header — same pattern as existing Edge Functions
- `tenant_id` derived server-side from `users.tenant_id` — never from request body
- Tool definitions never expose `tenant_id`, `user_id`, or `auth_token` parameters
- User input wrapped in delimiters for prompt injection defense (Layer 1 of 4-layer defense)
- Maximum 10 tool iterations prevents infinite agent loops
- All data persisted with tenant_id from server-derived context, not client input

---

## Acceptance Criteria

- [ ] Edge Function deploys and responds to POST requests at `/functions/v1/bloom-assist`
- [ ] CORS handled via existing `_shared/cors.ts` helper
- [ ] User authentication works via Authorization header
- [ ] Tenant resolution works via `users.tenant_id` lookup
- [ ] 6-layer context assembles correctly with real tenant/user data
- [ ] OpenAI called via raw `fetch()` with `stream: true` — NOT the OpenAI SDK
- [ ] SSE stream returns all event types: `token`, `tool_start`, `tool_result`, `thinking_token`, `error`, `done`
- [ ] Agent loop executes tools and feeds results back to OpenAI for synthesis
- [ ] Maximum 10 tool iterations enforced
- [ ] Conversations created/updated in `bloom_conversations`
- [ ] Messages persisted in `bloom_messages` with token counts
- [ ] Tool executions logged in `bloom_tool_executions`
- [ ] Audit events logged in `bloom_audit_log`
- [ ] `bloom_user_profiles.interaction_count` incremented
- [ ] Conversation title auto-generated from first message
- [ ] Unauthenticated requests return 401
- [ ] Missing tenant returns 403

---

## What NOT To Do

- Do NOT use the OpenAI SDK (`import OpenAI from 'openai'`) — use raw `fetch()` matching the 43 existing AI Edge Functions
- Do NOT use `createClientFromRequest` — that helper does not exist in this codebase. Create the client inline.
- Do NOT use `site_id` or any GUC/`set_config` pattern — use explicit `tenant_id` everywhere
- Do NOT import from `next/server` or any Next.js module — this is a Deno Edge Function
- Do NOT add `router.refresh()` or `window.location.reload()` — this is backend code
- Do NOT create frontend components in this milestone — frontend comes in BLOOM-M05
- Do NOT implement all tools — just create the tool execution framework. Actual tools come in BLOOM-M04+
- Do NOT generate test files or documentation
