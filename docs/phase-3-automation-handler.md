# FormSubmitted Automation Handler — Technical Specification

**Phase:** 3  
**Status:** Implemented  
**Edge Function:** `process-form-submitted`

---

## Overview

Processes `form_submitted` events from `automation_trigger_events` and executes matching automations by queuing actions to `crm_outbox`.

---

## Supported Actions

| Action | Description | Consent Required |
|--------|-------------|------------------|
| `send_email` | Send email to customer immediately or after delay | ✅ Yes |
| `notify_staff` | Send notification to staff email(s) | ❌ No |
| `delay` | Wait specified time before next action | N/A |

---

## Execution Flow

```
┌─────────────────────────────────────┐
│  automation_trigger_events          │
│  event_type = 'form_submitted'      │
│  processed_at IS NULL               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  process-form-submitted             │
│  (edge function)                    │
│                                     │
│  1. Fetch unprocessed events        │
│  2. Match to active automations     │
│  3. Check trigger_conditions        │
│  4. Create automation_runs          │
│  5. Queue actions to crm_outbox     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  crm_outbox                         │
│  status = 'queued'                  │
│  scheduled_at = now + delay         │
└──────────────┬──────────────────────┘
               │
               │ (existing worker)
               ▼
┌─────────────────────────────────────┐
│  process-automation-outbox          │
│  Sends emails via Resend            │
└─────────────────────────────────────┘
```

---

## Delay Handling Mechanism

Delays are **persisted in the database**, not held in memory.

### How It Works

1. Delay nodes specify `delay_minutes`, `delay_hours`, or `delay_days`
2. Handler calculates cumulative delay for subsequent steps
3. Each action is queued with `scheduled_at = NOW() + cumulative_delay`
4. `process-automation-outbox` only picks up items where `scheduled_at <= NOW()`

### Example: 2-Hour Delay Email

```
Workflow: [send_email, delay(2h), send_email]

Step 0: scheduled_at = NOW()           → Sent immediately
Step 1: delay(2h)                      → No outbox entry, adds 2h to cumulative
Step 2: scheduled_at = NOW() + 2h      → Sent after 2 hours
```

### Database Proof

```sql
SELECT id, automation_node_id, scheduled_at, status
FROM crm_outbox
WHERE automation_run_id = 'run-uuid'
ORDER BY scheduled_at;

-- Result:
-- id       | node_id      | scheduled_at             | status
-- uuid-1   | email-1      | 2026-01-28 10:00:00      | sent
-- uuid-2   | email-2      | 2026-01-28 12:00:00      | queued  ← 2h later
```

---

## Consent Gating Logic

### Before Queuing Email

```typescript
const consentCheck = await canSendEmail(supabase, {
  tenantId,
  customerId,
  email: customerEmail,
});

if (!consentCheck.allowed) {
  // Log skip, continue to next step
  await logSkip(consentCheck.reason);
  continue;
}
```

### What `canSendEmail` Checks

1. **Email format** — Valid email syntax
2. **Suppression list** — Not bounced, complained, or manually suppressed
3. **Customer opt-out** — `opt_out !== true`
4. **Customer suppressed** — `suppressed !== true`  
5. **Email opt-in** — `email_opt_in !== false`

### Consent is Read-Only

The handler **never mutates** consent fields:

| Field | Read | Write |
|-------|------|-------|
| `email_opt_in` | ✅ | ❌ |
| `sms_opt_in` | ✅ | ❌ |
| `opt_out` | ✅ | ❌ |
| `suppressed` | ✅ | ❌ |

### Skip Reasons

| Reason | Description |
|--------|-------------|
| `opt_out` | Customer has opted out of all communications |
| `suppressed` | Customer is on suppression list |
| `bounced` | Previous hard bounce recorded |
| `complained` | Previous spam complaint recorded |
| `unsubscribed` | Customer unsubscribed from emails |
| `invalid_email` | Email format is invalid |
| `missing_email` | No email address available |

---

## Staff Notifications

Staff notifications bypass consent checks because:

1. They're sent to staff, not customers
2. Staff email addresses are configured by the tenant
3. They're operational, not marketing

```typescript
if (nodeType === "notify_staff") {
  // No consent check - send to staff immediately
  for (const staffEmail of node.data.notification_emails) {
    await queueEmail(staffEmail, ...);
  }
}
```

---

## Automation Matching

### Trigger Conditions

Automations can filter by specific forms:

```json
{
  "trigger_type": "form_submitted",
  "trigger_conditions": {
    "form_id": "specific-form-uuid"
  }
}
```

Or multiple forms:

```json
{
  "trigger_conditions": {
    "form_ids": ["form-1", "form-2", "form-3"]
  }
}
```

Or all forms (no conditions):

```json
{
  "trigger_conditions": null
}
```

---

## Error Handling

### Event Processing Errors

- Errors are logged to `automation_trigger_events.error_message`
- Event is still marked as processed (prevents infinite retry loops)
- Other events continue processing

### Action Queue Errors

- Queue failures are logged but don't stop automation
- Run is created even if some steps fail to queue
- `process-automation-outbox` handles retry logic for sends

---

## Observability

### Tables Written To

| Table | Purpose |
|-------|---------|
| `automation_trigger_events` | Mark events as processed |
| `automation_runs` | Track automation execution |
| `crm_outbox` | Queue email actions |
| `automation_email_executions` | Log skipped/sent emails |

### Audit Query

```sql
-- View all automation runs triggered by form submissions
SELECT 
  ar.id,
  ar.automation_id,
  a.name as automation_name,
  ar.customer_id,
  ar.status,
  ar.trigger_data->>'form_id' as form_id,
  ar.started_at
FROM automation_runs ar
JOIN crm_automations a ON a.id = ar.automation_id
WHERE ar.trigger_data->>'form_id' IS NOT NULL
ORDER BY ar.started_at DESC;
```

---

## Scheduling

This function should be called periodically via cron or invoked by a trigger.

### Recommended: Cron Schedule

```sql
-- Run every minute to process form submission events
SELECT cron.schedule(
  'process-form-submitted-events',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/process-form-submitted',
    headers := '{"Authorization": "Bearer <anon-key>"}'::jsonb
  );
  $$
);
```

---

*Document Version: 1.0*  
*Created: January 2026*
