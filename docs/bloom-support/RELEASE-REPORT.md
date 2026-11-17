# Bloom Support — Final Release Report

Deliverable G of the World-Class Support initiative.
Released to production via PR #537, merged 2026-11-17.

---

## What was improved

Bloom Support received improvements across four areas: how it communicates with customers, how it handles requests for a real person, how the support team works in the dashboard and Slack, and how the system monitors itself.

---

## What customers will notice

**Warmer, clearer messages at every stage**

Every automated message Bloom sends was reviewed and rewritten. The changes are small individually but add up to a noticeably more human experience:

- When a request arrives: "Your request is with me now. I'll work through it and let you know what I find — or pass it to a person on our support team if that's what it needs." (Previously it was more impersonal.)
- When Bloom needs more information: It now opens with "To move this forward, I need a few quick details:" followed by specific, bulleted questions, then "Reply here and I'll pick it up from there." Customers always know what to do next.
- When a ticket is passed to a person: Bloom now explicitly confirms that the whole conversation travels with it — "They'll have everything you've shared here — the full conversation and all the details — so there's no need to start over." No customer has to explain their problem twice.
- When a ticket is resolved: "If anything still isn't right, reply to this email and I'll reopen the request right away." Customers know exactly how to get help again without starting from scratch.
- When a customer reopens a ticket: "Everything from before is still here; you don't need to repeat yourself."

**Asking for a person actually works**

If a customer types any variation of "I want to speak to a person," "get me a human," "not the bot," or "stop the bot" — Bloom now detects it immediately and routes to you before doing any other analysis. The customer gets a confirmation that a person will follow up, and you get a Slack notification. Previously, Bloom would continue trying to answer with AI even when a customer clearly didn't want that.

**Engineering status updates are accurate and clear**

When Bloom is investigating a reported bug or problem, it now sends specific status updates that accurately reflect what's happening — "The problem is confirmed and a fix is in progress. It still needs to pass review and testing before it reaches the app" — rather than vague or potentially misleading language.

**No personal names in automated messages**

Bloom no longer references "Jon" or "Jeff" in customer-facing messages. Instead it uses "our team" and "our support team." This keeps communications professional and scalable as the team grows.

---

## What staff will notice

**The queue now shows who owns what**

Every ticket in the queue now shows the assigned staff member's name (or "Unassigned") directly on the row. You no longer have to open each ticket to find out whether it has an owner. Accountability is visible at a glance.

**Quick actions from the queue — no need to open the ticket**

Hovering over any ticket in the queue reveals a `⋯` menu. From there you can:
- Assign the ticket to yourself
- Change the status to working
- Set the ticket to waiting (with a reason: customer / vendor / internal / other)
- Resolve the ticket (entering a brief resolution summary that gets sent to the client)

Each action updates immediately without opening the ticket or reloading the page.

**Natural ticket commands in Slack**

In any Bloom ticket Slack thread, you can now type a natural phrase and Bloom will act on it directly in the thread:
- "I'll handle this" or "claim this" → assigns the ticket to you and pauses automation
- "pause Bloom" or "hold off" → pauses automation without claiming
- "resume Bloom" → resumes automation
- "marking as waiting" or "waiting on client" → sets the ticket to waiting status

Bloom replies with a confirmation. Resolving, approving operations, and sending customer messages still require the dashboard — Slack actions are limited to safe, reversible status changes.

**Sensitive replies held for staff review (Gmail draft queue)**

For tickets in certain states — escalated, flagged for action, or assigned to an executor — Bloom no longer auto-sends replies. Instead it creates a Gmail draft for you to review first. You'll get an internal note on the ticket saying "A draft reply was prepared and held for staff review (Gmail draft [ID]). Review and send from Gmail, then mark this ticket resolved." This requires the Gmail environment variables to be configured (see "What requires Jon's approval" below).

**Overnight maintenance sweep**

A new nightly job scans for stale tickets (5+ days without an update) and unresponded tickets (48+ hours without a first response). It adds an internal note to each one and posts a summary to `#alerts`. This runs automatically — no setup required.

**Earlier warning before deadlines are breached**

