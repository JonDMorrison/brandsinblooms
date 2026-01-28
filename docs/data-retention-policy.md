# Data Retention Policy

This document outlines data retention policies and automated cleanup jobs for BloomSuite form data.

## Overview

| Table | Default Retention | Configurable | Purpose |
|-------|------------------|--------------|---------|
| `form_rate_limits` | 24 hours | Yes | Rate limiting window tracking |
| `form_submissions` | Indefinite | Yes (disabled by default) | Form submission records |

---

## Cleanup Jobs

### form-data-cleanup Edge Function

A scheduled edge function that runs daily to clean up expired data.

#### Configuration (Environment Variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_RETENTION_HOURS` | `24` | Hours to keep rate limit records |
| `SUBMISSION_RETENTION_MONTHS` | `0` | Months to keep submissions (0 = disabled) |

#### Recommended Schedule

Run daily at 3:00 AM UTC (low-traffic period):

```sql
-- Enable required extensions (run once)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the cleanup job
SELECT cron.schedule(
  'form-data-cleanup-daily',
  '0 3 * * *',  -- Daily at 3:00 AM UTC
  $$
  SELECT net.http_post(
    url := 'https://PROJECT_ID.supabase.co/functions/v1/form-data-cleanup',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

Replace:
- `PROJECT_ID` with your Supabase project ID
- `YOUR_ANON_KEY` with your Supabase anon key

#### Manual Execution

```bash
curl -X POST \
  'https://PROJECT_ID.supabase.co/functions/v1/form-data-cleanup' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json'
```

---

## Table-Specific Policies

### form_rate_limits

**Purpose**: Tracks submission attempts per IP/fingerprint for rate limiting.

**Default Retention**: 24 hours

**Rationale**: Rate limit windows are typically 1-24 hours. Keeping records beyond this serves no purpose and wastes storage.

**Recommendation**: Keep default (24 hours). Increase only if you have very long rate limit windows.

### form_submissions

**Purpose**: Stores all form submission data including PII.

**Default Retention**: Indefinite (cleanup disabled)

**Rationale**: Submission data often has business/legal retention requirements.

**Recommendations by Use Case**:

| Use Case | Recommended Retention | Setting |
|----------|----------------------|---------|
| Lead capture | 24-36 months | `SUBMISSION_RETENTION_MONTHS=36` |
| Contact forms | 12-18 months | `SUBMISSION_RETENTION_MONTHS=18` |
| Newsletter signups | Indefinite (synced to CRM) | Keep disabled |
| Event registrations | 6 months post-event | `SUBMISSION_RETENTION_MONTHS=6` |
| GDPR/CCPA compliance | Per your policy | Set accordingly |

**⚠️ Important**: Before enabling submission cleanup:
1. Ensure data is synced to your CRM/marketing platform
2. Verify you meet any legal retention requirements
3. Consider exporting historical data first
4. Test with a short retention period first

---

## Compliance Considerations

### GDPR (EU)

- Users can request data deletion (Right to Erasure)
- Consider implementing per-user deletion capability
- Retention should be "no longer than necessary"
- Recommend: 18-24 months for lead data

### CCPA (California)

- Similar deletion rights as GDPR
- Must disclose retention periods in privacy policy
- Recommend: Document your retention policy

### TCPA/CASL

- Consent records should be retained for compliance proof
- Recommend: Keep consent audit trail indefinitely
- The `consent_sms` and `consent_email` flags should not be auto-deleted

---

## Monitoring

### Check Cleanup Job Status

```sql
-- View recent cleanup job executions
SELECT 
  id,
  created_at,
  response_status,
  response_body
FROM net._http_response
WHERE url LIKE '%form-data-cleanup%'
ORDER BY created_at DESC
LIMIT 10;
```

### Manual Cleanup (SQL)

If you need to run cleanup directly via SQL:

```sql
-- Clean up rate limits older than 24 hours
DELETE FROM form_rate_limits
WHERE window_start < NOW() - INTERVAL '24 hours';

-- Clean up submissions older than 18 months (use with caution!)
DELETE FROM form_submissions
WHERE submitted_at < NOW() - INTERVAL '18 months';
```

---

## Ops Checklist

- [ ] Deploy `form-data-cleanup` edge function
- [ ] Set environment variables if changing defaults
- [ ] Schedule cron job (see above)
- [ ] Monitor first few executions for errors
- [ ] Document retention policy in your privacy policy
- [ ] Set up alerting for cleanup failures (optional)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-28 | Initial policy created |
