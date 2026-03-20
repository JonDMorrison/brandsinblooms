# Email Analytics Pipeline

This document describes the email analytics system, including event ingestion, link tracking, suppression management, and metrics recomputation.

## Overview

The analytics pipeline processes email events from providers (e.g., Resend) and provides accurate, tenant-isolated metrics for campaigns. Key features include:

- **Idempotent ingestion**: Duplicate events are safely ignored
- **MPP adjustment**: Apple Mail Privacy Protection opens are flagged
- **Link tracking**: All campaign links are tracked with per-link CTR
- **Suppression enforcement**: Bounced/complained/unsubscribed contacts are excluded from sends
- **Derived metrics**: Metrics are computed from events, not mutated counters

## Engagement Policy

- `opened` and `clicked` use first-occurrence-only semantics in `email_tracking_events`.
- The first unique event for a recipient/message/campaign is recorded and drives campaign aggregates.
- A replay of the same webhook delivery is treated as a transport duplicate and returns `duplicate: true`.
- A second open/click for the same message with a different delivery id is treated as a business duplicate. The row insert is skipped, but campaign metric recomputation remains safe because metrics are derived from stored rows.

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
| `event_data.email_id` | text | Normalized semantic message id used by the recipient-level uniqueness index |
| `is_mpp_guess` | boolean | True if suspected Apple MPP auto-open |
| `link_id` | uuid | For click events, the tracked link |
| `ip_hash` | text | Hashed IP (never raw) |
| `user_agent` | text | Browser/client user agent |

### Normalization Rules

- `provider_message_id`: extracted from the Resend payload across known shapes such as `data.email_id`, nested `data.email.id`, or nested message ids.
- `event_ts_provider`: uses the provider timestamp when present; otherwise falls back to the webhook receipt timestamp captured at request start.
- `event_data.email_id`: never left blank for new webhook rows. If Resend omits the semantic message id, the webhook derives it from `provider_message_id + ':' + event_type`.
- `webhook_delivery_id`: prefers `x-retry-delivery-id`, then `svix-id`, then `webhook-id`, then `x-request-id`, then a deterministic fallback derived from message id, event type, and provider timestamp.

### Idempotency Keys

The pipeline uses three complementary uniqueness layers:

- `(webhook_delivery_id)` for transport-level replay protection
- `(tenant_id, provider_message_id, event_type, event_ts_provider)` for provider-level duplicate events
- `(campaign_id, customer_email, event_type, event_data.email_id)` for recipient/message-level unique engagement semantics

This ensures the same event from the provider is only stored once, while still allowing distinct event types for the same message to ingest independently.

## Webhook Behavior

### Endpoint

`POST /functions/v1/email-tracking-webhook`

### Signature Verification

The webhook verifies the `svix-signature` header against the webhook secret. Invalid signatures return 400.

### Processing Steps

1. Parse incoming webhook payload
2. Normalize event type, message id, provider timestamp, and webhook delivery id across Resend payload variants
3. Detect MPP opens heuristically (Apple Mail + Apple Private Relay IP)
4. Hash IP address for privacy
5. Insert event with idempotency protections
6. For bounces/complaints/unsubscribes: upsert into `suppression_list`
7. Return 200 OK

### Duplicate Handling

- `webhook_delivery_id` conflict: true delivery replay, return `duplicate: true`, skip downstream work.
- semantic/provider conflict: business duplicate such as a second open or click for the same message. The insert is skipped, structured logs include the violated constraint, and campaign metrics may be recomputed because that path is idempotent.
- domain counters are not re-run on business duplicates because they are increment-based, not recomputed.

### Error Handling

- Invalid signature: 400 Bad Request
- Missing required fields: 400 Bad Request
- Database errors: 500 (logged, event may retry)

## Link Rewrite Flow

### At Send Time

1. Extract all `<a href="...">` links from email HTML
2. **Skip non-trackable links**:
   - `mailto:`, `tel:`, `sms:`, `data:`, `javascript:` protocols
   - Fragment-only links (`#anchor`)
   - Unsubscribe/manage-preferences URLs (matches `/unsubscribe|manage[-_]prefs/i`)
3. Check each URL for PII patterns
4. If PII detected: skip rewriting, log warning, include in send report
5. Upsert URL into `tracked_links` table, get `link_id`
6. Replace href with tracking URL: `/functions/v1/redirect-click?cid={campaign_id}&lid={link_id}&rid={recipient_id}&t={tenant_id}`
7. Append UTM parameters if not present (preserves existing UTMs)

