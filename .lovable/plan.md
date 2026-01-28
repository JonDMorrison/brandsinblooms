
# Phase 0: Form Builder Database Schema

## Overview
This migration creates the foundational database tables for the Form Builder feature, following existing BloomSuite patterns for multi-tenancy, RLS, and compliance tracking.

---

## Table 1: `forms` (Form Definitions)

### Schema
```text
+------------------------+-------------------+------------------------------------------+
| Column                 | Type              | Notes                                    |
+------------------------+-------------------+------------------------------------------+
| id                     | UUID PK           | gen_random_uuid()                        |
| tenant_id              | UUID NOT NULL     | FK → tenants(id) ON DELETE CASCADE       |
| name                   | TEXT NOT NULL     | Form title for admin reference           |
| status                 | TEXT NOT NULL     | 'draft' | 'published' | 'archived'      |
| fields_json            | JSONB NOT NULL    | Array of field definitions (see below)   |
| settings_json          | JSONB NOT NULL    | Design tokens, success behavior, etc.    |
| compliance_json        | JSONB NOT NULL    | Consent requirements, default text       |
| embed_key              | TEXT UNIQUE       | Random 32-char hex for public access     |
| created_at             | TIMESTAMPTZ       | DEFAULT now()                            |
| updated_at             | TIMESTAMPTZ       | DEFAULT now()                            |
+------------------------+-------------------+------------------------------------------+
```

### Field Definition Structure (inside `fields_json`)
Each element in the array:
```json
{
  "id": "uuid",
  "type": "email | text | phone | select | checkbox | hidden | email_consent | sms_consent",
  "label": "string",
  "required": true,
  "placeholder": "string (optional)",
  "options": ["array for select type"],
  "mapping_key": "email | first_name | custom_field_key",
  "default_value": "optional",
  "rules": { "min_length": 2, "pattern": "regex (optional)" }
}
```

### Settings Structure (`settings_json`)
```json
{
  "success_message": "Thank you for subscribing!",
  "success_redirect_url": null,
  "submit_button_text": "Subscribe",
  "show_branding": true,
  "theme": { "primary_color": "#22C55E", "font_family": "Inter" },
  "notification_emails": ["owner@example.com"]
}
```

### Compliance Structure (`compliance_json`)
```json
{
  "email_consent_required": true,
  "email_consent_text": "I agree to receive marketing emails",
  "sms_consent_required": false,
  "sms_consent_text": "I agree to receive SMS messages",
  "double_opt_in": false,
  "gdpr_compliant": false
}
```

### Indexes
- `idx_forms_tenant_id` on `(tenant_id)`
- `idx_forms_embed_key` on `(embed_key)` (implicitly UNIQUE)
- `idx_forms_status` on `(tenant_id, status)`

### RLS Policies
1. **Authenticated users**: Full access to forms in their tenant (via users table join)
2. **Service role**: Full access for edge functions

---

## Table 2: `form_submissions` (Audit Trail)

### Schema
```text
+------------------------+-------------------+------------------------------------------+
| Column                 | Type              | Notes                                    |
+------------------------+-------------------+------------------------------------------+
| id                     | UUID PK           | gen_random_uuid()                        |
| tenant_id              | UUID NOT NULL     | FK → tenants(id) ON DELETE CASCADE       |
| form_id                | UUID NOT NULL     | FK → forms(id) ON DELETE CASCADE         |
| customer_id            | UUID NULLABLE     | FK → crm_customers(id) ON DELETE SET NULL|
| data                   | JSONB NOT NULL    | Raw submitted field values               |
| metadata               | JSONB NOT NULL    | page_url, referrer, utm_*, user_agent    |
| ip_hash                | TEXT NULLABLE     | SHA-256 hash of IP (privacy)             |
| result                 | TEXT NOT NULL     | 'accepted' | 'rejected_invalid' | etc.  |
| reason                 | TEXT NULLABLE     | Rejection reason if applicable           |
| submitted_at           | TIMESTAMPTZ       | DEFAULT now()                            |
+------------------------+-------------------+------------------------------------------+
```

### Metadata Structure
```json
{
  "page_url": "https://example.com/signup",
  "referrer": "https://google.com",
  "utm_source": "newsletter",
  "utm_medium": "email",
  "utm_campaign": "spring_sale",
  "user_agent": "Mozilla/5.0...",
  "email_consent": true,
  "email_consent_text": "I agree to receive...",
  "email_consent_at": "2026-01-28T12:00:00Z",
  "sms_consent": false,
  "sms_consent_text": null,
  "sms_consent_at": null,
  "consent_source": "form",
  "form_embed_key": "abc123..."
}
```

### Indexes
- `idx_form_submissions_tenant_id` on `(tenant_id)`
- `idx_form_submissions_form_id` on `(form_id)`
- `idx_form_submissions_customer_id` on `(customer_id)`
- `idx_form_submissions_submitted_at` on `(submitted_at DESC)`
- `idx_form_submissions_result` on `(tenant_id, result)`

