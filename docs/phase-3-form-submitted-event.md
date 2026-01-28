# FormSubmitted Event Emitter — Technical Specification

**Phase:** 3  
**Status:** Implemented  
**Constraint Compliance:** ✅ submit-form unchanged, ✅ async/non-blocking, ✅ failures logged not propagated

---

## Event Payload Definition

```typescript
interface FormSubmittedEvent {
  // Core identifiers
  form_id: string;         // UUID of the form
  submission_id: string;   // UUID of the submission
  customer_id: string | null; // UUID of matched/created customer (null if anonymous)
  tenant_id: string;       // UUID of the tenant

  // Timing
  timestamp: string;       // ISO 8601 timestamp of submission

  // Consent snapshot (immutable record of what was agreed to)
  consent: {
    email_consent: boolean;
    email_consent_text: string | null;
    email_consent_at: string | null;  // ISO 8601
    sms_consent: boolean;
    sms_consent_text: string | null;
    sms_consent_at: string | null;    // ISO 8601
  };

  // Attribution (optional)
  referrer: string | null;
  page_url: string | null;
}
```

---

## Where Event Is Emitted

### Mechanism: PostgreSQL AFTER INSERT Trigger

| Component | Location |
|-----------|----------|
| **Trigger Function** | `public.emit_form_submitted_event()` |
| **Trigger** | `trg_emit_form_submitted_event` on `form_submissions` |
| **Target Table** | `automation_trigger_events` |
| **Event Type** | `form_submitted` |

### Flow Diagram

```
┌─────────────────────┐
│   submit-form       │  ← NOT MODIFIED
│   (edge function)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  form_submissions   │
│  INSERT (accepted)  │
└──────────┬──────────┘
           │
           │ AFTER INSERT TRIGGER
           ▼
┌─────────────────────────────────────┐
│  emit_form_submitted_event()        │
│  (PostgreSQL function)              │
│                                     │
│  1. Check result = 'accepted'       │
│  2. Build consent snapshot          │
│  3. INSERT into trigger_events      │
│  4. On error: RAISE WARNING only    │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  automation_trigger_events          │
│  event_type = 'form_submitted'      │
│  form_id, submission_id, metadata   │
└──────────┬──────────────────────────┘
           │
           │ (picked up by existing worker)
           ▼
┌─────────────────────────────────────┐
│  process-trigger-events             │
│  (existing automation worker)       │
└─────────────────────────────────────┘
```

---

## Why Database Trigger (Not Edge Function Modification)

| Requirement | How Trigger Satisfies It |
|-------------|--------------------------|
| submit-form must NOT be modified | ✅ Trigger is separate from edge function |
| Async and non-blocking | ✅ AFTER INSERT runs after commit; simple INSERT is fast |
| Failures don't affect submission | ✅ Exception handler catches errors, logs warning, returns NEW |
| Observable and auditable | ✅ All events written to `automation_trigger_events` table |

---

## Failure Handling Behavior

### Exception Handling in Trigger

```sql
BEGIN
  INSERT INTO automation_trigger_events (...);
EXCEPTION WHEN OTHERS THEN
  -- Log error but do NOT propagate
  RAISE WARNING 'FormSubmitted event emission failed for submission %: %', NEW.id, SQLERRM;
END;
```

### Failure Scenarios

| Scenario | Behavior | Submission Status |
|----------|----------|-------------------|
| Event INSERT succeeds | Event created, picked up by worker | ✅ Success |
| Event INSERT fails (constraint) | Warning logged to Postgres logs | ✅ Success |
| Event INSERT fails (connection) | Warning logged to Postgres logs | ✅ Success |
| Trigger function error | Warning logged, NEW returned | ✅ Success |

### Where to Find Errors

1. **Postgres Logs** — `RAISE WARNING` messages appear in Supabase dashboard → Logs → Postgres
2. **automation_trigger_events** — Missing events indicate emission failure
3. **Correlation** — Compare `form_submissions` count vs `automation_trigger_events` count for `form_submitted`

---

## Database Schema Changes

### New Columns on `automation_trigger_events`

| Column | Type | Purpose |
|--------|------|---------|
| `form_id` | `uuid` | FK to `forms(id)`, nullable |
| `submission_id` | `uuid` | FK to `form_submissions(id)`, nullable |
| `metadata` | `jsonb` | Full event payload including consent snapshot |

### New Indexes

```sql
idx_automation_trigger_events_form_id       -- Partial index WHERE form_id IS NOT NULL
idx_automation_trigger_events_submission_id -- Partial index WHERE submission_id IS NOT NULL
```

---

## Querying Events

### Find all form submission events for a form

```sql
SELECT * FROM automation_trigger_events
WHERE event_type = 'form_submitted'
  AND form_id = 'your-form-uuid'
ORDER BY created_at DESC;
```

### Find unprocessed form events

```sql
SELECT * FROM automation_trigger_events
WHERE event_type = 'form_submitted'
  AND processed_at IS NULL
ORDER BY created_at ASC;
```

### Audit consent for a specific submission

```sql
SELECT 
  submission_id,
  metadata->'consent' as consent_snapshot,
  metadata->>'timestamp' as submitted_at
FROM automation_trigger_events
WHERE submission_id = 'your-submission-uuid';
```

---

## Testing

### Manual Test

1. Submit a form that results in `accepted` status
2. Query `automation_trigger_events` for `event_type = 'form_submitted'`
3. Verify payload contains all expected fields

### Verify Failure Isolation

1. Temporarily break the trigger (e.g., reference non-existent column)
2. Submit a form
3. Confirm submission succeeds
4. Check Postgres logs for WARNING message
5. Restore trigger

---

## Future Considerations

- **Event versioning:** Add `event_version` field if payload schema changes
- **Batch processing:** Current design is single-row; could batch if volume increases
- **Dead letter queue:** Consider separate table for failed emissions if audit is critical

---

*Document Version: 1.0*  
*Created: January 2026*
