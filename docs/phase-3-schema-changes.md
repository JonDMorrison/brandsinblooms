# Phase 3 Schema Changes

This document details all database schema changes introduced in Phase 3 (Form Builder + Embed Display Modes + Automation Integration).

## Summary

| Table | Type | Purpose |
|-------|------|---------|
| `forms` | New | Form definitions and configuration |
| `form_submissions` | New | Submission audit trail with metadata |
| `form_rate_limits` | New | IP-based rate limiting for abuse protection |
| `automation_trigger_events` | Extended | Added form_id, submission_id for form→automation bridge |

---

## Table: `forms`

### Purpose
Stores form definitions including fields, settings, compliance options, and embed configuration.

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `tenant_id` | uuid | NO | - | FK to tenants |
| `name` | text | NO | - | Form display name |
| `status` | text | NO | `'draft'` | `draft`, `active`, `archived` |
| `fields_json` | jsonb | NO | `'[]'` | Form field definitions |
| `settings_json` | jsonb | NO | *(see below)* | Theme, branding, notifications |
| `compliance_json` | jsonb | NO | *(see below)* | Consent text, GDPR settings |
| `embed_key` | text | YES | - | 32-char hex key for public embed |
| `created_at` | timestamptz | NO | `now()` | Creation timestamp |
| `updated_at` | timestamptz | NO | `now()` | Last update timestamp |
| `created_by` | uuid | YES | - | User who created the form |

### Indexes

| Name | Definition | Purpose |
|------|------------|---------|
| `forms_pkey` | `PRIMARY KEY (id)` | Primary key |
| `forms_embed_key_key` | `UNIQUE (embed_key)` | Unique embed keys |
| `idx_forms_tenant_id` | `btree (tenant_id)` | Tenant lookup |
| `idx_forms_status` | `btree (tenant_id, status)` | Status filtering |

### RLS Policies

| Policy | Command | Rule |
|--------|---------|------|
| `Users can manage forms for their tenant` | ALL | `EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = forms.tenant_id AND u.id = auth.uid())` |

### Default settings_json
```json
{
  "theme": {},
  "show_branding": true,
  "success_message": "Thank you for your submission!",
  "submit_button_text": "Submit",
  "notification_emails": [],
  "success_redirect_url": null
}
```

### Default compliance_json
```json
{
  "double_opt_in": false,
  "gdpr_compliant": false,
  "sms_consent_text": "I agree to receive SMS messages",
  "email_consent_text": "I agree to receive marketing emails",
  "sms_consent_required": false,
  "email_consent_required": false
}
```

---

## Table: `form_submissions`

### Purpose
Immutable audit trail of all form submissions with consent snapshots.

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `tenant_id` | uuid | NO | - | FK to tenants |
| `form_id` | uuid | NO | - | FK to forms |
| `customer_id` | uuid | YES | - | FK to crm_customers (if matched) |
| `data` | jsonb | NO | `'{}'` | Submitted field values |
| `metadata` | jsonb | NO | `'{}'` | UTM, referrer, consent snapshots |
| `ip_hash` | text | YES | - | SHA-256 hash of IP (salted) |
| `result` | text | NO | `'accepted'` | `accepted`, `rejected`, `rate_limited` |
| `reason` | text | YES | - | Rejection/rate-limit reason |
| `submitted_at` | timestamptz | NO | `now()` | Submission timestamp |

### Indexes

| Name | Definition | Purpose |
|------|------------|---------|
| `form_submissions_pkey` | `PRIMARY KEY (id)` | Primary key |
| `idx_form_submissions_tenant_id` | `btree (tenant_id)` | Tenant lookup |
| `idx_form_submissions_form_id` | `btree (form_id)` | Form filtering |
| `idx_form_submissions_customer_id` | `btree (customer_id)` | Customer lookup |
| `idx_form_submissions_submitted_at` | `btree (submitted_at DESC)` | Time-based queries |
| `idx_form_submissions_result` | `btree (tenant_id, result)` | Result filtering |

### RLS Policies

| Policy | Command | Rule |
|--------|---------|------|
| `Service role can manage all submissions` | ALL | `true` (service_role only) |
| `Users can view submissions for their tenant` | SELECT | `EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = form_submissions.tenant_id AND u.id = auth.uid())` |

### Retention Strategy
- Submissions are retained indefinitely for audit compliance
- Optional: Create pg_cron job to archive submissions older than X years to cold storage
- Customer deletion cascades via `customer_id` FK (`ON DELETE SET NULL`)

---

## Table: `form_rate_limits`

### Purpose
IP-based rate limiting using sliding window algorithm with atomic UPSERT.

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `tenant_id` | uuid | NO | - | FK to tenants |
| `form_id` | uuid | NO | - | FK to forms |
| `ip_hash` | text | NO | - | SHA-256(salt + IP) |
| `window_start` | timestamptz | NO | `now()` | Current window start |
| `count` | integer | NO | `1` | Submissions in window |

### Indexes