### RLS Policies
1. **Authenticated users**: SELECT/INSERT for forms in their tenant
2. **Service role**: Full access for public submission endpoint

---

## Table 3: `form_rate_limits` (Abuse Protection)

### Schema
```text
+------------------------+-------------------+------------------------------------------+
| Column                 | Type              | Notes                                    |
+------------------------+-------------------+------------------------------------------+
| id                     | UUID PK           | gen_random_uuid()                        |
| tenant_id              | UUID NOT NULL     | FK → tenants(id) ON DELETE CASCADE       |
| form_id                | UUID NOT NULL     | FK → forms(id) ON DELETE CASCADE         |
| ip_hash                | TEXT NOT NULL     | Hashed IP address                        |
| window_start           | TIMESTAMPTZ       | Start of rate limit window               |
| count                  | INTEGER NOT NULL  | Number of submissions in window          |
+------------------------+-------------------+------------------------------------------+
```

### Indexes
- `idx_form_rate_limits_lookup` on `(form_id, ip_hash, window_start)`
- `idx_form_rate_limits_cleanup` on `(window_start)` for periodic purge

### RLS Policies
- **Service role only**: This table is managed by edge functions exclusively

### Rate Limit Windows
- **Per-IP short window**: 5 submissions per 60 seconds
- **Per-IP long window**: 20 submissions per 10 minutes
- **Cleanup**: Delete records older than 24 hours via scheduled function

---

## Table 4: Additions to `crm_customers`

### New Columns Required
Based on audit of existing schema, these columns are **NOT FOUND** and must be added:

| Column                  | Type        | Notes                                       |
|-------------------------|-------------|---------------------------------------------|
| `email_consent_details` | JSONB NULL  | Store consent text, page_url, form_id       |
| `sms_consent_details`   | JSONB NULL  | Same structure for SMS                      |

### Consent Details Structure
```json
{
  "consent_text": "I agree to receive marketing emails from...",
  "page_url": "https://example.com/signup",
  "form_id": "uuid",
  "form_embed_key": "abc123...",
  "captured_at": "2026-01-28T12:00:00Z"
}
```

### Already Present (verified)
- `email_opt_in` (boolean nullable)
- `email_opt_in_at` (timestamptz)
- `email_consent_source` (text) ← will use value `'form'`
- `email_consent_ip` (text)
- `email_consent_method` (text)
- `sms_opt_in` (boolean)
- `sms_opt_in_at` (timestamptz)
- `sms_consent_source` (text)
- `sms_consent_ip` (text)
- `sms_consent_method` (text)

---

## Implementation Details

### Trigger: Auto-update `updated_at`
Following existing pattern from `crm_customers`:
```sql
CREATE TRIGGER update_forms_updated_at
  BEFORE UPDATE ON public.forms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crm_customers_updated_at();
```
(Reuse existing function or create dedicated one)

### Embed Key Generation
```sql
embed_key TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex')
```
This produces a 32-character hex string (e.g., `a1b2c3d4e5f6...`).

### RLS Pattern (matching existing)
```sql
CREATE POLICY "Users can manage forms for their tenant" 
ON public.forms 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.tenant_id = forms.tenant_id 
    AND u.id = auth.uid()
  )
);
```

---

## Migration SQL Summary

The migration will execute in this order:

1. **Create `forms` table** with all columns, constraints, and default values
2. **Create `form_submissions` table** with foreign keys
3. **Create `form_rate_limits` table** for abuse protection
4. **Add columns to `crm_customers`**: `email_consent_details`, `sms_consent_details`
5. **Enable RLS** on all new tables
6. **Create RLS policies** following tenant isolation pattern
7. **Create indexes** for query performance
8. **Create update trigger** for `forms.updated_at`

---

## Verification Queries (post-migration)

```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('forms', 'form_submissions', 'form_rate_limits');

-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('forms', 'form_submissions', 'form_rate_limits');

-- Verify new columns on crm_customers
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'crm_customers' 
AND column_name IN ('email_consent_details', 'sms_consent_details');
```

---

## Technical Dependencies

| Dependency               | Status      | Notes                                     |
|--------------------------|-------------|-------------------------------------------|
| `tenants` table          | EXISTS      | Parent for tenant_id FK                   |
| `crm_customers` table    | EXISTS      | Target for customer_id FK                 |
| `users` table            | EXISTS      | Used in RLS policies for tenant check     |
| Service role key         | CONFIGURED  | Required for public submission endpoint   |

---

## Acceptance Criteria

- [ ] All three tables created with correct column types
- [ ] RLS enabled on all tables
- [ ] RLS policies allow tenant-scoped access
- [ ] Service role can bypass RLS for public endpoints
- [ ] `embed_key` is auto-generated and unique
- [ ] `crm_customers` has new consent detail columns
- [ ] All indexes created for query performance
- [ ] Update trigger fires on `forms` modifications
