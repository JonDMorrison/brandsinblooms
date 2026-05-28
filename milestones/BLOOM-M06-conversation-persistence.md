# BLOOM-M06: Conversation Persistence & Management

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 1 — Foundation
> **Milestone:** 6 of 40

---

## Objective

Wire the frontend `BloomContext` to real Supabase data. Conversations and messages persist across sessions. Users can create, switch, rename, pin, archive, and delete conversations. Message history loads on conversation switch. Auto-generated titles. Optimistic UI throughout. All data fetching via React Query (`@tanstack/react-query`) matching CRM patterns.

---

## Scope

### React Query Hooks in `src/hooks/bloom/`

**`useBloomConversations.ts`** — Fetches conversation list for current user + tenant. Query key: `["bloom-conversations", tenantId]`. Ordered by `updated_at DESC` with pinned first. Uses `useTenant()` for tenant resolution.

**`useBloomMessages.ts`** — Fetches messages for active conversation. Query key: `["bloom-messages", conversationId]`. Ordered by `created_at ASC`. Loads last 20 messages initially. Supports scroll-up pagination for older messages (infinite scroll pattern).

**`useBloomConversationMutations.ts`** — Exports mutations:
- `createConversation()` → inserts into `bloom_conversations`, returns new ID, navigates to `/bloom/:newId`
- `renameConversation(id, title)` → updates title, invalidates conversation list
- `pinConversation(id)` → sets status to `pinned` (max 5 pins enforced client-side)
- `archiveConversation(id)` → sets status to `archived`, navigates away if was active
- `deleteConversation(id)` → sets status to `deleted`, shows `JoyAlertDialog` confirmation first, navigates away
- All mutations use optimistic updates — update React Query cache immediately, rollback on error

**`useBloomMessageMutations.ts`** — Exports mutations:
- `sendMessage(conversationId, text, mode)` → calls `bloom-assist` Edge Function via `supabase.functions.invoke("bloom-assist", { body: {...} })`. Saves user message optimistically. Appends assistant response on completion.
- `toggleBookmark(messageId)` → toggles `is_bookmarked` on `bloom_messages`
- `regenerateResponse(messageId)` → re-sends the preceding user message

### Frontend Wiring

Update `BloomContext.tsx` to use these hooks instead of mock data. Wire:
- Sidebar conversation list → `useBloomConversations`
- Message area → `useBloomMessages` for active conversation
- Input area send → `useBloomMessageMutations.sendMessage`
- Sidebar actions (rename, pin, archive, delete) → `useBloomConversationMutations`
- New Chat button → `createConversation`
- Conversation click → `switchConversation` (navigate to `/bloom/:chatId`)

### Conversation Title Auto-Generation

When the first message is sent in a new conversation, the Edge Function (BLOOM-M02) generates a 4-6 word title using gpt-4o-mini. The title is saved to `bloom_conversations.title` and the frontend receives it in the `done` SSE event. React Query cache is updated with the new title.

### Sidebar Search

`BloomSidebar` search input filters conversations by title (client-side for <100 conversations, server-side `ilike` for more). Debounced 300ms using `JoySearchInput` with the `JoyDebouncedInput` pattern.

---

## Acceptance Criteria

- [ ] Conversations persist in Supabase and reload on page refresh
- [ ] Messages persist and load correctly when switching conversations
- [ ] New Chat creates a conversation, navigates to it, shows home state until first message
- [ ] Conversation title auto-generates after first message
- [ ] Rename works inline in sidebar (click title → edit → blur/Enter saves)
- [ ] Pin moves conversation to Pinned section (max 5)
- [ ] Archive removes from main list, accessible via "Show Archived" toggle
- [ ] Delete shows `JoyAlertDialog` confirmation → soft deletes
- [ ] Optimistic updates: actions feel instant, rollback on error with Sonner error toast
- [ ] Scroll-up pagination loads older messages (infinite scroll)
- [ ] Search filters conversations by title with 300ms debounce
- [ ] React Query cache invalidation is correct — no stale data after mutations
- [ ] `useTenant()` used for tenant resolution — NOT `site_id`
- [ ] All UI uses Joy UI components exclusively

---

## What NOT To Do

- Do NOT use `site_id` — use `tenant_id` via `useTenant()`
- Do NOT implement Supabase Realtime subscriptions yet — that's a future optimization
- Do NOT hard-delete conversations — soft delete with `status = 'deleted'`
- Do NOT save messages on every token during streaming — save on `done` event only
- Do NOT use `window.location.reload()` after mutations — update React Query cache
- Do NOT generate test files or documentation
