# Bloom Support — Gap Analysis

Updated 2026-11-16. Deliverable D of the World-Class Support initiative.

Prioritized by customer impact for garden centre clients. Sources: STATE-OF-SYSTEM.md, HANDOVER.md,
COMPETITIVE-RESEARCH.md, and direct code review.

---

## Critical gaps (affects the experience of every client getting support)

### 1. Email not activated

**What's missing:** `BLOOM_SUPPORT_INBOX` is not set. All outbound email (acknowledgements, updates,
resolutions) queues but never sends.

**Customer impact:** Clients who submit via CRM get no email acknowledgement. The support system effectively
operates in silence — clients have no confirmation their request was received or resolved.

**What's needed to fix it:** Set `BLOOM_SUPPORT_INBOX` in Vault. Test acknowledgement, reply threading,
bounce handling with owner addresses before enabling `client_email_enabled`. See HANDOVER.md §4.

**Blocking:** Vercel deployment secret access issue. Can be done manually in Supabase Vault and Vercel dashboard.

---

### 2. No customer satisfaction measurement (CSAT)

**What's missing:** No CSAT survey exists. When a ticket is resolved, we have no way to know if the client
feels their problem was actually solved.

**Customer impact:** We are flying blind on support quality. A client who gave up after the fourth AI response
looks identical in our data to a client who was delighted.

**What's needed to fix it:** After ticket resolution, send a 1-question survey ("Did Bloom resolve this?"
Yes / No / Partially). Store responses in a `bloom_support_csat` table. Surface the result in the
ticket detail and in the Reports panel. Alert the team on any "No" response.

**Effort:** Medium. Email delivery, a new table, a lightweight public endpoint to record responses.

---

### 3. No in-product ticket list for BloomSites or POS clients

**What's missing:** CRM clients can see `/support` for their ticket list. BloomSites and POS clients
can only track their tickets via the email link in the acknowledgement.

**Customer impact:** A BloomSites client with an open ticket has no way to check its status without digging
through their email. This creates duplicate submissions and a perception that requests disappear.

**What's needed to fix it:**
- BloomSites: a simple `/support` page in the CMS dashboard showing the client's open and resolved tickets.
  Requires the BloomSites intake secret to be set first (BLOOM_INTAKE_SECRET_CMS).
- POS: an in-till "Support" screen showing the client's last 10 tickets.

**Effort:** Medium per product. The API endpoints already exist.

---

### 4. BloomSites intake not activated

**What's missing:** `BLOOM_INTAKE_SECRET_CMS` not set; BloomSites code is on staging, not production.
The "Report a problem" button in the CMS has never been connected to the support system in production.

**Customer impact:** BloomSites clients can't file a support ticket from within the product. They must
email separately or use the CRM.

**What's needed to fix it:** Set the secrets (HANDOVER.md §2). Release the BloomSites support PR to
production after the CMS release process.

---

### 5. No repeat issue detection

**What's missing:** If the same client files the same type of ticket three times in 30 days, nothing
flags it. The system handles each ticket independently.

**Customer impact:** A recurring problem for a garden centre (e.g., their POS end-of-day fails every
Monday) is never escalated as a pattern — it looks like three individual tickets.

**What's needed to fix it:** Add a job or SQL query that detects: same client + same category + N tickets
in M days → create an escalation and flag for human review. Already has the data needed.

**Effort:** Small–Medium. SQL + a new escalation path in the worker.

---

## High-impact gaps (meaningfully worsens the support experience)

### 6. No shared-problem detection across clients

**What's missing:** When 5+ clients file tickets about the same issue (e.g., POS login failing), there
is no automatic detection that this is a widespread problem. Each ticket is processed individually.

**Customer impact:** The team doesn't learn about an incident from the ticket volume — they find out from
Jon checking manually or a client escalating.

**What's needed to fix it:** A job that clusters new tickets by category + product + timeframe. If a cluster
emerges, create a cross-client investigation and add a note to each affected ticket.

**Effort:** Medium. The clustering logic is the main engineering challenge.

---

### 7. No pre-breach alerting

**What's missing:** The watchdog fires *after* a deadline is missed. For a ticket filed Friday afternoon,
this means no alert until after the weekend.

**Customer impact:** Response time targets are breached silently. By the time Slack gets an alert, the
client has already waited too long.

**What's needed to fix it:** Add a watchdog check at 80% of the response window. The existing watchdog
SQL cron is the right place to add this.

**Effort:** Small. SQL change to the watchdog query.

---

### 8. AI answer quality scoring

**What's missing:** When Bloom answers a ticket autonomously, there's no measure of answer quality. We
can count resolutions but not whether the resolution was actually from a good AI answer vs a client
who gave up.

