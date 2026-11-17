# Bloom Support — Implementation Roadmap

Updated 2026-11-16. Deliverable E of the World-Class Support initiative.

Organized into three tiers: **Quick wins** (small, high-impact, low risk), **High value** (meaningful
features, 1–2 sprint effort each), and **Longer horizon** (significant or cross-product work).

For the current state of each capability, see STATE-OF-SYSTEM.md. For the gaps being addressed, see GAP-ANALYSIS.md.

---

## Tier 1: Quick wins (this sprint)

These can be completed in days. Most are small code changes or operational steps.

### QW-1: Voice.ts copy improvements
**What:** Apply the rewrites from LANGUAGE-AUDIT.md to `voice.ts`.
**Why:** Removes "our product team" abstraction, names real people, makes AI role clear, improves tone
for garden centre clients.
**Complexity:** Small — string edits, no schema change.
**Blocking:** Nothing.

### QW-2: Explicit human escalation trigger
**What:** Before the AI runs in the `answer` job, check the latest client message for explicit escalation
signals: "speak to a person", "human", "not the bot", "can I talk to Jon", "can I talk to Jeff", "I want
a person", "real person". If matched, bypass AI and trigger immediate `ticket.needs_owner`.
**Why:** A client asking for a human should never get another AI response. This is a trust-critical gap.
**Complexity:** Small — a string check in the `answer` job before the AI call.
**Blocking:** Nothing.

### QW-3: Pre-breach alerting (80% of response window)
**What:** Add a check in the watchdog SQL cron that fires when a ticket has consumed 80% of its allowed
first-response window without a reply. Add a job event `ticket.approaching_deadline`.
**Why:** Currently the watchdog fires after the breach. By then it's too late. Early warning enables action.
**Complexity:** Small — SQL change to `bloom_support_watchdog` view or cron function.
**Blocking:** Nothing.

### QW-4: Owner visible in queue list
**What:** Add the assigned owner's name (or "Unassigned") as a column in the ticket queue list UI.
**Why:** Accountability at a glance. Currently requires opening each ticket to see who owns it.
**Complexity:** Small — UI column addition, data already available.
**Blocking:** Nothing.

### QW-5: Knowledge gap panel in dashboard
**What:** Add a "Knowledge gaps" section to the Knowledge panel (or Reports). Query tickets where
`answerable=false` grouped by category and date range. Show top gaps with ticket counts.
**Why:** Surfaces the questions Bloom can't answer. One approved article can deflect many future tickets.
**Complexity:** Small — query existing data, new UI section.
**Blocking:** Nothing.

### QW-6: Activate alert emails
**What:** Add `bloom_support_alert_resend_key` to Vault.
**Why:** Watchdog can only alert via Slack (not configured) and in-app. Email fallback is critical when
neither is monitored.
**Complexity:** Operational — set a secret.
**Blocking:** Need to generate and store the Resend API key.

### QW-7: Connect ChatGPT OAuth (operational)
**What:** Jon and Jeff complete OAuth connection with ChatGPT.
**Why:** The 40 MCP tools become accessible via ChatGPT's natural language interface instead of only
via API key.
**Complexity:** Operational — no code changes needed.
**Blocking:** Nothing except time.

---

## Tier 2: High value (next 2 sprints)

These are meaningful improvements that require a few days each of focused work.

### HV-1: Activate email delivery
**What:** Set `BLOOM_SUPPORT_INBOX` in Vault. Test acknowledgement, reply threading, duplicate delivery,
reopen, and bounce handling end-to-end. Enable `client_email_enabled` only after testing passes.
**Why:** Without email, the support system operates in silence. This is the highest-priority activation.
**Complexity:** Medium — operational steps plus end-to-end testing.
**Blocking:** Vercel secret access (can be done via Supabase Vault + manual Vercel dashboard).

### HV-2: Connect POS intake
**What:** Set `BLOOM_SUPPORT_INTAKE_URL` on POS Vercel project. Verify "Report a problem" button routes
correctly to Bloom Support. Test: ticket arrives, acknowledgement returns.
**Why:** POS clients using the report button are silently getting no response.
**Complexity:** Small-Medium — operational plus smoke test.
**Blocking:** Vercel secret access.