The watchdog now fires when a ticket has used 80% of its first-response window without a reply — not just after it has already breached. You'll see the alert in time to act. The notification appears in the dashboard's Readiness panel.

**Better monitoring across the board**

The watchdog now checks for six additional conditions, each alerting once per hour (or once per day for lower-noise issues):
- Bloom tools consistently failing or timing out for a specific client
- Bloom requests failing in bulk (possible access issue)
- Staff marking Bloom answers as unhelpful (3+ thumbs-down in 24 hours)
- Duplicate built-in customer groups on a client account
- Deleted or merged customers still appearing in customer groups (which causes incorrect counts)

---

## What's verified live

Everything in this release was tested before merging:

- 3,130 automated tests pass (the full unit and component test suite)
- The Bloom Support worker end-to-end tests pass, including all previously failing assertions about Bloom's message text
- The "roles not names" test passes — Bloom never puts personal names in customer messages
- The Vercel preview deployment built and deployed successfully
- All CI checks green: `bloom-support`, `verify`, `bloom-build-preflight`, `newsletter`, `Vercel`
- PR #537 merged to `main` with merge state CLEAN

---

## What remains outstanding

The following items from the original assignment are not yet live. They are documented and sequenced in `IMPLEMENTATION-ROADMAP.md`.

**Operational (no code changes needed, just configuration):**

| Item | What it unlocks |
|------|-----------------|
| Add `bloom_support_alert_resend_key` to Supabase Vault | Email alerts from the watchdog when staff aren't monitoring Slack |
| Set `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` in Supabase secrets | Gmail draft queue for sensitive replies |
| Complete ChatGPT OAuth connection | Access to all 40 Bloom MCP tools through natural language in ChatGPT |

**Upcoming features (code work, sequenced in roadmap):**

| Feature | Why it matters |
|---------|----------------|
| QW-5: Knowledge gap panel | Shows which questions Bloom can't answer — one new article can deflect many future tickets |
| HV-1: Activate email delivery | Without this, all support runs through one-to-one contact. Email is the highest-priority activation. |
| HV-2: Connect POS intake | POS clients using "Report a problem" are currently getting no response |
| HV-3: CSAT survey | The only real feedback loop on whether support actually worked |
| HV-7: Handoff context note | Staff taking over an escalated ticket should get a structured AI summary, not just a raw thread |
| HV-4: Repeat issue detection | Flags when the same client files 3+ similar tickets in 30 days |
| HV-5: Cross-client incident detection | Detects when 5+ different clients file the same ticket in a 2-hour window |

**Longer horizon (significant work, not yet started):**

- Customer satisfaction scoring linked to AI answer quality
- In-product ticket list for BloomSites and POS clients
- Knowledge base article authoring UI
- Full activation of the automated engineering repair pipeline (requires separate security review)

---

## What requires Jon's approval

| Item | Why Jon's approval is needed |
|------|------------------------------|
| **Gmail draft queue activation** | Requires generating an OAuth2 refresh token for the Gmail account that holds drafts, then storing `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN` in Supabase Vault. This grants Bloom write access to that Gmail mailbox. |
| **Watchdog email alerts** | Requires generating a Resend API key and storing it as `bloom_support_alert_resend_key` in Vault. The key is scoped to outbound alerts only, but it is a live production credential. |
| **Email delivery activation (HV-1)** | Setting `BLOOM_SUPPORT_INBOX` enables Bloom to send email to real clients. This is the highest-leverage activation but should only happen after end-to-end testing on a staging inbox. |
| **Engineering repair pipeline (LH-5)** | Setting `BLOOM_GITHUB_REPAIR_TOKEN`, `BLOOM_GITHUB_RELEASE_TOKEN`, and `BLOOM_VERCEL_TOKEN` grants Bloom write access to the production GitHub repo and Vercel. Per `HANDOVER.md §8`, this requires an independent security review before activation. |
| **ChatGPT OAuth** | Completing the OAuth flow on ChatGPT's side. No code change needed — this is a click-through authorization in ChatGPT settings. |

---

*Technical evidence for each change is in `COMPLETED-IMPROVEMENTS.md`.*
*The full implementation roadmap is in `IMPLEMENTATION-ROADMAP.md`.*
