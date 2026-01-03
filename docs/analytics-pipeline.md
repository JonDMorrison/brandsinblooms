# Email Analytics Pipeline

This document describes the email analytics system, including event ingestion, link tracking, suppression management, and metrics recomputation.

## Overview

The analytics pipeline processes email events from providers (e.g., Resend) and provides accurate, tenant-isolated metrics for campaigns. Key features include:

- **Idempotent ingestion**: Duplicate events are safely ignored
- **MPP adjustment**: Apple Mail Privacy Protection opens are flagged
- **Link tracking**: All campaign links are tracked with per-link CTR
- **Suppression enforcement**: Bounced/complained/unsubscribed contacts are excluded from sends
- **Derived metrics**: Metrics are computed from events, not mutated counters

## Event Contract

### email_tracking_events Table

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `tenant_id` | uuid | Tenant isolation |
| `campaign_id` | uuid | Associated campaign |
| `customer_email` | text | Recipient email |
| `event_type` | text | sent, delivered, open, click, bounce, complaint, unsubscribed |
| `provider_message_id` | text | Provider's unique message ID |
| `event_ts_provider` | timestamptz | When event occurred per provider |
| `ingested_at` | timestamptz | When we received it |
| `is_mpp_guess` | boolean | True if suspected Apple MPP auto-open |
| `link_id` | uuid | For click events, the tracked link |
| `ip_hash` | text | Hashed IP (never raw) |
| `user_agent` | text | Browser/client user agent |

### Idempotency Key

The unique constraint is: `(tenant_id, provider_message_id, event_type, event_ts_provider)`

This ensures the same event from the provider is only stored once, even if the webhook fires multiple times.

## Webhook Behavior

### Endpoint

`POST /functions/v1/email-tracking-webhook`

### Signature Verification

The webhook verifies the `svix-signature` header against the webhook secret. Invalid signatures return 400.

### Processing Steps

1. Parse incoming webhook payload
2. Extract event type and metadata
3. Detect MPP opens heuristically (Apple Mail + Apple Private Relay IP)
4. Hash IP address for privacy
5. Upsert event with idempotency key (ignores duplicates)
6. For bounces/complaints/unsubscribes: upsert into `suppression_list`
7. Return 200 OK

### Error Handling

- Invalid signature: 400 Bad Request
- Missing required fields: 400 Bad Request
- Database errors: 500 (logged, event may retry)

## Link Rewrite Flow

### At Send Time

1. Extract all `<a href="...">` links from email HTML
2. Check each URL for PII patterns (email=, phone=, etc.)
3. If PII detected: skip rewriting, log warning
4. Upsert URL into `tracked_links` table, get `link_id`
5. Replace href with tracking URL: `/functions/v1/redirect-click?cid={campaign_id}&lid={link_id}&rid={recipient_id}&t={tenant_id}`
6. Append UTM parameters if not present

### On Click

1. `redirect-click` edge function receives click
2. Looks up `link_id` to get destination URL
3. Records click event in `email_tracking_events`
4. 302 redirects to destination

### PII Guard

URLs matching these patterns are NOT rewritten:
- `?email=`, `?e=`, `?phone=`, `?tel=`, `?name=`
- Merge tags like `{{email}}`, `{{first_name}}`

A warning is logged and included in the send report.

## Suppression Reasons

| Reason | Source | Effect |
|--------|--------|--------|
| `unsubscribed` | User clicked unsubscribe | Excluded from all future sends |
| `bounced` | Email bounced (hard) | Excluded from all future sends |
| `complaint` | User marked as spam | Excluded from all future sends |

### Send-Time Exclusion

When building the recipient list for a campaign send:

```sql
WHERE NOT EXISTS (
  SELECT 1 FROM suppression_list s
  WHERE s.tenant_id = c.tenant_id
    AND s.customer_id = c.id
)
```

The count of excluded recipients is stored in `crm_campaigns.metrics.skipped_suppressed`.

## Recompute and Backfill

### Recompute Metrics

`POST /functions/v1/recompute-campaign-metrics`

```json
{
  "campaignId": "uuid"
}
```

This:
1. Reads all events for the campaign from `email_tracking_events`
2. Computes totals (sent, delivered, opens, clicks, bounces, complaints, unsubscribes)
3. Computes rates (open_reported, open_adjusted, click, bounce, complaint)
4. Identifies top 5 links by clicks
5. Updates `crm_campaigns.metrics` JSONB
6. Sets `rollup_refreshed_at = now()`

### Backfill from Provider

`POST /functions/v1/backfill-provider-events`

```json
{
  "campaignId": "uuid",
  "startDate": "optional ISO date",
  "endDate": "optional ISO date"
}
```

This:
1. Fetches events from the provider API (if available)
2. Upserts them idempotently
3. Calls recompute
4. Returns parity check (before vs after counts)

## Health Thresholds

| Metric | Green | Yellow | Red | Action |
|--------|-------|--------|-----|--------|
| Webhook 5xx rate | < 1% | 1-5% | > 5% | Check edge function logs |
| Ingest lag | < 2 min | 2-10 min | > 10 min | Check webhook delivery |
| Complaint rate (30d) | < 0.1% | 0.1-0.3% | > 0.3% | Review list hygiene |
| Hard bounce rate (30d) | < 2% | 2-5% | > 5% | Clean email list |

## Parity Check Rules

After backfill or recompute, compare metrics before and after:

- **Acceptable delta**: ≤ 0.1% difference in any metric
- **Warning (yellow)**: 0.1-1% difference
- **Alert (red)**: > 1% difference

If parity fails, investigate:
1. Are there duplicate events that weren't deduplicated?
2. Are webhook events delayed or missing?
3. Is there a timezone/timestamp issue?

## Recovery Runbook

### Events Not Arriving

1. Check webhook endpoint is active in Resend dashboard
2. Verify webhook secret matches `RESEND_WEBHOOK_SECRET`
3. Check edge function logs for errors
4. Try backfill from provider

### Metrics Seem Wrong

1. Run recompute for the campaign
2. Check parity: if delta > 1%, investigate events
3. Verify no duplicate campaigns or cross-tenant leakage

### High Bounce/Complaint Rate

1. Stop sending immediately
2. Export recent bounces/complaints
3. Cross-reference with import source
4. Clean list before resuming
5. Consider re-verification of old contacts

### Stale Metrics

1. Check `rollup_refreshed_at` on campaign
2. If older than latest event, run recompute
3. If auto-refresh not working, check real-time subscription

## Security

- All queries are tenant-scoped via RLS
- IP addresses are hashed, never stored raw
- PII patterns in links are detected and blocked
- Webhook signatures are verified
- Admin endpoints require authentication

## Database Indexes

```sql
-- Idempotency
CREATE UNIQUE INDEX idx_email_tracking_events_provider_idempotency 
ON email_tracking_events (tenant_id, provider_message_id, event_type, event_ts_provider)
WHERE provider_message_id IS NOT NULL AND event_ts_provider IS NOT NULL;

-- Query performance
CREATE INDEX idx_email_tracking_events_campaign 
ON email_tracking_events (tenant_id, campaign_id, event_type, created_at);

-- Tracked links lookup
CREATE INDEX idx_tracked_links_campaign 
ON tracked_links (tenant_id, campaign_id);
```

## Monitoring

Visit `/admin/analytics-health` to see:
- Ingest lag
- Complaint and bounce rates
- Webhook status
- Stale campaigns needing recompute