### On Click (redirect-click)

1. Validate all UUID parameters (cid, lid, rid, t)
2. Check rate limit (60 requests/min per IP)
3. Look up `link_id` to get destination URL (tenant-scoped)
4. Record click event in `email_tracking_events`
5. 302 redirect to destination with security headers:
   - `Cache-Control: no-store`
   - `X-Robots-Tag: noindex`

### PII Guard

URLs matching these patterns are NOT rewritten:
- Query params: `?e=`, `?u=`, `?email=`, `?email_id=`, `?subscriber=`, `?phone=`, `?msisdn=`
- Merge tags: `{{email}}`, `{{first_name}}`, `{recipient.email}`, `{recipient.*}`
- URL-encoded variants

A warning is logged and included in the send report (`pii_warnings` count).

### Skipped Link Types

The following are never tracked:
- `mailto:` links
- `tel:` links
- `sms:` links
- `data:` URIs
- `javascript:` links
- Fragment-only links (`#section`)
- Unsubscribe/preference management links

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

## Outage Recovery Runbook

### Scenario 1: Webhook Not Receiving Events

**Symptoms**: Ingest lag > 10 minutes, no new events in `email_tracking_events`

**Steps**:
1. Check Resend dashboard for webhook delivery status
2. Verify webhook URL is correct and accessible
3. Check edge function logs at `/admin/analytics-health` or Supabase dashboard
4. If webhook endpoint was down:
   - Run backfill for affected campaigns: `POST /functions/v1/backfill-provider-events`
   - Verify parity check shows ≤ 0.1% delta
5. If signature verification failing:
   - Verify `RESEND_WEBHOOK_SECRET` is correctly set in Supabase secrets
   - Check for secret rotation on Resend side

### Scenario 2: High Complaint/Bounce Rates

**Symptoms**: Complaint rate > 0.3% or bounce rate > 5%

**Immediate Actions**:
1. **STOP ALL SENDING** immediately
2. Export recent bounces and complaints from `email_tracking_events`
3. Cross-reference with import source to identify problematic list segments
4. Remove offending contacts from future sends

**Recovery**:
1. Audit import process for the affected contacts
2. Implement double opt-in for new signups
3. Consider re-verification of old contacts (> 6 months inactive)
4. Resume sending with a small test segment first
5. Monitor rates closely for 24-48 hours

### Scenario 3: Metrics Drift (Parity Check Fails)

**Symptoms**: Parity check shows > 1% delta on any metric

**Steps**:
1. Run recompute for the affected campaign
2. If delta persists:
   - Check for duplicate `provider_message_id` values (shouldn't exist due to unique constraint)
   - Look for timezone issues in `event_ts_provider`
   - Verify no cross-tenant data leakage
3. Run backfill from provider to sync missing events
4. If still failing, check for:
   - Database constraint violations in logs
   - RLS policy issues blocking event insertion

### Scenario 4: Link Clicks Not Recording

**Symptoms**: Zero clicks despite emails opened

**Steps**:
1. Verify links were rewritten at send time (check `tracked_links` table)
2. Test a tracking URL manually in browser
3. Check redirect-click edge function logs
4. Verify `tracked_links` table has correct `url` values
5. Check for rate limiting (429 responses in logs)

### Scenario 5: Edge Function Errors (5xx)

**Symptoms**: Webhook 5xx rate > 1%

**Steps**:
1. Check Supabase edge function logs
2. Look for:
   - Database connection issues
   - Timeout errors (function running > 60s)
   - Memory exhaustion
3. If database overloaded:
   - Check for missing indexes
   - Review query performance
4. Restart edge function deployment if stuck

## Security

- All queries are tenant-scoped via RLS
- IP addresses are hashed, never stored raw
- PII patterns in links are detected and blocked (with warning)
- Webhook signatures are verified
- Admin endpoints require authentication
- Rate limiting on redirect-click (60/min per IP)
- Security headers on redirects (noindex, no-store)

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
- Complaint and bounce rates (with 30-day sparklines)
- Webhook status
- Stale campaigns needing recompute
- Active alerts for threshold breaches
- Suppression breakdown by reason

## Alerting

Alerts are generated when thresholds are breached:
- Stored in memory during health page load
- Displayed prominently with severity (warning/critical)
- Include current value and threshold for comparison

Future: Store alerts in `analytics_alerts` table for historical tracking.
