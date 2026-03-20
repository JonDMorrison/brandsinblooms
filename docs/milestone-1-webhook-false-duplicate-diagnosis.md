# Milestone 1: Webhook False-Duplicate Diagnosis

## Objective

Identify the exact idempotency constraint causing legitimate first-occurrence `email.opened` and `email.clicked` Resend events to return `duplicate: true` before downstream aggregation runs.

## Status

- Milestone state: in progress
- Production writes: none
- Constraint changes: none
- Code changes: none
- Investigation scope: tenant-scoped only

## Verified Code Findings

### Early-return path

The legacy `email_tracking_events` insert in [supabase/functions/email-tracking-webhook/index.ts](supabase/functions/email-tracking-webhook/index.ts#L855) treats any `23505` as a duplicate and returns immediately at [supabase/functions/email-tracking-webhook/index.ts](supabase/functions/email-tracking-webhook/index.ts#L869).

That response path returns:

```json
{
  "ok": true,
  "duplicate": true,
  "event_type": "opened|clicked",
  "campaign_id": "...",
  "recipient": "...",
  "provider_message_id": "...",
  "webhook_delivery_id": "..."
}
```

Because the function returns from that branch, the following work is skipped:

- `updateCampaignMetrics(...)` in [supabase/functions/email-tracking-webhook/index.ts](supabase/functions/email-tracking-webhook/index.ts#L920)
- domain counters in [supabase/functions/email-tracking-webhook/index.ts](supabase/functions/email-tracking-webhook/index.ts#L927)
- suppression side effects in [supabase/functions/email-tracking-webhook/index.ts](supabase/functions/email-tracking-webhook/index.ts#L957)

### Payload extraction to storage columns

Current extraction logic in [supabase/functions/email-tracking-webhook/index.ts](supabase/functions/email-tracking-webhook/index.ts#L544):

| Resend field | Extraction | DB column / JSON path |
|---|---|---|
| `payload.data.email_id` | `const providerMessageId = payload.data.email_id` | `provider_message_id`, `event_data.email_id` |
| `payload.created_at` | `const eventTsProvider = payload.created_at` | `event_ts_provider`, `event_data.occurred_at` |
| `req.headers['svix-id']` or fallback chain | `const webhookDeliveryId = ...` | `webhook_delivery_id` |
| `payload.data.to[0]` | direct | `customer_email` |
| metadata headers/tags | `extractMetadata(...)` and `resolveGovernanceContext(...)` | `campaign_id`, `tenant_id`, `domain_id` |
| `payload.data.open.timestamp` | open-event augmentation | `event_data.open_timestamp` |
| `payload.data.click.timestamp` | click-event augmentation | `event_data.click_timestamp` |
| `payload.data.click.link` | click-event augmentation | `event_data.click_link` |

### Webhook delivery ID derivation

The current delivery-id chain in [supabase/functions/email-tracking-webhook/index.ts](supabase/functions/email-tracking-webhook/index.ts#L580) is:

```ts
req.headers.get('svix-id')
  || req.headers.get('webhook-id')
  || req.headers.get('x-request-id')
  || `${providerMessageId}:${payload.type}:${eventTsProvider}`
```

This means a false duplicate can come from either:

- header reuse across different event types, or
- an unexpected fallback collision, if headers are absent and the provider timestamps line up unexpectedly.

## Verified Schema Findings From Migrations

### Candidate index 1: webhook delivery ID

Defined in [supabase/migrations/20260314120000_fix_email_tracking_events_idempotency.sql](supabase/migrations/20260314120000_fix_email_tracking_events_idempotency.sql#L56):

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_tracking_events_webhook_delivery_id
ON public.email_tracking_events (webhook_delivery_id)
WHERE webhook_delivery_id IS NOT NULL;
```

### Candidate index 2: semantic event tuple

Defined in [supabase/migrations/20260314120000_fix_email_tracking_events_idempotency.sql](supabase/migrations/20260314120000_fix_email_tracking_events_idempotency.sql#L26):

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_tracking_events_idempotency
ON public.email_tracking_events (
  campaign_id,
  customer_email,
  event_type,
  ((event_data->>'email_id')::text)
)
WHERE event_data->>'email_id' IS NOT NULL;
```

### Candidate index 3: provider tuple

Defined in [supabase/migrations/20260103210202_05b16f9e-801c-4000-805e-7f3343a1fb82.sql](supabase/migrations/20260103210202_05b16f9e-801c-4000-805e-7f3343a1fb82.sql#L36):

```sql
CREATE UNIQUE INDEX idx_email_tracking_events_provider_idempotency
ON public.email_tracking_events (tenant_id, provider_message_id, event_type, event_ts_provider)
WHERE provider_message_id IS NOT NULL AND event_ts_provider IS NOT NULL;
```

### Null-key hypothesis status

Repository migration state does not currently support the simple NULL-collision theory for these three candidate indexes because:

- the semantic index excludes rows where `event_data->>'email_id' IS NULL`
- the provider tuple index excludes rows where `provider_message_id IS NULL` or `event_ts_provider IS NULL`
- the webhook delivery index excludes rows where `webhook_delivery_id IS NULL`
- no `NULLS NOT DISTINCT` clause has been found in the referenced migrations

This must still be verified against live production indexes before ruling it out.

## Resend Payload Shape Audit

### Official provider documentation

Resend documents the following top-level structure for `email.delivered`, `email.opened`, and `email.clicked`:

```json
{
  "type": "email.delivered|email.opened|email.clicked",
  "created_at": "ISO-8601",
  "data": {
    "email_id": "...",
    "created_at": "ISO-8601",
    "from": "...",
    "to": ["..."],
    "subject": "...",
    "tags": {
      "key": "value"
    }
  }
}
```

Event-specific additions documented by Resend:

- `email.opened`: `open.timestamp`
- `email.clicked`: `click.link`, `click.timestamp`, `click.ipAddress`, `click.userAgent`

### Repo-local assumptions

The repo’s fixtures in [scripts/test-webhook.js](scripts/test-webhook.js) and docs in [docs/webhook-setup.md](docs/webhook-setup.md) model the same basic envelope, but there is a documented-format mismatch worth verifying in live payloads:

- official Resend docs describe `tags` as an object
- repo fixtures also model legacy array-style headers/tags in some places

That mismatch is more likely to affect attribution than uniqueness, but the live payloads should be used as source of truth for this milestone.

## Evidence To Collect From Live Data

For each failing webhook, the investigation must capture:

1. the incoming payload and headers
2. the resolved tenant scope
3. the existing `email_tracking_events` row that collides
4. the exact live index definition that makes it collide
5. the successful `email.delivered` row for the same message and recipient

Use [scripts/dev/email-tracking-false-duplicate-audit.sql](scripts/dev/email-tracking-false-duplicate-audit.sql) to gather that evidence.

## Live Investigation Record

### Case 1: `email.opened`

- Recipient: `pending`
- Tenant: `pending`
- Campaign: `pending`
- Provider message ID: `pending`
- Event timestamp: `pending`
- Webhook delivery ID: `pending`
- Existing colliding row: `pending`
- Violated constraint: `pending`
- Root-cause classification: `pending`

### Case 2: `email.clicked`

- Recipient: `pending`
- Tenant: `pending`
- Campaign: `pending`
- Provider message ID: `pending`
- Event timestamp: `pending`
- Webhook delivery ID: `pending`
- Existing colliding row: `pending`
- Violated constraint: `pending`
- Root-cause classification: `pending`

## Decision Matrix

Use the live evidence to place the final outcome in one of these categories:

- `(a)` payload extraction issue causing null or malformed key values
- `(b)` live index uses `NULLS NOT DISTINCT`
- `(c)` delivery-level identifier reused across different event types
- `(d)` combination of the above

## Milestone 2 Fix Direction

Do not implement in this milestone. The final fix strategy should be selected only after the winning constraint and colliding key values are confirmed.

Likely fix directions to evaluate in Milestone 2:

- narrow duplicate handling so only the intended retry/idempotency path short-circuits downstream work
- distinguish delivery replay from engagement events for the same message
- correct payload extraction if live evidence shows malformed `email_id`, timestamp, or header mapping
- remove or replace any leftover coarse unique index if production drift is found