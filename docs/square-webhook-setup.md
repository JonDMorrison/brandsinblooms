# Square Webhook Setup Guide

This guide explains how to configure Square webhooks to trigger real-time automations in BloomSuite.

## Overview

Square webhooks enable real-time event processing for:
- **Payment Completed** → Triggers purchase follow-up automations
- **Customer Created** → Syncs new customers to CRM
- **Customer Updated** → Keeps customer data in sync

## Prerequisites

- A Square Developer account
- A BloomSuite account with Square integration enabled
- Access to the Square Developer Console

## Step 1: Access Square Developer Console

1. Go to [Square Developer Dashboard](https://developer.squareup.com/apps)
2. Select your application (Production or Sandbox)
3. Navigate to **Webhooks** in the left sidebar

## Step 2: Add Webhook Subscription

### Webhook URL
```
https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/square-webhook-handler
```

### Configuration
1. Click **Add Subscription**
2. Enter the webhook URL above
3. Select API Version: **Latest**
4. Choose events to subscribe to:
   - ✅ `payment.completed`
   - ✅ `customer.created`
   - ✅ `customer.updated`
   - ✅ `refund.created` (optional)

## Step 3: Copy Webhook Signature Key

1. After creating the subscription, Square will generate a **Signature Key**
2. Copy this key - you'll need it for the next step
3. **Important**: Keep this key secure, never share it publicly

## Step 4: Add Secret to Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/udldmkqwnxhdeztyqcau/settings/functions)
2. Navigate to **Settings** → **Edge Functions** → **Secrets**
3. Add a new secret:
   - **Name**: `SQUARE_WEBHOOK_SIGNATURE_KEY`
   - **Value**: (paste the signature key from Square)
4. Click **Save**

## Step 5: Test the Webhook

### Using Square Sandbox
1. In Square Developer Console, switch to your **Sandbox** app
2. Configure the same webhook URL
3. Use the Square Sandbox to create test transactions
4. Check the webhook logs in Supabase

### Manual Test with cURL
```bash
curl -X POST https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/square-webhook-handler \
  -H "Content-Type: application/json" \
  -d '{
    "merchant_id": "YOUR_MERCHANT_ID",
    "type": "payment.completed",
    "event_id": "test-event-123",
    "created_at": "2025-12-04T10:00:00Z",
    "data": {
      "type": "payment",
      "id": "test-payment-123",
      "object": {
        "payment": {
          "id": "test-payment-123",
          "amount_money": { "amount": 2500, "currency": "USD" },
          "receipt_email": "test@example.com",
          "status": "COMPLETED"
        }
      }
    }
  }'
```

## Event Flow

```
Square Payment → Webhook → BloomSuite → Automation Triggered
     ↓              ↓           ↓              ↓
  Customer    merchant_id    tenant      Email/SMS
  pays at POS   lookup       found       scheduled
```

### Detailed Flow:
1. Customer completes purchase at Square POS
2. Square sends `payment.completed` webhook to BloomSuite
3. Webhook handler:
   - Verifies signature (security)
   - Looks up `merchant_id` → `tenant_id` mapping from `square_connections`
   - Creates/updates order in `pos_orders`
   - Creates/updates customer in `crm_customers`
   - Fires automation triggers (`order.completed`, `first_purchase`)
4. Matching automations schedule messages to `crm_outbox`
5. Queue worker sends scheduled messages

## Supported Events

| Square Event | BloomSuite Action |
|--------------|-------------------|
| `payment.completed` | Upsert order, update customer, fire `order.completed` trigger |
| `customer.created` | Create customer in CRM |
| `customer.updated` | Update customer details |
| `refund.created` | (Future) Update order status |

## Automation Triggers

The webhook can trigger these automation types:

### `order.completed`
- Fires for **every** purchase
- Use for: Thank you messages, order confirmations, loyalty point notifications

### `first_purchase`
- Fires only for customer's **first** purchase
- Use for: Welcome series, first-time buyer discounts, onboarding

### `review_request`
- Scheduled 5 days after purchase
- Use for: Review requests, feedback collection

## Troubleshooting

### Webhook Not Receiving Events
1. Verify the webhook URL is correct in Square Console
2. Check that events are enabled (payment.completed, customer.created)
3. Ensure the Square app (Production/Sandbox) matches your environment

### Signature Verification Failing
1. Verify `SQUARE_WEBHOOK_SIGNATURE_KEY` is correctly set in Supabase
2. Ensure no extra whitespace in the secret
3. Check Square Console for the correct signature key

### Merchant Not Found
1. Verify the user has completed Square OAuth connection
2. Check `square_connections` table for the merchant_id
3. Ensure connection status is "connected"

### Automations Not Triggering
1. Verify automation is active (`is_active = true`)
2. Check automation `trigger_type` matches (`order.completed` or `first_purchase`)
3. Verify customer has email (for email) or phone (for SMS)
4. Check `crm_automation_logs` for queued messages

## Monitoring

### Check Webhook Logs
```sql
-- Recent webhook events (check Supabase Edge Function logs)
-- Go to: Supabase Dashboard → Edge Functions → square-webhook-handler → Logs
```

### Check Automation Events
```sql
SELECT * FROM automation_events 
WHERE event_type = 'triggered'
ORDER BY created_at DESC 
LIMIT 20;
```

### Check Queued Messages
```sql
SELECT * FROM crm_outbox 
WHERE automation_id IS NOT NULL
ORDER BY created_at DESC 
LIMIT 20;
```

## Security Notes

- **Signature Verification**: All webhooks are verified using HMAC-SHA256
- **Tenant Isolation**: Each webhook is routed to the correct tenant via merchant_id
- **No JWT Required**: Square webhooks don't include JWT tokens, so the endpoint is public but signature-protected

## FAQ

**Q: Do I need to set this up for each user?**
A: No! You set up the webhook once in Square Developer Console. When users connect via OAuth, their `merchant_id` is stored in `square_connections`, and webhooks are automatically routed to their tenant.

**Q: What happens if a user disconnects Square?**
A: Webhooks for their merchant_id will return "Merchant not connected" and be ignored.

**Q: Can I use both Sandbox and Production?**
A: Yes, but you need separate webhook subscriptions in each Square app (Sandbox and Production) pointing to the same webhook URL.
