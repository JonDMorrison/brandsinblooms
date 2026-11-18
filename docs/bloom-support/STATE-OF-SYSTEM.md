# Bloom Support: system inventory and current evidence

## Current evidence: November 18, 2026

The earlier inventory below contains stale configuration assumptions. Do not use its "Not activated" labels to decide which credentials or connections need setup. The authenticated **System status** view and current production records are the source of truth.

Production `readiness_facts` checked at `2026-11-18T18:42Z` shows a running worker, zero queued/running/retrying/dead jobs, 50 approved client articles, actual inbound/outbound email evidence, CMS intake evidence and recent authenticated MCP/API use. The `automation_enabled` and `slack_agent.enabled` settings are true. OpenAI is configured as `gpt-4o-mini`, with existing 200-per-account/day and 1,000-total/day call limits. This records observed evidence, not certification of every client workflow.

The conversational release in PRs #556 and #557 is deployed. Public knowledge retrieval and unmentioned follow-ups have live evidence. Private Slack operations require the two missing channel-metadata scopes and a verified reinstall; that step remains unfinished. See [the staff guide](SLACK-OPERATIONS-STAFF-GUIDE.md), [agent design](CONVERSATIONAL-AGENT.md), and [knowledge source record](KNOWLEDGE-COVERAGE-2026-11-17.md). PR #558 tracks the remaining runtime test, human-contact and privacy corrections. Tracker #550 records release and live verification separately.

## Historical inventory: November 16

The following is preserved as a historical code inventory based on `HANDOVER.md` from November 1. Its environment/configuration statements were not a current production audit and are superseded by the evidence above.

---

## Intake channels

| Channel | Status | Notes |
|---|---|---|
| CRM "Get help" button | **Working** | Writes to Postgres before AI runs; deduplication active |
| CRM public support form | **Working** | Rate-limited; honeypot; no CAPTCHA |
| CRM staff "New ticket" | **Working** | Manual entry by staff |
| Email inbox (inbound) | **Not activated** | bloom@bloomsuite.app exists; no inbound webhook configured; RESEND_INBOUND_WEBHOOK_SECRET not set |
| BloomSites report button | **Not activated** | Code is deployed to staging, not production; BLOOM_INTAKE_SECRET_CMS not set |
| POS report button | **Working (POS only)** | bloom-support-report deployed; BLOOM_SUPPORT_INTAKE_URL not set on POS Vercel |
| POS offline queue | **Working** | Till saves locally and sends when online |
| ChatGPT / MCP create_ticket | **Not activated** | OAuth untested with ChatGPT itself; personal-key fallback works |
| Authorized staff email forward | **Working** | DKIM/SPF-verified forwards accepted |

---

## Ticket lifecycle

| Capability | Status | Notes |
|---|---|---|
| Ticket creation, numbering, deduplication | **Working** | Idempotency keys prevent double intake |
| Status transitions (New → Working → Waiting → Resolved) | **Working** | Enforced by SQL valid_transition; version checks prevent conflicts |
| Ticket ownership (accountable owner + executor) | **Working** | Default owner: Jon unless settings.support.default_owner_email set |
| Response deadlines by priority | **Working** | Business hours calculated with holidays; first_response clock |
| Human takeover | **Working** | Automation blocked in SQL on human claim; Bloom queued jobs cancelled |
| Ticket merging (same client only) | **Working** | Messages, attachments, source refs kept; email replies follow merge |
| Cross-client shared problems | **Working** | One investigation, private conversations per client |
| Post-resolution reply routing | **Working** | "Still broken" → reopen; thanks → dismiss; new request → new linked ticket |
| Ticket search and queue views | **Working** | 10 views; search by number/client/requester/text; keyset pagination |
| Bulk assign/tag/status | **Working** | Safety confirmation for >20 ticket bulk actions |
| Client-visible tracking | **Partial** | CRM: /support ticket list exists. BloomSites/POS: tracking link in email only — no in-product list |

