# Phase 3: Canonical Semantics — Form Submissions & Automations

**Status:** FINALIZED  
**Last Updated:** January 2026

---

## 1. Form Submission Result Semantics

### Canonical Result Values

The `form_submissions.result` column uses a binary status model:

| Value | Description |
|-------|-------------|
| `accepted` | Submission processed successfully |
| `rejected` | Submission failed validation/limits/spam |

### Rejection Details

When `result = 'rejected'`, additional information is stored in:

- **`reason`** (TEXT): Human-readable rejection message
- **`metadata.rejection_type`** (STRING): Machine-readable rejection category

#### Rejection Types

| rejection_type | Description | HTTP Status |
|----------------|-------------|-------------|
| `invalid` | Field validation failed, consent missing, email required | 400 |
| `rate_limited` | Rate limit exceeded | 429 |
| `spam` | Honeypot triggered | 200 (fake success) |

### Example Submission Records

```json
// Accepted submission
{
  "result": "accepted",
  "reason": null,
  "metadata": {
    "email_consent": true,
    "email_consent_text": "I agree to receive marketing emails",
    "email_consent_at": "2026-01-29T12:00:00Z",
    "sms_consent": false
  }
}

// Rejected - validation failure
{
  "result": "rejected",
  "reason": "Email is required; First Name is required",
  "metadata": {
    "rejection_type": "invalid"
  }
}

// Rejected - rate limit
{
  "result": "rejected",
  "reason": "Rate limit exceeded: 5 submissions per minute",
  "metadata": {
    "rejection_type": "rate_limited"
  }
}
```

---

## 2. Canonical Consent Metadata Keys

All form submissions MUST use these exact key names for consistency and compliance auditing.

### Email Consent Keys

| Key | Type | Description |
|-----|------|-------------|
| `email_consent` | boolean | Whether email consent was given |
| `email_consent_text` | string | Verbatim consent text shown to user |
| `email_consent_at` | string (ISO 8601) | Timestamp when consent was recorded |
| `email_consent_required` | boolean | Whether consent was required by form config |

### SMS Consent Keys

| Key | Type | Description |
|-----|------|-------------|
| `sms_consent` | boolean | Whether SMS consent was given |
| `sms_consent_text` | string | Verbatim consent text shown to user |
| `sms_consent_at` | string (ISO 8601) | Timestamp when consent was recorded |
| `sms_consent_required` | boolean | Whether consent was required by form config |

### Complete Metadata Schema

```typescript
interface FormSubmissionMetadata {
  // Page & attribution context
  page_url?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  user_agent?: string;
  
  // Form identification
  form_embed_key?: string;
  form_id?: string;
  consent_source?: string;
  submitted_at?: string;
  
  // Email consent (REQUIRED keys)
  email_consent: boolean;
  email_consent_text?: string;
  email_consent_at?: string;
  email_consent_required?: boolean;
  
  // SMS consent (REQUIRED keys)
  sms_consent: boolean;
  sms_consent_text?: string;
  sms_consent_at?: string;
  sms_consent_required?: boolean;
  
  // Rejection details (for rejected submissions)
  rejection_type?: 'invalid' | 'rate_limited' | 'spam';
}
```

---

## 3. Worker Idempotency — Atomic Claim Pattern

### Problem

When multiple workers run simultaneously (e.g., cron triggers overlapping), events could be processed multiple times.

### Solution: FOR UPDATE SKIP LOCKED

The `process-form-submitted` worker uses an atomic claim pattern:

```sql
-- claim_trigger_events(p_event_type, p_limit) RPC function
UPDATE automation_trigger_events
SET claimed_at = NOW()
WHERE id IN (
  SELECT id FROM automation_trigger_events
  WHERE event_type = p_event_type
    AND processed_at IS NULL
    AND claimed_at IS NULL
    AND retry_count < max_retries
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT p_limit
)
RETURNING *;
```

### How It Works

1. **Claim Phase**: Worker atomically claims events by setting `claimed_at`
2. **Process Phase**: Worker processes claimed events
3. **Complete Phase**: Worker sets `processed_at` when done
4. **Stale Claim Recovery**: `release_stale_claims()` function clears claims older than 15 minutes

### Columns

| Column | Type | Description |
|--------|------|-------------|
| `claimed_at` | TIMESTAMPTZ | When a worker claimed this event |
| `processed_at` | TIMESTAMPTZ | When processing completed |
| `retry_count` | INTEGER | Number of retry attempts |
| `error_message` | TEXT | Last error message |

