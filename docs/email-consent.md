# Email Consent Management System

BloomSuite implements a tri-state email consent system to ensure compliant email marketing.

## Overview

The system differentiates between three consent states:
- **Opted In** (`email_opt_in = true`): Customer explicitly agreed to marketing emails
- **Opted Out** (`email_opt_in = false`): Customer explicitly declined marketing emails  
- **Unknown** (`email_opt_in = null`): No consent recorded (e.g., imported from POS/purchases)

## Database Schema

### crm_customers table
The `email_opt_in` column uses nullable boolean:
- `true` → explicitly opted in
- `false` → explicitly opted out
- `null` → no consent recorded

Related columns:
- `email_opt_in_at` - Timestamp when consent was given
- `email_consent_source` - Source of consent (e.g., 'opt_in_landing_page', 'admin_panel')
- `email_consent_ip` - IP address when consent was recorded

### crm_email_consent_events table
Audit log for all consent changes:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | FK to tenants |
| customer_id | uuid | FK to crm_customers |
| email | text | Denormalized email snapshot |
| event_type | text | 'opt_in', 'opt_out', 'opt_in_request_sent', 'imported_unknown', 'updated_by_admin' |
| source | text | Origin of the event |
| user_agent | text | Browser user agent |
| ip_address | text | IP address |
| created_at | timestamp | Event timestamp |

### crm_email_preference_tokens table
Secure tokens for preference links:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | FK to tenants |
| customer_id | uuid | FK to crm_customers |
| email | text | Email address |
| token | text | Unique secure token |
| purpose | text | Token purpose (e.g., 'opt_in_request') |
| expires_at | timestamp | Token expiration |
| created_at | timestamp | Creation timestamp |

## How Consent Works

### For Imported Contacts
When customers are imported from POS, CSV, or integrations:
1. `email_opt_in` is set to `null`
2. An `imported_unknown` event is recorded
3. They cannot receive marketing emails until they opt in

### Opt-In Request Flow
1. Admin views "Email Consent Management" in CRM
2. System shows count of contacts with unknown consent
3. Admin clicks "Send Opt-In Request"
4. System sends permission request emails with tokenized links
5. Contacts click link to choose their preference
6. System records consent and event

### Campaign Enforcement
Campaigns automatically filter recipients:
```sql
WHERE email IS NOT NULL AND email_opt_in = true
```

Contacts with `null` or `false` are excluded.

## UI Components

### Email Consent Manager (`/crm/consent`)
- Shows consent statistics (total, opted in, opted out, unknown)
- Progress bar for consent coverage
- Button to send opt-in requests

### Customer Detail View
- Current consent status badge
- Consent history timeline
- Manual consent update (admin only)

### Campaign Composer
- Warning banner showing excluded contacts
- Option to send opt-in request to excluded contacts

### Email Preferences Page (`/email-preferences`)
Public page for customers to update preferences:
- Validates token from URL
- Shows subscribe/unsubscribe options
- Records consent change with IP and user agent

## Helper Functions

### TypeScript (`src/lib/crm/emailConsent.ts`)

```typescript
// Get status from customer object
getEmailConsentStatus(customer) // 'opted_in' | 'opted_out' | 'unknown'

// Record consent event
recordEmailConsentEvent({ tenantId, customerId, email, eventType, source })

// Update customer consent
updateCustomerConsent({ tenantId, customerId, email, optIn, source })

// Get consent statistics
getConsentStats(tenantId)

// Get unknown consent customers
getUnknownConsentCustomers(tenantId, limit)

// Get customer consent history
getCustomerConsentHistory(customerId)

// Generate preference token
generatePreferenceToken({ tenantId, customerId, email })

// Validate preference token
validatePreferenceToken(token)
```

### Database (`get_email_consent_stats`)
```sql
SELECT * FROM get_email_consent_stats(tenant_id);
-- Returns: total_customers, opted_in_count, opted_out_count, unknown_count
```

## Edge Functions

### send-opt-in-request
Sends opt-in request emails to contacts with unknown consent.

### validate-preference-token
Validates tokens for the email preferences page.

### update-email-preference
Updates customer consent from preferences page.

## Best Practices

1. **Never send marketing to unknown/opted-out**: The system enforces this automatically
2. **Record all consent changes**: Always use `recordEmailConsentEvent()`
3. **Include source information**: Track where consent originated
4. **Capture IP/user agent**: For audit compliance
5. **Use tokens with expiration**: 30-day default expiry for security