---

## AI automation

| Capability | Status | Notes |
|---|---|---|
| Triage (classify type, priority, category) | **Working** | Requires OPENAI_API_KEY; falls back to deterministic rules without it |
| AI answers from approved knowledge | **Working** | Only approved client articles used; answerable=false if knowledge insufficient |
| Clarification requests | **Working** | Up to 5 questions; returns to queue after reply |
| Human handoff decision | **Working** | Automatic when AI confidence insufficient |
| Engineering investigation trigger | **Working** | Requires BLOOM_GITHUB_REPAIR_TOKEN (not set) |
| Automated repair (codex exec) | **Not activated** | BLOOM_GITHUB_REPAIR_TOKEN missing; repair workflow has never run |
| Vercel rollback on failed verification | **Not activated** | BLOOM_VERCEL_TOKEN missing |
| Per-scope automation pauses | **Working** | triage, answer, email, operations, engineering each independently pausable |
| Budget enforcement (model calls/day) | **Working** | 1000/day total, 200/day per account; logged as ai.call |
| Deterministic fallback (no model) | **Working** | Rules-only mode when OPENAI_API_KEY absent or BLOOM_AI_PROVIDER=none |

---

## Email delivery

| Capability | Status | Notes |
|---|---|---|
| Outbound email (acknowledgements, updates, resolution) | **Not activated** | BLOOM_SUPPORT_INBOX not set; emails queue but cannot send |
| Email threading (Message-ID, In-Reply-To, [Bloom #N] tag) | **Working (code)** | Tested against stubs only |
| CC handling (same-client verified contacts only) | **Working (code)** | Strangers dropped at intake |
| Bounce and complaint handling | **Working (code)** | Resend webhook handler; not tested end-to-end |
| Outbound email deduplication (24h Resend window) | **Working (code)** | Same idempotency key + Message-ID on retry |
| Staff notification emails | **Not activated** | settings.notifications.email_staff off by default; email not configured |
| Daily/weekly digest email | **Working (code)** | Sends when BLOOM_SUPPORT_INBOX set; scheduled 8am business hours |
| Alert emails (watchdog) | **Not activated** | bloom_support_alert_resend_key not in Vault |

---

## Slack

| Capability | Status | Notes |
|---|---|---|
| Ticket event notifications (8 channels) | **Not activated** | BLOOM_SUPPORT_SLACK_BOT_TOKEN and channel env vars not set |
| Block Kit rich messages | **Working (code)** | postSlackInternalMessage supports blocks |
| Staff Slack conversation (ask-bloom thread) | **Not activated** | respondToSlackConversation built; Slack not connected |
| Morning digest to Slack | **Not activated** | PR #537 merged; BLOOM_SUPPORT_SLACK_CHANNEL_DIGEST env var needed |
| Slack decisions (approve/reject repair) | **Working (code)** | slack-decisions.ts built; requires Slack connection |

---

## Engineering repair pipeline

| Capability | Status | Notes |
|---|---|---|
| GitHub issue creation | **Not activated** | Requires BLOOM_GITHUB_REPAIR_TOKEN |
| Automated investigation (codex exec) | **Not activated** | Never run in production |
| PR creation | **Not activated** | bloom-repair.yml exists; never dispatched |
| PR merge (approved changes) | **Not activated** | Requires BLOOM_GITHUB_RELEASE_TOKEN |
| Deployment verification | **Not activated** | Requires BLOOM_VERCEL_TOKEN |
| Vercel instant rollback | **Not activated** | BLOOM_VERCEL_TOKEN missing |
| One investigation per bug (duplicate detection) | **Working** | Automatic strong match; manual "Duplicate of" |
| Repair attempt limits (2 max) | **Working** | Enforced in DB; prevents runaway automation |

---

## Dashboard UI (staff, /admin/bloom-support)

| View | Status | Notes |
|---|---|---|
| Today view (decisions needed, Bloom-handled, search) | **Working** | |
| Queue views (10 views) | **Working** | Needs attention, Assigned to me, All open, etc. |
| Ticket detail (conversation, composer, related, engineering) | **Working** | |
| Escalations panel | **Working** | |
| Engineering panel | **Working** | |
| Features panel | **Working** | |
| Clients panel | **Working** | |
| Operations panel | **Working** | |
| Reports panel | **Working** | 4 headline stats, bar chart, breakdowns; some useful data hidden in "More detail" accordion |
| Readiness tab | **Working** | Honest capability checklist with live/configured/missing status |
| Settings panel | **Working** | Covers targets, hours, digests, automation scopes, model, etc. |
| Knowledge panel | **Working** | Approve/reject articles; no article authoring UI |

---

## MCP tools (staff via ChatGPT)

| Group | Count | Status |
|---|---|---|
| Status & setup (readiness, health, whoami, queue_summary) | 4 | **Working** |
| Tickets (list, get, create, reply, update, take_over, link, related) | 8 | **Working** |
| Clients (find_client, client_history) | 2 | **Working** |
| Engineering (start_investigation, engineering_status, approve_fix) | 3 | **Not activated** (needs GitHub token) |
| Escalations & decisions (8 tools) | 8 | **Working** |
| Product operations (product_operations, read, preview, execute, undo, verify) | 6 | **Partial** (CRM ops work; CMS/POS need secrets) |
| Automation (automation_switch, list_jobs, retry_or_cancel_job) | 3 | **Working** |
| Desk (merge, problems, timers, metrics, etc.) | 6 | **Working** |
| **Total** | **40** | |

ChatGPT OAuth: implemented and tested against spec; **untested with ChatGPT itself**. Personal-key fallback works.

---

## Authentication & security

| Capability | Status |
|---|---|
| Staff roles (platform_admin, platform_operator) | **Working** |
| Jon auto-promoted to platform_admin on first sign-in | **Working** |
| Read-only key enforced (POST to /tickets → 403) | **Working** (verified live) |
| Anonymous POS reporting → 401 | **Working** (verified live) |
| Rotating OAuth refresh tokens (reuse revokes) | **Working** |
| Client sees only own tickets | **Working** (SQL RLS) |
| Internal notes never shown to clients | **Working** |
| Ticket number alone grants nothing | **Working** |

---

## Monitoring & watchdog

| Capability | Status |
|---|---|
| Worker heartbeat (every minute, bloom_support.worker_runs) | **Working** |
| Watchdog cron (every 5 minutes, pure SQL) | **Working** |
| Watchdog detects: worker down, queue backlog, dead jobs, email failures, unanswered escalations | **Working** |
| In-app alerts | **Working** |
| Alert emails (watchdog → Resend direct) | **Not activated** (bloom_support_alert_resend_key not in Vault) |

---

## Analytics & reporting

| Metric | Status |
|---|---|
| Open tickets by status / priority / product / client / owner | **Working** |
| Daily incoming + resolved + backlog reconstruction | **Working** |
| Age distribution | **Working** |
| First response (median + p90, business time) | **Working** |
| Time to resolution (median + p90) | **Working** |
| Reopen rate | **Working** |
| Person vs Bloom resolutions | **Working** |
| Verified autonomous resolutions | **Working** |
| Dead jobs, model calls, tokens | **Working** |
| Customer satisfaction (CSAT) | **Not built** |
| Repeat issue rate | **Not built** |
| Knowledge-base gap detection | **Not built** |
| AI answer quality scoring | **Not built** |

---

## Missing product operations

These are not yet implemented regardless of secrets:

- Site creation
- POS inventory and sales summaries
- Campaign "send now" (schedule ≥1 min ahead required)
- Fundraising-specific operations
- Automatic retention redaction (configurable but not scheduled)
- BloomSites/POS in-product ticket lists
