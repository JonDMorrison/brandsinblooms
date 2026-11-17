# Bloom Support — Competitive Research

Updated 2026-11-16. Deliverable B of the World-Class Support initiative.

## What we're measuring against

Five platforms shape what "good" looks like in B2B SaaS support today:
**Intercom Fin**, **Zendesk Suite**, **Front**, **Help Scout**, and **Gorgias**.

Bloom Support is fundamentally different — it's purpose-built for a single operator (BloomSuite) supporting
~230 garden centre clients. That means some features that matter at scale (SLA dashboards across 10,000 customers,
multi-language, marketplace integrations) are irrelevant. What matters is: does the person running a garden centre
feel like they got real help, fast, from someone who understood their business?

---

## Intercom Fin

**What they do well**
- **Fin passes context to humans.** When Fin (their AI) hands off, the agent sees the full conversation, Fin's
  confidence rating, and what Fin tried. The human never starts from scratch.
- **Resolution confidence is explicit.** Fin doesn't mark a conversation closed just because it replied — it
  waits for the user to confirm or uses signals (no reply in 48h + positive tone) before closure.
- **Conversation history is always visible.** Staff see every previous interaction from that customer across all
  channels in a single thread.
- **Proactive outreach.** Fin can initiate a conversation when it detects a problem (e.g., a failed payment)
  before the customer contacts support.

**What Bloom should adopt**
1. When handing off, include in the hand-off note: Bloom's confidence, what Bloom tried, and the specific reason
   for escalation. The current `bloomHandoff()` message is minimal.
2. Resolution should require positive confirmation or verified silence, not just an AI reply. The current
   `verify_resolution` job is the right model — keep enforcing it.
3. Staff view of a client should show all tickets across all products (CRM, BloomSites, POS) for that client
   before they even open a ticket.

---

## Zendesk Suite

**What they do well**
- **Ticket routing by skill, language, and load.** Tickets go to the right person automatically; no queue-scanning.
- **SLA policies with escalation triggers.** When a reply-time breach is approaching (not after), someone is alerted.
- **Macros.** Staff can apply a canned response + status change + tag with a single click, reducing response time.
- **Customer satisfaction (CSAT) built in.** A short survey is sent 24h after closure; results are visible per agent
  and per category.
- **Triggers.** When a ticket matches criteria (e.g., tagged "urgent" and no owner), an action fires automatically.

**What Bloom should adopt**
1. **CSAT**: Send a 1-question survey ("Did Bloom resolve this?") 24h after a ticket closes. Track per month.
   This is the single most important metric we're missing.
2. **Pre-breach alerting**: The watchdog fires after a deadline is missed. It should fire when 80% of the allowed
   response window has elapsed. Garden centres often contact us on Monday morning before opening — a Friday
   ticket that sits over the weekend should escalate Saturday noon, not Monday.
3. **Quick actions in the ticket list**: Staff should be able to assign, resolve, or add a note directly from the
   queue without opening the ticket detail. Currently every action requires entering the detail view.

---

## Front

**What they do well**
- **Shared inbox feels like email.** Staff see support threads as email threads, with drafts, @mentions, and
  internal notes that are invisible to customers.
- **Context sidebar.** When a customer emails, Front shows their full profile, previous conversations, and CRM
  data in a sidebar. No tab switching.
- **Thread comments vs customer replies.** The distinction between "talking to the customer" and "talking
  internally" is visually clear — different background, different font, different send button.
- **Assignment clarity.** One person at a time is explicitly assigned; the assignment is visible in the thread
  header, not buried in metadata.

**What Bloom should adopt**
1. **Internal notes and customer replies need to be visually distinct** in the ticket detail view. Currently
   they look similar — different only by a small label.
2. **Assigned owner should be prominent** in the queue list view. The current list shows priority and status;
   the owner field is not visible at a glance.
3. **Context panel in ticket detail** should surface the client's other tickets, their product linkage (CRM/POS/
   BloomSites), and their account tier — without requiring a separate lookup.

---

## Help Scout

