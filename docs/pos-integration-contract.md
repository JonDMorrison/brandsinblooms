# BloomSuite POS Integration Contract

> **Version**: 1.0  
> **Effective Date**: 2026-01-08  
> **Status**: MANDATORY for all POS integrations

---

## Overview

This document defines the **non-negotiable product contract** that ALL POS integrations in BloomSuite MUST implement. Users NEVER manage webhooks manually — BloomSuite handles everything automatically.

---

## Supported POS Systems

| POS | Status | Real-time Capable | Contract Compliant |
|-----|--------|-------------------|-------------------|
| **Square** | ✅ Active | ✅ Yes | ✅ Full |
| **Clover** | ⚠️ Partial | ⚠️ Manual only | ❌ Needs work |
| **Lightspeed** | ⚠️ Partial | ⚠️ Manual only | ❌ Needs work |
| **Shopify** | 🚧 Planned | ✅ Yes | 🚧 TBD |

---

## Contract Requirements

### 1. AUTOMATIC WEBHOOK ENABLEMENT

After POS authentication completes:
- BloomSuite MUST automatically create webhook subscriptions
- Users MUST NOT click any "Enable Webhooks" buttons
- Connection is incomplete until webhooks are configured

```typescript
// During OAuth callback, IMMEDIATELY after tokens stored:
await ensureWebhooks(connectionId);
```

---

### 2. SINGLE IDEMPOTENT FUNCTION

Every POS adapter MUST implement:

```typescript
// supabase/functions/_shared/webhooks/ensure{POS}Webhooks.ts

export interface EnsureWebhooksResult {
  success: boolean;
  verified: boolean;
  subscription_id: string | null;
  error: string | null;
  action: 'created' | 'updated' | 'verified' | 'failed';
  event_types?: string[];
}

export async function ensureWebhooks(
  supabase: SupabaseClient,
  connectionId: string
): Promise<EnsureWebhooksResult>
```

**Responsibilities:**
- Load POS credentials from connection
- List existing webhook subscriptions via POS API
- Match by notification URL + merchant/account ID
- Create subscription if missing
- Update subscription if event types changed
- Verify subscription exists after creation
- Persist state to `{pos}_connections` table
- Never create duplicates
- Safe to call multiple times

---

### 3. REQUIRED DATABASE COLUMNS

Every POS connection table MUST have these columns:

| Column | Type | Description |
|--------|------|-------------|
| `webhooks_subscribed` | `boolean` | Whether webhooks are confirmed active |
| `webhook_subscription_id` | `text` | POS-issued subscription ID |
| `webhooks_last_checked_at` | `timestamptz` | Last API verification timestamp |
| `webhook_last_error` | `text` | Last error message (nullable) |
| `last_webhook_received_at` | `timestamptz` | Last successful webhook event |
| `webhook_retry_count` | `integer` | Failed subscription attempts |
| `webhook_next_retry_at` | `timestamptz` | Next scheduled retry |

---

### 4. AUTO-SUBSCRIBE IN OAUTH CALLBACK

```typescript
// {pos}-oauth-callback/index.ts

// After tokens stored successfully:
const webhookResult = await ensureWebhooks(supabase, connectionId);

// Log result, do NOT fail OAuth if webhooks fail
// Background retry will handle it
if (!webhookResult.verified) {
  console.warn('[CALLBACK] Webhook setup pending retry:', webhookResult.error);
}
```

---

### 5. SELF-HEALING & RETRIES

BloomSuite MUST automatically retry when:
- `webhooks_subscribed = false`
- `webhook_next_retry_at <= now()`
- Retry count < MAX_RETRIES (10)

**Retry timing** (exponential backoff):
- Attempt 1: 5 minutes
- Attempt 2: 15 minutes
- Attempt 3: 45 minutes
- Attempt 4: 2 hours
- Attempt 5: 6 hours
- Attempt 6+: 24 hours

---

### 6. WEBHOOK HANDLER SIGNALING

ALL webhook handlers MUST:

```typescript
// ✅ CORRECT: Log AFTER signature verification
if (!signatureValid) {
  console.error('❌ SIGNATURE_FAILED');
  return new Response('Unauthorized', { status: 401 });
}

console.log('✅ SIGNATURE_OK | event_id:', eventId, '| type:', eventType, '| merchant:', merchantId);

// Update last_webhook_received_at
await supabase
  .from('{pos}_connections')
  .update({ last_webhook_received_at: new Date().toISOString() })
  .eq('id', connectionId);
```