### Stale Claim Recovery

```sql
-- Run periodically to release abandoned claims
SELECT release_stale_claims(15); -- Release claims older than 15 minutes
```

---

## 4. Unique Indexes for Idempotency

### Preventing Duplicate Events

```sql
-- Prevent duplicate events for same submission + automation
CREATE UNIQUE INDEX idx_automation_trigger_events_submission_automation_unique
ON automation_trigger_events (submission_id, automation_id)
WHERE submission_id IS NOT NULL AND automation_id IS NOT NULL;

-- Prevent duplicate events for same form + submission
CREATE UNIQUE INDEX idx_automation_trigger_events_form_submission_unique
ON automation_trigger_events (form_id, submission_id)
WHERE form_id IS NOT NULL AND submission_id IS NOT NULL;
```

### Behavior on Conflict

When a duplicate event is inserted:
- PostgreSQL raises unique violation (23505)
- The insert is rejected, original event is preserved
- This is expected and correct behavior

---

## 5. Consent Snapshot in Trigger Events

The database trigger captures an immutable consent snapshot:

```sql
v_consent_snapshot := jsonb_build_object(
  'email_consent', COALESCE((NEW.metadata->>'email_consent')::boolean, false),
  'email_consent_text', NEW.metadata->>'email_consent_text',
  'email_consent_at', NEW.metadata->>'email_consent_at',
  'sms_consent', COALESCE((NEW.metadata->>'sms_consent')::boolean, false),
  'sms_consent_text', NEW.metadata->>'sms_consent_text',
  'sms_consent_at', NEW.metadata->>'sms_consent_at'
);
```

This snapshot is stored in `automation_trigger_events.metadata.consent` and provides:
- Audit trail of exact consent state at submission time
- Legal defensibility for email/SMS sends
- Isolation from subsequent customer consent changes

---

## 6. TypeScript Type Definitions

Located in `src/types/formBuilder.ts`:

```typescript
export type SubmissionResult = 'accepted' | 'rejected';
export type RejectionType = 'invalid' | 'rate_limited' | 'spam';

export interface FormSubmission {
  id: string;
  tenant_id: string;
  form_id: string;
  customer_id?: string;
  data: Record<string, any>;
  metadata: FormSubmissionMetadata;
  ip_hash?: string;
  result: SubmissionResult;
  reason?: string;
  submitted_at: string;
}
```

---

## 7. UI Components Updated

The following components handle the canonical result semantics:

| Component | Location | Changes |
|-----------|----------|---------|
| `FormSubmissionsTab` | `src/components/forms/FormSubmissionsTab.tsx` | Uses `metadata.rejection_type` for breakdown |
| `SubmissionDetailModal` | `src/components/forms/submissions/SubmissionDetailModal.tsx` | Displays rejection reason/type |
| `SubmissionExport` | `src/components/forms/submissions/SubmissionExport.tsx` | Exports rejection_type in metadata |

---

## 8. Migration Summary

### Database Changes

| Change | Migration |
|--------|-----------|
| Add `claimed_at` column | `20260129_phase3_finalization.sql` |
| Add `claim_trigger_events()` RPC | Same migration |
| Add `release_stale_claims()` function | Same migration |
| Document result column semantics | Column comment added |

### Edge Function Changes

| Function | Changes |
|----------|---------|
| `submit-form` | Uses canonical `accepted`/`rejected` result |
| `process-form-submitted` | Uses atomic claim pattern via RPC |

---

## 9. Verification Queries

### Check Result Distribution

```sql
SELECT result, COUNT(*) 
FROM form_submissions 
GROUP BY result;
```

### Check Rejection Type Distribution

```sql
SELECT 
  result,
  metadata->>'rejection_type' as rejection_type,
  COUNT(*)
FROM form_submissions
WHERE result = 'rejected'
GROUP BY result, metadata->>'rejection_type';
```

### Check Worker Claim Status

```sql
SELECT 
  CASE 
    WHEN processed_at IS NOT NULL THEN 'completed'
    WHEN claimed_at IS NOT NULL THEN 'in_progress'
    ELSE 'pending'
  END as status,
  COUNT(*)
FROM automation_trigger_events
WHERE event_type = 'form_submitted'
GROUP BY 1;
```

### Find Stale Claims

```sql
SELECT * FROM automation_trigger_events
WHERE claimed_at < NOW() - INTERVAL '15 minutes'
  AND processed_at IS NULL;
```

---

*Document Version: 1.0*  
*Phase 3 Finalization — January 2026*