**Customer impact:** We may be counting "autonomous resolutions" that are actually abandoned tickets.

**What's needed to fix it:** After CSAT is built, link CSAT responses to whether the resolution was
AI-driven. Track: AI-answered rate, confirmed-resolved rate (from CSAT), knowledge gap rate (tickets
where answerable=false).

**Effort:** Depends on CSAT being built first.

---

### 9. Knowledge-base gap detection

**What's missing:** When Bloom sets `answerable=false` (meaning no approved article covers the question),
this is logged but not surfaced as a gap for the team to fill.

**Customer impact:** Clients repeatedly ask questions that Bloom can't answer, requiring human handling
every time — when a single knowledge article would automate all future instances.

**What's needed to fix it:** Surface `answerable=false` tickets in a "Knowledge gaps" view in the
Dashboard. Group by category and question pattern. This is a reporting view on existing data.

**Effort:** Small. Query existing data, add a panel.

---

### 10. Human escalation detection from natural language

**What's missing:** Clients who type "can I speak to a person" or "I want to talk to someone" are not
guaranteed an immediate escalation. The current AI decides whether to escalate based on confidence,
not on explicit client requests.

**Customer impact:** A frustrated client asking for a human may get another AI response. This erodes trust.

**What's needed to fix it:** In the `answer` job, before the AI runs, check the latest client message
for explicit escalation signals ("speak to", "human", "person", "not the bot", "Jon", "Jeff"). If matched,
trigger immediate handoff without waiting for AI confidence.

**Effort:** Small. A regex or simple keyword check before the AI step.

---

### 11. POS intake secret not configured

**What's missing:** `BLOOM_SUPPORT_INTAKE_URL` is not set on the POS Vercel project. The "Report a
problem" button on POS doesn't route to Bloom Support.

**Customer impact:** POS clients who hit the report button get no response. This may appear to work
(no error shown to the user) but the ticket never arrives.

**What's needed to fix it:** Set the env var on the POS Vercel project. See HANDOVER.md §2.

---

## Operational gaps (limits the team's effectiveness)

### 12. No quick actions in the ticket queue

**What's missing:** Assigning, resolving, or adding a note requires opening the ticket detail. The queue
list view has no inline actions.

**Team impact:** Every action requires two navigation steps. For a team managing 20+ open tickets, this
adds up.

**Effort:** Medium UI work.

---

### 13. Owner not visible in queue list

**What's missing:** The ticket queue doesn't show who owns each ticket at a glance. You have to open
the ticket to see the assignee.

**Team impact:** No accountability at a glance. Team lead can't see workload distribution without opening
tickets.

**Effort:** Small UI change to the queue list columns.

---

### 14. ChatGPT OAuth not tested end-to-end

**What's missing:** OAuth implementation is complete and passes spec tests, but has not been tested with
the actual ChatGPT interface. Jon and Jeff have not connected their accounts.

**Team impact:** The 40 MCP tools (the most powerful staff interface) are only accessible via personal
API keys, not ChatGPT.

**Effort:** Zero new code. Operational: Jon and Jeff complete the OAuth connection.

---

### 15. Alert emails not configured

**What's missing:** `bloom_support_alert_resend_key` not in Vault. Watchdog detects problems but can only
alert via in-app notifications and Slack (if configured). No email fallback if Slack is down.

**Team impact:** If neither Slack nor app alerts are watched, critical incidents are silent.

**Effort:** Small. Set the secret in Vault.

---

## Missing product operations (affects ability to do work via MCP)

| Missing operation | Impact |
|---|---|
| Site creation | Can't create a BloomSites site from support context |
| POS inventory/sales summaries | Can't answer "what sold today?" type questions |
| Campaign "send now" | Can only schedule ≥1 min ahead; no instant send |
| Fundraising operations | Fundraising clients have no product ops coverage |
| Automatic retention redaction | GDPR/privacy data not auto-cleaned even when configured |

---

## Priority order

1. **Activate email** — Nothing else matters as much. Without email, support is invisible to clients.
2. **Set missing intake secrets** (POS, BloomSites) — Connect the report buttons that exist but don't work.
3. **Explicit human escalation trigger** — Never let a client asking for a person get an AI response.
4. **Pre-breach alerting** — Catch SLA misses before they happen.
5. **CSAT** — Only meaningful feedback loop on support quality.
6. **Knowledge gap detection** — Surface the gaps already accumulating in the data.
7. **In-product ticket lists** (BloomSites, POS) — Clients need ticket visibility.
8. **Repeat issue detection** — Identify recurring problems before they become churns.
9. **Quick actions in queue** — Team efficiency.
10. **Shared-problem detection** — Incident response.