---

### 7. SHARED DATA CONTRACT

ALL POS webhooks MUST update these tables:

```typescript
// pos_orders - Insert/upsert order data
await supabase.from('pos_orders').upsert({ ... });

// crm_customers - Update purchase dates
await supabase.from('crm_customers').update({
  last_purchase_date: currentDate,
  first_purchase_date: isFirst ? currentDate : existing,
  total_spent: existing + amount,
  lifetime_value: existing + amount,
});

// Fire automation triggers
await fireAutomationTriggers(supabase, tenantId, customerId, [
  'order.completed',
  'review_request',
  isFirstPurchase ? 'first_purchase' : null,
].filter(Boolean));
```

---

### 8. OUTBOX INTEGRATION

For real-time automations:

```typescript
// Enqueue to crm_outbox with status='queued'
await supabase.from('crm_outbox').insert({
  tenant_id,
  automation_id,
  customer_id,
  message_type: 'email' | 'sms',
  recipient,
  content,
  subject,
  scheduled_at,
  status: 'queued', // REQUIRED
});
```

---

### 9. UI REQUIREMENTS

**REMOVE from UI:**
- "Enable Webhooks" button
- "Register Webhooks" button
- Any manual webhook configuration

**SHOW in UI:**
- Real-time Sync Status: `Active` | `Issue detected` | `Configuring...`
- Last Event Received: timestamp or "Never"
- Last Verified: timestamp
- Error Message (if `webhook_last_error` exists)

---

### 10. ACCEPTANCE CRITERIA

A POS integration is **COMPLETE** only if:

1. ✅ POS connection completed (OAuth or API key)
2. ✅ `ensureWebhooks()` called automatically
3. ✅ Webhooks verified via POS API
4. ✅ `webhook_subscription_id` stored
5. ✅ Real POS purchase triggers webhook
6. ✅ Handler logs `SIGNATURE_OK`
7. ✅ `pos_orders` updated
8. ✅ `crm_customers.last_purchase_date` updated
9. ✅ Automation triggers fired
10. ✅ `crm_outbox` rows enqueued
11. ✅ Messages sent
12. ✅ `crm_message_logs.external_id` stored

**Simulation endpoints DO NOT count as proof.**

---

## Classification

| Status | Meaning |
|--------|---------|
| **✅ Full** | All 12 acceptance criteria met |
| **⚠️ Sync-only** | Imports data but no real-time webhooks |
| **❌ Import-only** | Manual CSV import only |

---

## File Structure

```
supabase/functions/
├── _shared/
│   └── webhooks/
│       ├── ensureSquareWebhooks.ts      ✅ Implemented
│       ├── ensureCloverWebhooks.ts      ❌ TODO
│       ├── ensureLightspeedWebhooks.ts  ❌ TODO
│       └── types.ts                      ❌ TODO
├── {pos}-oauth-callback/
│   └── index.ts                         # MUST call ensureWebhooks
├── {pos}-webhook-handler/
│   └── index.ts                         # MUST log SIGNATURE_OK
└── {pos}-webhook-health/
    └── index.ts                         # Background self-healing
```

---

## Implementation Checklist

### Square ✅
- [x] `ensureSquareWebhooks` function
- [x] Auto-subscribe in OAuth callback
- [x] Signature verification logging
- [x] `last_webhook_received_at` update
- [x] Health check function
- [x] UI status-only display
- [x] Database columns added

### Clover ❌
- [ ] Add webhook columns to `clover_connections`
- [ ] Create `ensureCloverWebhooks` function
- [ ] Auto-subscribe in OAuth callback
- [ ] Update webhook handler signaling
- [ ] Create health check function
- [ ] Update UI to status-only

### Lightspeed ❌
- [ ] Add webhook columns to `lightspeed_connections`
- [ ] Create `ensureLightspeedWebhooks` function
- [ ] Auto-subscribe in OAuth callback
- [ ] Update webhook handler signaling
- [ ] Create health check function
- [ ] Update UI to status-only

---

## Appendix: POS Webhook Capabilities

| POS | Webhook API | Events Available |
|-----|-------------|------------------|
| Square | ✅ Full | payment.*, order.*, customer.*, loyalty.* |
| Clover | ⚠️ Limited | Requires App Market setup |
| Lightspeed | ⚠️ Limited | Depends on version (R/X-Series) |
| Shopify | ✅ Full | orders/*, customers/*, products/* |

---

**Last Updated**: 2026-01-08  
**Maintained By**: BloomSuite Engineering
