# Email tracking architecture

Status: canonical reference, last updated 2026-05-07.
Audience: anyone debugging "why don't I see this email's stats" or extending the analytics surface.

This document is the source of truth for which tables and functions own each stage of the email-send-and-track pipeline. It exists because today (2026-05-07) the empty `email_send_log` table led to an "essential infrastructure missing" investigation that turned out to be misdirected — the infrastructure is live, just under different names.

## Canonical stores

| Stage | Table | What it holds |
|---|---|---|
| **Per-recipient send record** | `email_messages` | One row per recipient per campaign. Stores the rendered subject and HTML in `payload`, the recipient email, status (`queued` → `sending` → `sent` / `failed` / `paused`), `attempts`, and the `resend_id` returned by Resend after a successful API call. |
| **Worker queue** | `email_send_jobs` | Batch units claimed by `process-email-send-queue`. Each job covers up to 50 `email_messages` rows. |
| **Webhook event log** | `email_governance_email_events` | One row per webhook event from Resend (`sent`, `delivered`, `opened`, `clicked`, `bounced`, `complained`, `unsubscribed`). Linked to `email_messages` by `email_message_id` and to the campaign by `campaign_id`. |
| **Click registry** | `tracked_links` | One row per (campaign, original_url). Created by `send-email-campaign` before send so outbound links can be rewritten through `redirect-click`. |
| **Suppression** | `suppression_list`, `global_email_suppression_list`, `email_governance_suppression_events` | Bounce / complaint / manual-unsubscribe records. Read by the send pipeline before each send. |
| **Test sends** | `email_test_sends` | Audit log of one-off sends from `send-test-email-v2`. Test sends do NOT go into `email_messages`. |
| **Campaign rate aggregates** | `crm_campaigns.{total_sent, total_opens, total_clicks, open_rate, click_rate, metrics}` | Denormalised per-campaign rates, computed from `email_messages` + `email_governance_email_events`. Powers the analytics UI. |

### Vestigial — do not write to these
- `email_send_log` — **dropped** 2026-05-07.
- `email_click_events` — **deprecated** 2026-05-07 (table comment marks it). Click tracking goes to `email_governance_email_events` with `event_type='clicked'`. The cohort `track-email-click` function, `_shared/linkTracking.ts` helper, `useClickStats` hook, and `CampaignClickStats` component are all unmounted dead code awaiting follow-up cleanup.

## Functions

### Send path
| Function | Role |
|---|---|
| `send-email-campaign` | Operator-triggered. Resolves audience, creates `email_messages` rows, creates `email_send_jobs`, returns 200 with the queue plan. **Does not call Resend directly.** |
| `process-email-send-queue` | Cron'd every minute. Claims jobs, batches messages, calls `https://api.resend.com/emails/batch`, captures `resend_id` per recipient, marks `email_messages.status='sent'`. |
| `send-test-email-v2` | One-off test send. Calls Resend directly, logs to `email_test_sends`. Test sends are intentionally excluded from `email_messages` and analytics. |
| `auto-send-campaigns` | Cron'd. Picks scheduled campaigns and delegates to `send-email-campaign`. |

### Tracking path
| Function | Role |
|---|---|
| `email-tracking-webhook` | **The Resend webhook receiver.** 1,517 lines, validates Svix signature, parses all 7 event types, writes to `email_governance_email_events`, updates `email_messages.status` for `delivered`/`bounced`/`complained`, updates suppression tables. |
| `redirect-click` | Click tracking endpoint. Operator's outbound links are rewritten by `_shared/linkRewriter.ts` to `https://<project>.supabase.co/functions/v1/redirect-click?cid=...&lid=...&rid=...` so a click goes through here, gets recorded, then 302-redirects to the original URL. |

### Render path
| Function | Role |
|---|---|
| `render-email-preview` | Server-side preview renderer (used by the studio preview dialog). Same renderer as the send pipeline. |
| `render-email-merge-tags` | Merge-tag preview helper. |

## Resend webhook URL

The webhook URL configured in the Resend dashboard must point at:

```
https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/email-tracking-webhook
```

Events to enable: `email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`, `email.unsubscribed`.