### HV-3: Customer satisfaction (CSAT) survey
**What:** After ticket resolves, send a 1-question email survey 24h later ("Did this resolve your issue?
Yes / No / Partially"). Record response in a new `bloom_support_csat` table linked to the ticket.
Surface in ticket detail and Reports panel. Alert the team on any "No" response.
**Why:** Only real feedback loop on support quality. Currently flying blind.
**Complexity:** Medium — new table, email worker job, public endpoint, UI.
**Blocking:** Email must be activated first (HV-1).

### HV-4: Repeat issue detection
**What:** Add a worker job (or watchdog extension) that detects: same `tenant_id` + same `category` +
3+ tickets in 30 days → create an escalation flagged "repeat_issue" and add an internal note to each
affected ticket.
**Why:** A client with a recurring problem looks identical to three separate incidents. Repeat issues
need proactive outreach, not just reactive handling.
**Complexity:** Medium — SQL query + escalation path + notification.
**Blocking:** Nothing.

### HV-5: Shared-problem detection (cross-client)
**What:** A periodic job that clusters new tickets by category + product within a 2-hour window. If
5+ different clients have matching tickets, create a cross-client investigation, link affected tickets,
and add an internal note to each.
**Why:** Widespread incidents currently look like unrelated individual tickets.
**Complexity:** Medium — clustering logic + cross-ticket linking + investigation creation.
**Blocking:** Nothing.

### HV-6: In-product ticket list for BloomSites
**What:** A `/support` page in the BloomSites CMS dashboard showing the client's open and resolved tickets,
with status and reply timestamps. Uses the existing `bloom-support-api` endpoint.
**Why:** BloomSites clients have no way to check ticket status without digging through email.
**Complexity:** Medium — BloomSites frontend page + API auth.
**Blocking:** BloomSites intake secret must be set + BloomSites PR released to production.

### HV-7: Improved hand-off context note
**What:** When Bloom escalates to human, write a structured internal note with: Bloom's confidence score,
what knowledge articles were tried, what clarification was asked, and why the AI is stepping back. Visible
in the ticket detail for the human taking over.
**Why:** Currently staff get the conversation but no AI summary. They have to read the whole thread to
understand context.
**Complexity:** Medium — structured note generation in the `escalate` job.
**Blocking:** Nothing.

### HV-8: Quick actions in ticket queue
**What:** Add inline actions to the ticket queue list: assign owner, change status, add a quick note —
without opening the ticket detail.
**Why:** Every action currently requires two navigation steps. With 20+ open tickets, this is friction.
**Complexity:** Medium — UI work, no schema change.
**Blocking:** Nothing.

---

## Tier 3: Longer horizon

These require significant engineering, cross-product coordination, or external dependencies.

### LH-1: AI answer quality scoring
**What:** Link CSAT responses back to whether the resolution was AI-answered. Track: autonomous resolution
rate, confirmed-resolved rate (from CSAT "Yes"), knowledge gap rate. Display in Reports panel.
**Why:** Count resolutions vs count genuine customer satisfaction are different things. Need CSAT first.
**Complexity:** Large — depends on CSAT (HV-3), plus linkage logic.
**Blocking:** CSAT must be built first.

### LH-2: In-product ticket list for POS
**What:** An in-till "Support" screen in BloomSuite POS showing the client's last 10 tickets.
**Why:** POS clients can't check ticket status without email. The POS context (retail floor) makes
email-based tracking particularly awkward.
**Complexity:** Large — POS frontend + authentication.
**Blocking:** POS intake must be connected first (HV-2).

### LH-3: Knowledge base article authoring UI
**What:** Currently knowledge articles can be approved/rejected but not authored in the UI. Staff need
to add articles via database directly.
**Why:** Knowledge gaps (QW-5) are only useful if they can be fixed. The team needs to write new articles
directly in Bloom Support.
**Complexity:** Medium-Large — full CRUD editor in the Knowledge panel.
**Blocking:** Nothing except prioritization.

### LH-4: Client-tier priority routing
**What:** Clients using all three BloomSuite products (CRM + POS + BloomSites) automatically get higher
response priority. Priority is computed from `product_links` at ticket creation.
**Why:** High-value, multi-product clients should get faster support. Currently all clients are equal.
**Complexity:** Medium — schema addition (priority multiplier), routing logic change.
**Blocking:** Cross-product links need to be established first.

### LH-5: Activate full engineering repair pipeline
**What:** Set `BLOOM_GITHUB_REPAIR_TOKEN`, `BLOOM_GITHUB_RELEASE_TOKEN`, `BLOOM_VERCEL_TOKEN`. Test
the full 15-step repair workflow end-to-end on a non-production bug. Enable automated repair.
**Why:** The repair pipeline exists in code but has never run in production. It's the highest-leverage
capability in the system.
**Complexity:** Large — credentials, testing, approval workflow verification.
**Blocking:** Requires independent security review per HANDOVER.md §8.

### LH-6: BloomSites intake activated in production
**What:** Release the BloomSites support PR to production after completing the CMS release process.
**Why:** Currently only on staging. The CMS divergence (139 ahead / 550 behind) makes this a careful
release.
**Complexity:** Large — CMS release process, not just a secret.
**Blocking:** CMS release coordination.

### LH-7: Autonomous Bloom Support operations (email policy + Gmail draft queue)
**What:** Policy-based email: draft responses to common requests, queue them for Jon/Jeff approval in
a Gmail-style draft view, send on approval. Overnight batch jobs for routine follow-ups.
**Why:** Reduces the daily manual support burden. High-volume routine messages (acknowledgements,
updates) can be drafted and approved in bulk.
**Complexity:** Large — new draft queue UI, Gmail-style approval flow, batch job scheduling.
**Blocking:** Email must be activated first (HV-1).

### LH-8: Slack + OpenAI natural conversation interface
**What:** A `#ask-bloom` Slack channel where Jon or Jeff can ask natural language questions about support
state ("What tickets need me today?" "What's blocking the Sunrise Gardens issue?"). Bloom responds via
OpenAI tool calling, running the actual MCP queries to answer.
**Why:** The most powerful interface for staff who live in Slack. MCP tools exist; wiring them to a Slack
conversation is the remaining work.
**Complexity:** Large — Slack bot setup, OpenAI function calling with MCP tools, durable background jobs
tied to Slack thread state.
**Blocking:** Slack bot tokens must be configured. ChatGPT OAuth should be done first (QW-7).

---

## Sprint plan summary

**This sprint (Quick wins):**
QW-1 voice copy, QW-2 explicit escalation trigger, QW-3 pre-breach alerting, QW-4 owner in queue,
QW-5 knowledge gap panel, QW-6 alert emails (operational), QW-7 ChatGPT OAuth (operational)

**Next sprint (High value, activation-first):**
HV-1 activate email, HV-2 POS intake, HV-3 CSAT (after email), HV-7 hand-off context note, HV-4 repeat
issue detection

**Following sprint:**
HV-5 shared-problem detection, HV-6 BloomSites ticket list, HV-8 quick actions in queue

**Longer term:**
LH-5 engineering repair pipeline, LH-7 autonomous operations, LH-8 Slack+OpenAI interface