| Name | Definition | Purpose |
|------|------------|---------|
| `form_rate_limits_pkey` | `PRIMARY KEY (id)` | Primary key |
| `form_rate_limits_form_ip_window_unique` | `UNIQUE (form_id, ip_hash, window_start)` | Idempotent UPSERT |
| `idx_form_rate_limits_lookup` | `btree (form_id, ip_hash, window_start)` | Fast lookup |
| `idx_form_rate_limits_cleanup` | `btree (window_start)` | Expired window cleanup |

### RLS Policies

| Policy | Command | Rule |
|--------|---------|------|
| `Service role manages rate limits` | ALL | `true` (service_role only) |

### Retention Strategy
- Expired windows (>24h old) should be deleted via scheduled cleanup
- Recommended: pg_cron job running `DELETE FROM form_rate_limits WHERE window_start < NOW() - INTERVAL '24 hours'`

---

## Table: `automation_trigger_events` (Extended)

### Purpose
Extended to support form submission → automation triggering.

### New Columns Added

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `form_id` | uuid | YES | - | FK to forms (ON DELETE SET NULL) |
| `submission_id` | uuid | YES | - | FK to form_submissions (ON DELETE SET NULL) |

### New Indexes Added

| Name | Definition | Purpose |
|------|------------|---------|
| `idx_automation_trigger_events_form_id` | `btree (form_id) WHERE form_id IS NOT NULL` | Form event lookup |
| `idx_automation_trigger_events_submission_id` | `btree (submission_id) WHERE submission_id IS NOT NULL` | Submission lookup |
| `idx_automation_trigger_events_submission_automation_unique` | `UNIQUE (submission_id, automation_id) WHERE both NOT NULL` | **Idempotency** |
| `idx_automation_trigger_events_form_submission_unique` | `UNIQUE (form_id, submission_id) WHERE both NOT NULL` | **Duplicate prevention** |

### RLS Policies

| Policy | Command | Rule |
|--------|---------|------|
| `Users can view their tenant trigger events` | SELECT | `tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())` |

---

## Trigger: `trg_emit_form_submitted_event`

### Purpose
Automatically emits `form_submitted` event to `automation_trigger_events` after form submission.

### Definition
```sql
CREATE TRIGGER trg_emit_form_submitted_event 
AFTER INSERT ON public.form_submissions 
FOR EACH ROW 
EXECUTE FUNCTION emit_form_submitted_event()
```

### Trigger Function
```sql
CREATE FUNCTION public.emit_form_submitted_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_consent_snapshot jsonb;
BEGIN
  -- Only emit for accepted submissions
  IF NEW.result != 'accepted' THEN
    RETURN NEW;
  END IF;

  -- Build consent snapshot from metadata
  v_consent_snapshot := jsonb_build_object(
    'email_consent', COALESCE((NEW.metadata->>'email_consent')::boolean, false),
    'email_consent_text', NEW.metadata->>'email_consent_text',
    'email_consent_at', NEW.metadata->>'email_consent_at',
    'sms_consent', COALESCE((NEW.metadata->>'sms_consent')::boolean, false),
    'sms_consent_text', NEW.metadata->>'sms_consent_text',
    'sms_consent_at', NEW.metadata->>'sms_consent_at'
  );

  -- Insert trigger event (async)
  BEGIN
    INSERT INTO public.automation_trigger_events (
      tenant_id, customer_id, event_type, form_id, submission_id,
      metadata, created_at
    ) VALUES (
      NEW.tenant_id, NEW.customer_id, 'form_submitted', NEW.form_id, NEW.id,
      jsonb_build_object(
        'form_id', NEW.form_id,
        'submission_id', NEW.id,
        'customer_id', NEW.customer_id,
        'tenant_id', NEW.tenant_id,
        'timestamp', NEW.submitted_at,
        'consent', v_consent_snapshot,
        'referrer', NEW.metadata->>'referrer',
        'page_url', NEW.metadata->>'page_url'
      ),
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log error but do NOT propagate - submission must succeed
    RAISE WARNING 'FormSubmitted event emission failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;
```

### Safety Features
1. **Accepted-only filter**: `IF NEW.result != 'accepted' THEN RETURN NEW; END IF;`
2. **Exception handling**: Failures logged but never block submission
3. **Security definer**: Runs with elevated privileges
4. **Immutable search_path**: Prevents path injection

---

## Migration Files

| Migration | Tables Affected |
|-----------|-----------------|
| `20250115_create_forms_table.sql` | forms |
| `20250115_create_form_submissions_table.sql` | form_submissions |
| `20250115_create_form_rate_limits.sql` | form_rate_limits |
| `20250116_extend_automation_trigger_events.sql` | automation_trigger_events |
| `20250117_add_form_submission_trigger.sql` | (trigger) |
| `20260129_add_automation_idempotency_indexes.sql` | automation_trigger_events |

---

## Cleanup Recommendations

### Rate Limit Cleanup (Daily)
```sql
-- pg_cron job: delete expired rate limit windows
DELETE FROM public.form_rate_limits 
WHERE window_start < NOW() - INTERVAL '24 hours';
```

### Stale Trigger Event Cleanup (Weekly)
```sql
-- Archive or delete old processed events
DELETE FROM public.automation_trigger_events 
WHERE processed_at IS NOT NULL 
AND processed_at < NOW() - INTERVAL '30 days';
```