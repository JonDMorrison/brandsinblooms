# Email Governance E2E Testing (Resend)

This runbook tests the Milestone 4 tenant-facing domain health/risk visibility end-to-end:

1) Campaign send → Resend delivery
2) Resend webhooks → Supabase Edge Function ingestion
3) Database writes (tracking, governance events, suppression)
4) Tenant UI updates:
   - **Domain Health Banner** across CRM pages + send confirmation modal
   - **Campaign Governance Risk** badge (4-tier mapping)

---

## Scope

### In scope
- Tenant Domain Health Banner renders and is consistent across CRM surfaces.
- 4-tier risk system uses backend **`reputation_tier`** + **`reputation_action`**:
  - `normal/allow` → Green
  - `throttled/throttle` → Yellow
  - `restricted/restrict` → Orange
  - `critical/block` → Red
- Webhook ingestion for delivered/bounced/complained/unsubscribed events.
- Auto-suppression behavior for **complaints**, **unsubscribes**, and **hard bounces**.

### Out of scope
- Admin/internal override source visibility (tenant UI should not show it; we only validate it’s not present).
- Full deliverability policy tuning/threshold calibration (varies by environment).

---

## Prerequisites

### Resend
- A verified sending domain (whatever your environment uses).
- A webhook configured for your Supabase project.

### Supabase Edge Functions deployed
- `email-tracking-webhook`
- `process-email-send-queue` (or whatever worker processes queued campaign sends in your environment)
- `cron-recompute-tenant-reputation` (optional, to force snapshot/score refresh)

### Secrets / env
- `RESEND_API_KEY` configured for send functions.
- `RESEND_WEBHOOK_SECRET` configured for `email-tracking-webhook` (recommended).
  - Dev-only bypass exists via `ALLOW_INSECURE_WEBHOOKS=true`.

### Webhook endpoint
See [docs/webhook-setup.md](webhook-setup.md) for the canonical endpoint URL format.

---

## Resend “Test Recipient” Addresses

Resend provides special `@resend.dev` recipients that simulate outcomes.

Use these (and plus-address variants) to generate deterministic events:

- Delivered:
  - `delivered@resend.dev`
  - `delivered+user1@resend.dev`
  - `delivered+user2@resend.dev`
- Bounced (hard/permanent):
  - `bounced@resend.dev`
  - `bounced+user1@resend.dev`
- Complained:
  - `complained@resend.dev`
  - `complained+user1@resend.dev`
- Suppressed:
  - `suppressed@resend.dev`

Notes:
- “Suppressed” often arrives as a **bounce** with bounce subtype “Suppressed”. In our ingestion, that still behaves like a bounce.
- Our webhook ingestion maps `email.delivery_delayed` to `deferred`.
- Our webhook ingestion does **not** explicitly map `email.suppressed` as a top-level event type; the “suppressed@resend.dev” flow should still be testable because it typically manifests as an `email.bounced` payload.

---

## Test Data Setup (CRM)

You want these events to be attributable to a tenant + campaign. The easiest way is to send a real campaign to test contacts.

1) In CRM Contacts, create contacts for each test recipient you plan to use:
   - `delivered@resend.dev`
   - `bounced@resend.dev`
   - `complained@resend.dev`
   - `suppressed@resend.dev`
2) Add them to a Segment (e.g. “Resend E2E Test Segment”).
3) Create a Campaign targeted at that segment.

---

## Scenario A — Baseline UI (Banner placement)

Goal: confirm the Domain Health Banner is present everywhere it should be, and that it doesn’t leak admin/internal details.

### Steps
1) Navigate to each CRM surface and confirm the banner renders:
   - Campaigns page
   - Segments page
   - Segments (Beta) page (both list and builder modes)
   - Email Sending Settings
   - Campaign Creator
2) Open the send confirmation modal and confirm the banner renders in **compact** mode.

### Expected
- Banner shows:
  - “Domain Health: …”
  - “Reputation Score: … / 100”
  - Bounce/Complaint Rate (24h)
- Compact version does **not** show the “Sending Status: …” line.
- No tenant UI surface shows admin/internal override reasons or sources.

---

## Scenario B — Delivered event (happy path)

Goal: verify a delivered event flows Resend → webhook → DB → campaign metrics.

### Steps
1) Ensure `delivered@resend.dev` is included as a contact in your target segment.
2) Send the campaign.
3) Wait for the queue worker to send messages (and Resend to emit webhooks).

### Verify in Resend
- In Resend dashboard/logs, you should see `email.sent` and `email.delivered` for that recipient.

### Verify in Supabase (SQL)
Run queries in the Supabase SQL editor (adjust IDs as needed):

