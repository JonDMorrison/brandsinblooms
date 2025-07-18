# Resend Webhook Setup for CRM Campaign Analytics

## Overview
This webhook processes Resend email events (opens, clicks, deliveries) and updates CRM campaign analytics in real-time.

## 🔗 Webhook Endpoint
```
POST https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/email-tracking-webhook
```

## 🔒 Security Configuration

### 1. Set Webhook Secret (Optional but Recommended)
In your Supabase project secrets, add:
```bash
RESEND_WEBHOOK_SECRET=your_webhook_secret_here
```

### 2. Configure Resend Webhook
In your Resend dashboard:
1. Go to **Webhooks** section
2. Add new webhook with URL above
3. Select events: `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`
4. Set secret (if using signature verification)

## 📊 Supported Events

| Resend Event | Our Event Type | Description |
|--------------|----------------|-------------|
| `email.sent` | `sent` | Email was sent |
| `email.delivered` | `delivered` | Email was delivered |
| `email.delivery_delayed` | `delivered` | Email delayed but will be delivered |
| `email.opened` | `opened` | Email was opened |
| `email.clicked` | `clicked` | Link in email was clicked |
| `email.bounced` | `bounced` | Email bounced |
| `email.complained` | `unsubscribed` | Spam complaint (treated as unsubscribe) |

## 🏗️ Payload Structure

Expected webhook payload from Resend:
```json
{
  "type": "email.opened",
  "created_at": "2025-07-18T20:30:00Z",
  "data": {
    "email_id": "abc123",
    "to": ["customer@example.com"],
    "from": "noreply@bloomsuite.email",
    "subject": "Your Garden Newsletter",
    "headers": {
      "X-Campaign-ID": "campaign-uuid-123"
    },
    "tags": ["campaign:campaign-uuid-123", "type:bulk"],
    "open": {
      "timestamp": "2025-07-18T20:30:00Z"
    }
  }
}
```

## 🎯 Campaign ID Extraction

The webhook extracts campaign IDs in this priority order:
1. **Headers**: `X-Campaign-ID` (preferred)
2. **Tags**: `campaign:uuid` format (fallback)

## 📈 Metrics Calculation

After each event, the webhook automatically updates:

```sql
-- In crm_campaigns table
UPDATE crm_campaigns SET
  total_sent = (count of unique 'sent'/'delivered' events),
  total_opens = (count of unique 'opened' events),
  total_clicks = (count of unique 'clicked' events),
  open_rate = (total_opens / total_sent * 100),
  click_rate = (total_clicks / total_sent * 100),
  metrics = {
    "sent": total_sent,
    "delivered": total_delivered,
    "opened": total_opens,
    "clicked": total_clicks,
    "bounced": total_bounced,
    "unsubscribed": total_unsubscribed
  }
WHERE id = campaign_id;
```

## 🔄 Idempotency & Deduplication

The webhook prevents duplicate events by checking:
- Same `campaign_id`
- Same `customer_email`
- Same `event_type`
- Same `email_id`

Duplicate events return `200 OK` with message "Duplicate event ignored".

## 🧪 Testing

### Manual Testing
```bash
# Run the test script
node scripts/test-webhook.js
```

### Test with cURL
```bash
curl -X POST https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/email-tracking-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.opened",
    "created_at": "2025-07-18T20:30:00Z",
    "data": {
      "email_id": "test123",
      "to": ["test@example.com"],
      "from": "noreply@bloomsuite.email",
      "subject": "Test",
      "headers": {"X-Campaign-ID": "test-campaign-123"}
    }
  }'
```

## 📊 Database Schema

### email_tracking_events table
```sql
CREATE TABLE email_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  customer_email TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### crm_campaigns metrics fields
```sql
-- Additional fields in crm_campaigns
total_sent INTEGER DEFAULT 0,
total_opens INTEGER DEFAULT 0,
total_clicks INTEGER DEFAULT 0,
open_rate DECIMAL(5,2) DEFAULT 0.00,
click_rate DECIMAL(5,2) DEFAULT 0.00,
metrics JSONB DEFAULT '{}'
```

## 🚨 Error Handling

The webhook handles errors gracefully:

- **Invalid signature**: Returns `401 Unauthorized`
- **Missing campaign ID**: Returns `200 OK` (logs warning)
- **Unknown event type**: Returns `200 OK` (logs warning)
- **Database errors**: Returns `500 Internal Server Error`
- **Duplicate events**: Returns `200 OK` (idempotency)

## 📝 Monitoring

Check webhook performance:
1. **Supabase Edge Function Logs**: Monitor for errors and processing times
2. **Database**: Query `email_tracking_events` for recent events
3. **Campaign Metrics**: Verify `crm_campaigns` table updates

```sql
-- Check recent webhook events
SELECT * FROM email_tracking_events 
ORDER BY created_at DESC LIMIT 10;

-- Check campaign metrics
SELECT name, total_sent, total_opens, total_clicks, open_rate, click_rate 
FROM crm_campaigns 
WHERE sent_at IS NOT NULL;
```

## 🔧 Troubleshooting

### Common Issues

1. **Events not recording**: Check campaign ID in email headers
2. **Signature verification fails**: Verify `RESEND_WEBHOOK_SECRET`
3. **Metrics not updating**: Check database permissions and function logs
4. **High duplicate rate**: Verify Resend webhook configuration

### Debug Steps
1. Check Supabase function logs
2. Verify webhook payload structure
3. Test with manual curl requests
4. Check database constraints and RLS policies