**What they do well**
- **Beacon** (in-product widget) lets customers start a support conversation inside the app, without email.
  The widget pre-fills context (what page they're on, what they last did).
- **Knowledge base is searchable within Beacon.** The customer can self-serve from docs before creating a ticket.
  If they don't find an answer, the conversation starts with the article they read attached.
- **Satisfaction ratings are contextual.** Rating prompts appear in email after resolution. Poor ratings trigger
  an alert to the team lead, not just a stat.
- **Saved replies with variables.** Templates can include the customer's first name and ticket details.

**What Bloom should adopt**
1. **In-product widget for BloomSites clients.** BloomSites CMS users are web-based — a Beacon-style "Report a
   problem" widget could prefill the page URL, the last action, and the client name, far reducing intake friction.
   (This is higher-value than the current BloomSites report button, which is not activated.)
2. **Knowledge base integrated into the intake flow.** When a client types a question at intake, surface matching
   approved articles before creating a ticket. If they confirm it answered them, no ticket needed.
3. **Poor CSAT triggers a team alert.** A bad rating should not just go into a report — it should alert the owner
   that an unhappy client needs follow-up.

---

## Gorgias

**What they do well**
- **Built for repeat customers on Shopify/e-commerce.** Order, revenue, and customer lifetime value are visible
  in the support thread. Agents can issue refunds from within a ticket.
- **Rules engine.** "If tag = broken AND no reply in 1h AND revenue > $500, assign to senior support" is a live
  rule, not a manual process.
- **Customer signals.** VIP customers (high spend, long tenure) get routed to dedicated agents automatically.
- **Ticket origin is tracked precisely.** A ticket from Instagram DM vs email vs chat vs widget is tagged with
  its source, and routing differs.

**What Bloom should adopt**
1. **Client-tier-aware routing.** A garden centre running all three BloomSuite products (CRM + POS + BloomSites)
   should get higher automatic priority than a CRM-only client. This is feasible with the existing product_links
   data.
2. **Operational context in ticket.** When a client reports a POS failure during peak sale hours (a Saturday in
   spring), the support context should indicate that this is likely high-impact. The current system doesn't weight
   operational timing.
3. **Response templates with live variables.** Currently all copy is static. Templates should be able to include
   the client's name, their product (BloomSites / POS), and their last known ticket.

---

## Garden-centre-specific insights

These platforms are built for SaaS or e-commerce businesses with many customers. Garden centres are different:

- **Seasonality is extreme.** Spring (April–June) and Mother's Day are ~60% of annual revenue for many clients.
  A support failure in that window is not just an inconvenience — it can materially harm their business.
  Response SLAs should tighten during peak season or for POS incidents.
- **Small team, low digital fluency.** The person calling for support may be an owner who only touches technology
  when something is wrong. Messages should be in plain English, specific, and not require multiple back-and-forths.
- **Relationship is the product.** BloomSuite has ~230 clients. These are real people Jon and Jeff know by name.
  Support interactions should reinforce that relationship, not feel like a ticket system.
- **Clients share problems.** A bug in the POS "end-of-day" reconciliation likely affects every client using POS
  on the same day. Bloom should detect this pattern and batch-communicate to affected clients rather than handling
  them as separate tickets.

---

## Summary: highest-ROI patterns to implement

| Pattern | From | Effort | Why it matters |
|---|---|---|---|
| CSAT survey after close | Zendesk | Small | Only way to know if support actually worked |
| Pre-breach alerting (80%) | Zendesk | Small | Catch SLA misses before they happen |
| Richer hand-off note | Intercom | Small | Staff never start blind after AI escalation |
| Visible owner in queue list | Front | Small | Accountability at a glance |
| In-product ticket list (BloomSites/POS) | Help Scout | Medium | Clients need to track their requests |
| Knowledge search at intake | Help Scout | Medium | Deflect tickets when answer exists |
| Client-tier priority routing | Gorgias | Medium | High-value clients get faster help |
| Shared-problem detection | (custom) | Medium | Batch-communicate widespread bugs |
| Operational context (peak hours) | Gorgias | Large | Weight support urgency by business impact |