- Recent tracking events:
```sql
select event_type, customer_email, provider_message_id, ingested_at
from email_tracking_events
where customer_email = 'delivered@resend.dev'
order by ingested_at desc
limit 20;
```

- Governance events (tenant-scoped):
```sql
select event_type, email, provider_message_id, ingested_at
from email_governance_email_events
where email = 'delivered@resend.dev'
order by ingested_at desc
limit 20;
```

- Campaign message row (ensure it has a provider message id / resend id):
```sql
select id, campaign_id, email, status, resend_id, updated_at
from email_messages
where email = 'delivered@resend.dev'
order by updated_at desc
limit 20;
```

### Expected
- At least one `sent` and one `delivered` event is visible in `email_tracking_events` and `email_governance_email_events`.
- `email_messages.resend_id` is populated.
- Campaign metrics update over time (depending on recompute strategy) and the campaign governance metrics card reflects non-zero sent/delivered.

---

## Scenario B2 — First open and replay protection

Goal: verify the first `email.opened` event is ingested, and a replay of the same webhook delivery id is treated as a true duplicate.

### Steps
1) Open the delivered test email once.
2) Capture the webhook response and the delivery id from logs or the Resend dashboard.
3) Replay the exact same webhook delivery once using the same `svix-id` or `x-retry-delivery-id`.

### Verify in Supabase (SQL)
```sql
select event_type,
       customer_email,
       provider_message_id,
       webhook_delivery_id,
       event_ts_provider,
       event_data->>'email_id' as event_data_email_id,
       ingested_at
from email_tracking_events
where customer_email = 'delivered@resend.dev'
  and event_type = 'opened'
order by ingested_at desc
limit 20;
```

### Expected
- The first `opened` webhook returns `duplicate: false` and inserts a new row.
- Replaying the same delivery id returns `duplicate: true`.
- Structured logs show the duplicate path with `constraint_name = idx_email_tracking_events_webhook_delivery_id`.

---

## Scenario B3 — Click event and unique-engagement policy

Goal: verify the first `email.clicked` event is ingested and a later click for the same message follows first-occurrence-only semantics.

### Steps
1) Click one tracked link in the delivered test email.
2) Trigger a second click/open for the same recipient and provider message id using a new webhook delivery id.

### Verify in Supabase (SQL)
```sql
select event_type,
       customer_email,
       provider_message_id,
       webhook_delivery_id,
       event_ts_provider,
       event_data->>'email_id' as event_data_email_id,
       event_data->>'click_link' as click_link,
       ingested_at
from email_tracking_events
where customer_email = 'delivered@resend.dev'
  and event_type in ('opened', 'clicked')
order by ingested_at desc
limit 20;
```

### Expected
- The first `clicked` webhook returns `duplicate: false` and inserts a new row.
- A later open/click for the same message with a different delivery id follows Option A: no new unique row for that event type/message combination.
- Structured logs show a semantic or provider duplicate constraint, not the webhook-delivery constraint.
- Campaign metrics remain correct because they are recomputed from stored rows.

---

## Scenario C — Hard bounce (auto-suppress)

Goal: verify a hard bounce causes an event + auto-suppression.

### Steps
1) Include `bounced@resend.dev` in a campaign audience.
2) Send the campaign.

### Verify in Supabase (SQL)
- Bounced governance events:
```sql
select event_type,
       event_data->>'bounce_type' as bounce_type,
       event_data->>'bounce_severity' as bounce_severity,
       ingested_at
from email_governance_email_events
where email = 'bounced@resend.dev'
order by ingested_at desc
limit 20;
```

- Suppression list entry created:
```sql
select tenant_id, email, suppression_type, auto_suppressed, suppressed_at, lifted_at
from suppression_list
where email = 'bounced@resend.dev'
order by suppressed_at desc
limit 5;
```

### Expected
- A `bounced` event exists.
- `bounce_severity` is `hard` (or equivalent).
- `suppression_list` contains a row for the recipient with:
  - `suppression_type = 'bounced'`
  - `auto_suppressed = true`

---

## Scenario D — Complaint (auto-suppress)

Goal: verify complaints create events and suppress the recipient.

### Steps
1) Include `complained@resend.dev` in a campaign audience.
2) Send the campaign.

### Verify in Supabase (SQL)
- Complaint event:
```sql
select event_type,
       event_data->>'complaint_feedback_type' as feedback_type,
       ingested_at
from email_governance_email_events
where email = 'complained@resend.dev'
order by ingested_at desc
limit 20;
```

- Suppression list entry created:
```sql
select tenant_id, email, suppression_type, auto_suppressed, suppressed_at
from suppression_list
where email = 'complained@resend.dev'
order by suppressed_at desc
limit 5;
```