The webhook validates Resend's Svix signature header so the signing secret (`RESEND_WEBHOOK_SECRET`) must be set in the edge function environment.

**Operator action:** Jon should verify the URL and event subscriptions are configured in the Resend dashboard. As of 2026-05-07 the webhook had ingested 89,719 events with the most recent ~1h before this doc, so the configuration is currently correct — this is just a "if you ever rotate the project / re-bootstrap a dashboard, here's the URL" reference.

## Data flow

```
Operator clicks Send
        │
        ▼
┌────────────────────────┐
│ send-email-campaign    │   queues per-recipient rows
│ (edge function)        │ ─────────────────────────────────►  email_messages (status='queued')
│                        │   creates batch jobs            ─►  email_send_jobs (status='pending')
│                        │   creates link rewrite map      ─►  tracked_links
└────────────────────────┘
        │
        ▼ (cron, every minute)
┌────────────────────────┐
│ process-email-send-    │   claims a job
│ queue (edge function)  │   batches messages
│                        │   POST https://api.resend.com/emails/batch
│                        │   captures resend_id            ─►  email_messages.resend_id, status='sent'
└────────────────────────┘
        │
        ▼
   Resend delivers email,
   recipient interacts (open / click / bounce / etc.)
        │
        ▼ (webhook, async)
┌────────────────────────┐
│ email-tracking-webhook │   validates Svix signature
│ (edge function)        │   parses event                  ─►  email_governance_email_events
│                        │   updates status                ─►  email_messages (delivered / bounced)
│                        │   updates suppression           ─►  suppression_list (on bounce / complaint)
│                        │   triggers rate aggregation     ─►  crm_campaigns.{total_*, *_rate}
└────────────────────────┘
        │
        ▼
   Analytics UI reads denormalised aggregates from crm_campaigns
   (CampaignAnalyticsDashboard, CampaignHistoryView)
```

Click path:

```
Recipient clicks a link in an email
        │
        ▼ (link was rewritten at send time by _shared/linkRewriter.ts)
┌────────────────────────┐
│ redirect-click         │   rate-limited (per-IP + per-campaign burst)
│ (edge function)        │   records click against tracked_links
│                        │   302-redirects to original URL
└────────────────────────┘
        │
        ▼
   Resend also separately fires a "clicked" webhook for the original
   send (because Resend offers click tracking on its own); that lands
   in email_governance_email_events with event_type='clicked'. Both
   paths populate per-campaign click counts.
```

## Rate aggregation

Campaign rates (`open_rate`, `click_rate`, `total_opens`, `total_clicks`, `total_sent`) are denormalised onto `crm_campaigns` so the analytics dashboard can read them in one query. They're computed from:

- **delivered count** ← `email_governance_email_events.event_type='delivered'`
- **unique opens** ← distinct `(campaign_id, customer_id)` from `event_type='opened'`
- **unique clicks** ← distinct `(campaign_id, customer_id)` from `event_type='clicked'`
- **bounce count** ← `event_type='bounced'`

The recompute is wired to fire after each webhook event ingest (sub-second freshness), with the entry point in `email-tracking-webhook` calling the `recompute_campaign_metrics_from_events` RPC. See the rate-aggregation commit for the SQL function.

## When something looks wrong

| Symptom | First thing to check |
|---|---|
| "Campaign sent but I don't see it in `email_send_log`" | This table no longer exists. Look in `email_messages` instead. |
| "Open rate stuck at 0 even though I see opens in the events table" | `email_governance_email_events` has the events but `crm_campaigns.open_rate` is denormalised — check whether the recompute trigger is firing. Run `SELECT recompute_campaign_metrics_from_events('<campaign_id>')` manually and re-check. |
| "Webhook isn't delivering events" | Check the Resend dashboard's webhook delivery log. The URL above is correct; signing secret must be set; the webhook handler validates Svix headers. |
| "Clicks aren't tracked" | Confirm the link in the rendered email is `/redirect-click?cid=...&lid=...`. If links go to the original URL directly, link rewriting didn't fire — check `_shared/linkRewriter.ts` was invoked during render. |
| "Test send didn't log anywhere" | Test sends go to `email_test_sends`, not `email_messages`. By design — test sends shouldn't pollute the recipient analytics. |
