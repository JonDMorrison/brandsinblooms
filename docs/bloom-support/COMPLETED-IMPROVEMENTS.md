# Bloom Support — Completed Improvements

Deliverable F of the World-Class Support initiative.
PR #537 (`feat/bloom-support-morning-slack-digest`) merged to `main` as `18a0d301f`.
CI verified: `bloom-support` ✓ `verify` ✓ `bloom-build-preflight` ✓ `newsletter` ✓ `Vercel` ✓

---

## Commits in this release

| Commit | Summary |
|--------|---------|
| `a71e620eb` | World-class platform improvements — §3–6, Prompt 2 |
| `45b0df399` | Slack action tool calling for ticket threads (Prompt 3) |
| `a5548180a` | CI lockfile + Deno version pin; Gmail draft queue in worker |
| `ee31ffd1b` | Owner column and quick-action menu in ticket queue (QW-4, QW-8) |
| `c71472f6c` | Pre-breach alerting watchdog (QW-3) |
| `2340adf41` | E2E test alignment with new voice copy |
| `1614e6d25` | Roles-not-names fix in voice.ts |

---

## 1. Voice and customer communication

**File:** `supabase/functions/_shared/bloom-support/voice.ts`
**Tests:** `voice_test.ts` (7 `wantsHumanContact` test cases) · `bloomSupportAdminWording.test.tsx` (names/roles check)

### Changes

| Function | Before | After |
|----------|--------|-------|
| `bloomAcknowledgement()` | Formal, impersonal | "Your request is with me now. I'll work through it and let you know what I find — or pass it to a person on our support team if that's what it needs." |
| `bloomClarification()` | Generic opener | "To move this forward, I need a few quick details:" + bulleted questions + "Reply here and I'll pick it up from there." |
| `bloomHandoff()` | Minimal handoff | Confirms full context transfer: "They'll have everything you've shared here — the full conversation and all the details — so there's no need to start over." |
| `bloomResolution()` | Standard close | "If anything still isn't right, reply to this email and I'll reopen the request right away." |
| `bloomReopened()` | (new) | "Everything from before is still here; you don't need to repeat yourself." |
| `bloomFeatureReceived()` | Referenced personal names | "Our team reviews these and decides what gets built" |
| `bloomInvestigationStarted()` | Referenced personal names | "Our support team will see this" / "a member of our team needs to review and approve the fix" |
| `bloomEngineeringProgress()` | 6 statuses referenced personal names | All replaced with "our team" / "our support team" |
| `bloomFeatureDecision()` | Referenced personal names in 4 paths | All replaced with "Our team has reviewed…" / "Our team has decided…" |

**New functions:**
- `wantsHumanContact(text)` — detects explicit human-contact requests ("I want a real person," "stop the bot," "get me a human," etc.) with 7 test cases and conservative false-positive handling
- `bloomHumanRequested()` — context-transfer confirmation sent when the above triggers

**Enforcement:** `bloomSupportAdminWording.test.tsx` scans all bloom-support source files for personal names (`/\bJon\b|\bJeff\b/`) in user-visible strings. 11 occurrences removed. Test now passes.

---

## 2. Human escalation detection

**File:** `supabase/functions/bloom-support-worker/index.ts` (triage job)

The `answer` job now checks `wantsHumanContact()` on the latest client message before invoking the AI model. If matched, it triggers `ticket.needs_owner` immediately with a `bloomHumanRequested()` reply — no AI classification step runs. A client asking for a human gets a human, not another AI response.

---

## 3. Slack ticket notification improvements

**File:** `supabase/functions/_shared/bloom-support/ticket-slack.ts`

- New `ticketAge()` — returns human-readable age string from `created_at` (e.g. "3 days old")
- `ticketRootMessage()` now includes ticket age for all non-new events
- `TicketFacts` interface extended with `created_at`

---

## 4. Overnight maintenance job

**File:** `supabase/functions/bloom-support-worker/index.ts`

New `maintain()` handler registered in `HANDLERS`:
- Scans stale tickets (5+ days without update) and adds an internal note
- Scans unresponded tickets (48h+ without first response) and adds an internal note
- Posts a summary to the `#alerts` Slack channel
- Dispatch key: `"maintain"` (triggered by pg_cron or manual invocation)

---

## 5. Gmail draft queue

**File:** `supabase/functions/_shared/bloom-support/gmail-drafts.ts` (new, 184 lines)

| Export | Purpose |
|--------|---------|
| `createGmailDraft(opts)` | Creates a Gmail draft via OAuth2 refresh token. Returns `{status: "created", draftId}`, `{status: "failed", reason}`, or `{status: "not_configured"}` |
| `gmailDraftQueueAvailable()` | Returns `true` only when `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN` are all set in environment |
| `shouldQueueAsDraft(opts)` | Returns `true` for tickets with `needs_owner` status, a non-null `next_action`, or a non-null `executor` |

**Integration in worker `sendEmail()`:**
Before calling `sendSupportEmail`, the worker checks `gmailDraftQueueAvailable() && shouldQueueAsDraft(...)`. If true:
- Creates a Gmail draft with correct `In-Reply-To` / `References` headers for thread continuity
- Posts an internal note to the ticket: "A draft reply was prepared and held for staff review (Gmail draft `draftId`). Review and send from Gmail, then mark this ticket resolved."
- Returns early with `"email held as Gmail draft"` — no auto-send occurs
- If draft creation fails, adds a failure note and falls through to direct send
- If not configured, falls through to direct send silently

**Idempotency:** `idempotencyKey: "job:<id>"` prevents double-drafts on job retry.

---

## 6. Slack action tool calling

**File:** `supabase/functions/_shared/bloom-support/slack-actions.ts` (new, 143 lines)