### Expected
- A `complained` event exists.
- `suppression_list.suppression_type` is `complaint` (this is the canonical type we write on complaint events).

---

## Scenario D2 — Delivery delayed fallback timestamp

Goal: verify `email.delivery_delayed` is recorded even when the provider timestamp is absent and the webhook must fall back to receipt time.

### Steps
1) Trigger or replay a delivery-delayed webhook in a test environment.
2) If the payload omits `created_at`, keep the request otherwise unchanged.

### Verify in Supabase (SQL)
```sql
select event_type,
       customer_email,
       provider_message_id,
       webhook_delivery_id,
       event_ts_provider,
       event_data->'normalization'->>'event_ts_provider_source' as event_ts_provider_source,
       ingested_at
from email_tracking_events
where customer_email = 'delivered@resend.dev'
  and event_type = 'deferred'
order by ingested_at desc
limit 20;
```

### Expected
- A `deferred` row exists in `email_tracking_events`.
- `event_ts_provider` is populated even when the provider omitted the original timestamp.
- `event_data.normalization.event_ts_provider_source` reports `receipt` for the fallback case.

---

## Scenario E — Suppressed recipient (bounce-like)

Goal: verify “suppressed” behaves as a bounce and results in suppression.

### Steps
1) Include `suppressed@resend.dev` in a campaign audience.
2) Send the campaign.

### Verify in Supabase (SQL)
```sql
select event_type,
       event_data->>'bounce_type' as bounce_type,
       event_data->>'bounce_message' as bounce_message,
       ingested_at
from email_governance_email_events
where email = 'suppressed@resend.dev'
order by ingested_at desc
limit 20;
```

```sql
select email, suppression_type, auto_suppressed, suppressed_at
from suppression_list
where email = 'suppressed@resend.dev'
order by suppressed_at desc
limit 5;
```

### Expected
- A `bounced` event exists (often with messaging indicating suppression).
- A `suppression_list` row exists with `suppression_type = 'bounced'`.

---

## Scenario F — Verify suppression enforcement on a second send

Goal: verify suppressed recipients are skipped on subsequent sends.

### Steps
1) After running Scenario C or D, create a new campaign targeting the same suppressed contact(s).
2) Send the campaign.

### Verify
- In `email_messages`, the suppressed recipient should not proceed normally.
  - The exact “skip” representation can vary by worker implementation.
- In Edge Function logs (`process-email-send-queue`), you should see skip logs tied to suppression.

Useful SQL to inspect the newest message rows:
```sql
select id, campaign_id, email, status, resend_id, error_message, updated_at
from email_messages
where email in ('bounced@resend.dev', 'complained@resend.dev')
order by updated_at desc
limit 50;
```

---

## Scenario G — Tenant banner risk/tier changes (refresh mechanics)

The Domain Health Banner reads from `get_tenant_email_health_dashboard(p_tenant_id)` which is based on reputation snapshots/scores.

Depending on your environment’s thresholds and recompute cadence, banner tier/action may not change immediately after a handful of events.

### What you can always verify
- Webhook events and suppression behavior (Scenarios B–F).
- Banner presence and rendering (Scenario A).

### If you need to force a refresh (staging/admin)
Option 1: Wait for scheduled recompute (if configured).

Option 2: Trigger `cron-recompute-tenant-reputation` (requires `x-task-signature` only if `CRON_SIGNING_SECRET` is set).

Example curl (no signature case):
```bash
curl -sS -X POST "https://<project-ref>.supabase.co/functions/v1/cron-recompute-tenant-reputation" \
  -H "Content-Type: application/json" \
  -d '{"page_size":200,"max_pages":10}'
```

After recompute, verify the tenant dashboard row:
```sql
select *
from get_tenant_email_health_dashboard('<TENANT_ID>')
limit 1;
```

### Expected
- `reputation_score`, `reputation_tier`, and `reputation_action` reflect the latest snapshot/policy.
- UI badges map those values into the 4-tier risk display.

---

## Troubleshooting

### Webhook not writing rows
- Confirm Resend webhook URL points to the correct Supabase function endpoint.
- Confirm `RESEND_WEBHOOK_SECRET` matches what Resend is configured to sign with.
- Check Edge Function logs for `email-tracking-webhook` for signature errors or “unknown event type”.

### Events arrive but no tenant/campaign association
- Ensure you sent via the campaign send pipeline (not a “raw test email” function that doesn’t attach headers/tags).
- Confirm outbound sends include `X-Campaign-ID` / `X-Tenant-ID` headers or equivalent tags.

### Banner doesn’t change tiers
- This is often expected if thresholds require more volume.
- Force recompute in staging/admin (Scenario G), or wait for scheduled recompute.