| Export | Purpose |
|--------|---------|
| `detectSlackAction(text)` | Returns `{type, params}` for recognized commands: `claim`, `hold`, `resume`, `waiting`. Returns `null` for unrecognized text. |
| `executeSlackAction(action, context, rpc)` | Dispatches action via RPC. Returns `{success, message}`. |
| `slackActionsAllowed(route, role)` | Returns `true` only on ticket-thread routes with `platform_admin`, `platform_operator`, or `support` roles. |

**Recognized commands (examples):**
- Claim: "I'll handle this," "claim this," "taking this"
- Hold: "pause Bloom," "hold off," "put this on hold"
- Resume: "resume Bloom," "continue," "unpause"
- Waiting: "marking as waiting," "waiting on client," "waiting for customer"

**Integration in `slack-conversation.ts`:**
Action dispatch runs before the AI answer flow. If a recognized action is detected, it executes and returns its confirmation message. The AI model is never called for action requests. Failed actions return a safe "I couldn't complete that action right now. Nothing was changed" message.

**Boundary:** Resolving tickets, approving operations, sending customer messages, and assigning tickets still require the dashboard. Slack actions are limited to safe, reversible status transitions.

---

## 7. Queue UI — owner visibility and quick actions

**File:** `src/components/bloomSupport/QueueList.tsx`

**Owner column (QW-4):**
Every row in the ticket queue now shows the assigned staff member's name. Displays `t.owner.name ?? "Staff"` or "Unassigned" if no owner, between the status pills and the "Next:" line. Data was already present in `TicketSummary`; this is a pure UI addition.

**Inline quick-action menu (QW-8):**
A `⋯` icon button appears on hover on every queue row (hidden at rest, opacity-0 with 120ms transition). Clicking it opens a Joy `Dropdown/Menu` with context-aware items:

| Action | Available when |
|--------|----------------|
| Assign to me | No current owner |
| Reassign to me | Ticket has an owner |
| Mark working | Status is not `working` |
| Mark waiting… | Status is not `waiting` |
| Resolve… | Status is not `resolved` |

"Mark waiting" opens a confirm dialog prompting for a waiting reason (customer / vendor / internal / other). "Resolve" opens a confirm dialog prompting for a resolution summary (sent to the client). Both use the existing `ask()` dialog primitive.

A `useMutation` calls `bloomSupport.updateTicket(id, patch)`. On success, `qc.invalidateQueries({ queryKey: ["bloom-support"] })` refreshes the queue. Success and error states appear via a `notice` snackbar.

---

## 8. Pre-breach alerting watchdog

**File:** `supabase/migrations/20261116231018_bloom_support_pre_breach_alerting.sql` (248 lines)

Replaces `bloom_support.watchdog()` with an extended version that adds 7 checks alongside the existing breach and dead-jobs checks:

| Check | Condition | Dedupe |
|-------|-----------|--------|
| `approaching_deadline` | Ticket ≥ 80% through first-response window, not yet breached, no first reply | Hourly |
| `bloom_tool_failures` | One tool failing ≥ 50% of ≥ 5 calls for one tenant in last hour | Hourly |
| `bloom_tool_timeouts` | One tool timing out ≥ 3 times for one tenant in last hour | Hourly |
| `bloom_request_errors` | ≥ 5 Bloom error events for one tenant in last hour | Hourly |
| `bloom_negative_feedback` | ≥ 3 thumbs-down answers in last 24 hours | Daily |
| `duplicate_system_segments` | A tenant has >1 live built-in group with the same name | Daily |
| `orphan_segment_memberships` | Memberships pointing at deleted or merged customers | Daily |

Each check is wrapped in `EXCEPTION WHEN OTHERS` so a failure in one check cannot suppress findings from others. All findings emit in-app staff notifications; email via Resend fires when `bloom_support_alert_resend_key` is set in Vault.

---

## 9. Deliverable documents (A–E)

**Directory:** `docs/bloom-support/`

| File | Contents |
|------|----------|
| `STATE-OF-SYSTEM.md` | Evidence-backed inventory of every capability — 195 lines |
| `COMPETITIVE-RESEARCH.md` | Intercom Fin, Zendesk, Front, Help Scout, Gorgias comparison with recommendations — 156 lines |
| `LANGUAGE-AUDIT.md` | Full audit of every customer-facing string with improved alternatives — 351 lines |
| `GAP-ANALYSIS.md` | 17 gaps ranked by severity and business impact — 251 lines |
| `IMPLEMENTATION-ROADMAP.md` | QW/HV/LH roadmap with complexity and blocking notes — 217 lines |

---

## 10. CI and infrastructure

| Change | File | Reason |
|--------|------|--------|
| Deno version pinned to `v2.9.8` | `.github/workflows/bloom-support.yml` | Floating `v2.x` caused lockfile divergence on runner updates |
| Deno lockfile updated | `supabase/functions/deno.lock` | `postcss` resolved to 8.5.33; `sanitize-html` 2.18.1 added |

---

## Test verification

| Test suite | Result |
|------------|--------|
| `voice_test.ts` — `wantsHumanContact` (7 cases) | ✓ pass |
| `bloomSupportAdminWording.test.tsx` — roles not names | ✓ pass |
| `bloom-support` CI — e2e worker tests (all 3 previously failing assertions) | ✓ pass |
| `verify` CI — 3,135 tests (1 previously failing) | ✓ 3,130 passed, 4 skipped |
| `bloom-build-preflight` | ✓ pass |
| `newsletter` | ✓ pass |
| Vercel preview deployment | ✓ deployed |

PR #537 merge state: `CLEAN` → merged `18a0d301f` to `main`, 2026-11-17 06:28 UTC.
