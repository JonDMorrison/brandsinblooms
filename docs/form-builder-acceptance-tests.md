# BloomSuite Form Builder v1 - Acceptance Tests

## Overview

This document defines acceptance tests for the Form Builder submission flow, covering compliance, security, and data integrity requirements.

---

## Test Environment Setup

### Prerequisites
- Test tenant with known `tenant_id`
- Form with `embed_key` configured for testing
- Clean test database state (no existing test customers)

### Test Form Configuration
```json
{
  "fields_json": [
    { "id": "email", "type": "email", "label": "Email", "required": true, "mapping_key": "email" },
    { "id": "first_name", "type": "text", "label": "First Name", "required": true, "mapping_key": "first_name" },
    { "id": "phone", "type": "phone", "label": "Phone", "required": false, "mapping_key": "phone" },
    { "id": "email_consent", "type": "email_consent", "label": "I agree to receive marketing emails", "required": false },
    { "id": "sms_consent", "type": "sms_consent", "label": "I agree to receive SMS messages", "required": false }
  ],
  "compliance_json": {
    "email_consent_required": true,
    "email_consent_text": "I agree to receive marketing emails from Test Company",
    "sms_consent_required": true,
    "sms_consent_text": "I agree to receive SMS messages from Test Company",
    "email_consent_default_checked": false,
    "sms_consent_default_checked": false
  }
}
```

---

## Test 1: CASL Email Consent Required - Unchecked Rejection

### Scenario
User submits form with email but does NOT check email consent checkbox when `email_consent_required: true`.

### Test Steps
1. Submit to `/submit-form` with:
   ```json
   {
     "embed_key": "test_form_key",
     "data": {
       "email": "casl-test@example.com",
       "first_name": "CASL",
       "email_consent": false
     }
   }
   ```

### Expected Response
```json
{
  "success": false,
  "error": "Email consent is required",
  "code": "CONSENT_REQUIRED"
}
```
**HTTP Status:** `400 Bad Request`

### Expected DB State

| Table | Condition | Expected |
|-------|-----------|----------|
| `crm_customers` | `email = 'casl-test@example.com'` | **No record created** |
| `form_submissions` | `form_id = X AND data->>'email' = 'casl-test@example.com'` | 1 record |
| `form_submissions.result` | — | `'rejected_invalid'` |
| `form_submissions.reason` | — | `'Email consent required but not provided'` |

### Inspection Query
```sql
SELECT id, result, reason, data, metadata
FROM form_submissions
WHERE form_id = 'TEST_FORM_ID'
  AND data->>'email' = 'casl-test@example.com'
ORDER BY submitted_at DESC
LIMIT 1;
```

---

## Test 2: TCPA SMS Consent Required - Unchecked Rejection

### Scenario
User submits form with phone but does NOT check SMS consent checkbox when `sms_consent_required: true`.

### Test Steps
1. Submit to `/submit-form` with:
   ```json
   {
     "embed_key": "test_form_key",
     "data": {
       "email": "tcpa-test@example.com",
       "first_name": "TCPA",
       "phone": "+15551234567",
       "email_consent": true,
       "sms_consent": false
     }
   }
   ```

### Expected Response
```json
{
  "success": false,
  "error": "SMS consent is required",
  "code": "CONSENT_REQUIRED"
}
```
**HTTP Status:** `400 Bad Request`

### Expected DB State

| Table | Condition | Expected |
|-------|-----------|----------|
| `crm_customers` | `email = 'tcpa-test@example.com'` | **No record created** |
| `form_submissions` | `form_id = X AND data->>'email' = 'tcpa-test@example.com'` | 1 record |
| `form_submissions.result` | — | `'rejected_invalid'` |
| `form_submissions.reason` | — | `'SMS consent required but not provided'` |

### Inspection Query
```sql
SELECT id, result, reason, data->'sms_consent' as sms_consent
FROM form_submissions
WHERE form_id = 'TEST_FORM_ID'
  AND data->>'phone' = '+15551234567'
ORDER BY submitted_at DESC
LIMIT 1;
```

---

## Test 3: Valid Submission - Contact Created with Consent Timestamps

### Scenario
User submits form with all required consents checked.

### Test Steps
1. Submit to `/submit-form` with:
   ```json
   {
     "embed_key": "test_form_key",
     "data": {
       "email": "valid-user@example.com",
       "first_name": "Valid",
       "phone": "+15559876543",
       "email_consent": true,
       "sms_consent": true
     },
     "meta": {
       "page_url": "https://example.com/signup",
       "utm_source": "google",
       "utm_campaign": "spring2024"
     }
   }
   ```

### Expected Response
```json
{
  "success": true,
  "message": "Thank you for your submission!",
  "customer_id": "uuid-here"
}
```
**HTTP Status:** `200 OK`

### Expected DB State

#### `crm_customers` Table
| Field | Expected Value |
|-------|----------------|
| `email` | `'valid-user@example.com'` |
| `first_name` | `'Valid'` |
| `phone` | `'+15559876543'` |
| `email_opt_in` | `true` |
| `email_opt_in_at` | Timestamp within last 5 seconds |
| `email_consent_source` | `'form_submission'` |
| `sms_opt_in` | `true` |
| `sms_opt_in_at` | Timestamp within last 5 seconds |
| `sms_consent_source` | `'form_submission'` |
| `suppressed` | `false` |

#### `form_submissions` Table
| Field | Expected Value |
|-------|----------------|
| `result` | `'accepted'` |
| `customer_id` | Matches created customer UUID |
| `metadata->'email_consent'` | `true` |
| `metadata->'email_consent_text'` | Full consent text verbatim |
| `metadata->'email_consent_at'` | ISO timestamp |
| `metadata->'sms_consent'` | `true` |
| `metadata->'sms_consent_text'` | Full consent text verbatim |
| `metadata->'sms_consent_at'` | ISO timestamp |
| `metadata->'utm_source'` | `'google'` |
| `metadata->'utm_campaign'` | `'spring2024'` |

### Inspection Queries
```sql
-- Verify customer created with consent
SELECT 
  id, email, first_name, phone,
  email_opt_in, email_opt_in_at, email_consent_source,
  sms_opt_in, sms_opt_in_at, sms_consent_source,
  suppressed
FROM crm_customers
WHERE email = 'valid-user@example.com';

-- Verify submission metadata
SELECT 
  id, result, customer_id,
  metadata->'email_consent' as email_consent,
  metadata->'email_consent_text' as consent_text,
  metadata->'email_consent_at' as consent_at,
  metadata->'utm_source' as utm_source
FROM form_submissions
WHERE data->>'email' = 'valid-user@example.com'
  AND result = 'accepted';
```

---

## Test 4: Suppressed Email - Submission Accepted, Sending Blocked

### Scenario
Previously suppressed email submits form. Submission is accepted but customer remains suppressed.

### Test Setup
1. Pre-create suppression record:
   ```sql
   INSERT INTO email_suppressions (tenant_id, email, suppression_type, source)
   VALUES ('TEST_TENANT_ID', 'bounced@example.com', 'hard_bounce', 'resend_webhook');
   
   INSERT INTO crm_customers (tenant_id, email, first_name, suppressed)
   VALUES ('TEST_TENANT_ID', 'bounced@example.com', 'Bounced', true);
   ```

### Test Steps
1. Submit to `/submit-form` with:
   ```json
   {
     "embed_key": "test_form_key",
     "data": {
       "email": "bounced@example.com",
       "first_name": "Resubmit",
       "email_consent": true
     }
   }
   ```

### Expected Response
```json
{
  "success": true,
  "message": "Thank you for your submission!"
}
```
**HTTP Status:** `200 OK`

### Expected DB State

| Table | Field | Expected Value |
|-------|-------|----------------|
| `crm_customers` | `email` | `'bounced@example.com'` |
| `crm_customers` | `first_name` | `'Resubmit'` (updated) |
| `crm_customers` | `suppressed` | `true` (**unchanged**) |
| `crm_customers` | `email_opt_in` | `true` (updated) |
| `email_suppressions` | `email = 'bounced@example.com'` | Record **still exists** |
| `form_submissions` | `result` | `'accepted'` |

### Verification Note
When attempting to send email to this customer later:
- `canSendEmail('bounced@example.com')` should return `false`
- Skip reason logged to `email_send_skips` with reason `'suppressed'`

### Inspection Query
```sql
-- Customer updated but still suppressed
SELECT id, email, first_name, suppressed, email_opt_in
FROM crm_customers
WHERE email = 'bounced@example.com';

-- Suppression record unchanged
SELECT id, email, suppression_type, lifted_at
FROM email_suppressions
WHERE email = 'bounced@example.com'
  AND lifted_at IS NULL;
```

---

## Test 5: Rate Limiting - Repeated Submissions Rejected

### Scenario
Same IP submits form multiple times rapidly, triggering rate limit.

### Test Steps
1. Submit 6 requests in rapid succession (< 60 seconds) with same IP hash:
   ```json
   {
     "embed_key": "test_form_key",
     "data": {
       "email": "ratelimit-N@example.com",
       "first_name": "Rate",
       "email_consent": true
     }
   }
   ```

### Expected Response (Submissions 1-5)
```json
{
  "success": true,
  "message": "Thank you for your submission!"
}
```
**HTTP Status:** `200 OK`

### Expected Response (Submission 6+)
```json
{
  "success": false,
  "error": "Too many submissions. Please try again later."
}
```
**HTTP Status:** `429 Too Many Requests`
**Headers:** `Retry-After: 60`

### Expected DB State

| Table | Condition | Expected |
|-------|-----------|----------|
| `form_submissions` | `result = 'accepted'` | 5 records |
| `form_submissions` | `result = 'rejected_rate_limited'` | 1+ records |
| `form_rate_limits` | `form_id = X AND ip_hash = Y` | `short_window_count >= 5` |

### Inspection Query
```sql
-- Check rate limit counter
SELECT form_id, ip_hash, short_window_count, long_window_count, last_submission_at
FROM form_rate_limits
WHERE form_id = 'TEST_FORM_ID'
ORDER BY last_submission_at DESC
LIMIT 1;

-- Check rejected submissions
SELECT id, result, reason, submitted_at
FROM form_submissions
WHERE form_id = 'TEST_FORM_ID'
  AND result = 'rejected_rate_limited'
ORDER BY submitted_at DESC;
```

---

## Test 6: Honeypot Spam - Rejected and Logged

### Scenario
Bot fills hidden honeypot field, submission rejected as spam.

### Test Steps
1. Submit to `/submit-form` with honeypot field filled:
   ```json
   {
     "embed_key": "test_form_key",
     "data": {
       "email": "spambot@example.com",
       "first_name": "Bot",
       "email_consent": true,
       "_honeypot": "I am a bot filling all fields"
     }
   }
   ```

### Expected Response
```json
{
  "success": false,
  "error": "Submission rejected"
}
```
**HTTP Status:** `400 Bad Request`

### Expected DB State

| Table | Condition | Expected |
|-------|-----------|----------|
| `crm_customers` | `email = 'spambot@example.com'` | **No record created** |
| `form_submissions` | `data->>'email' = 'spambot@example.com'` | 1 record |
| `form_submissions.result` | — | `'rejected_spam'` |
| `form_submissions.reason` | — | `'Honeypot triggered'` |
| `form_submissions.metadata->'honeypot_value'` | — | `'I am a bot...'` |

### Inspection Query
```sql
SELECT 
  id, result, reason,
  data->>'email' as email,
  metadata->'honeypot_value' as honeypot_value
FROM form_submissions
WHERE result = 'rejected_spam'
  AND data->>'email' = 'spambot@example.com';
```

---

## Summary: Tables & Fields to Inspect

| Test | Primary Table | Key Fields |
|------|---------------|------------|
| 1. CASL Rejection | `form_submissions` | `result`, `reason` |
| 2. TCPA Rejection | `form_submissions` | `result`, `reason` |
| 3. Valid Submission | `crm_customers`, `form_submissions` | `email_opt_in`, `email_opt_in_at`, `sms_opt_in`, `sms_opt_in_at`, `metadata` |
| 4. Suppressed Email | `crm_customers`, `email_suppressions` | `suppressed`, `lifted_at` |
| 5. Rate Limiting | `form_rate_limits`, `form_submissions` | `short_window_count`, `result` |
| 6. Honeypot Spam | `form_submissions` | `result`, `reason`, `metadata` |

---

## Test Execution Checklist

```
[ ] Test 1: CASL email consent rejection
[ ] Test 2: TCPA SMS consent rejection  
[ ] Test 3: Valid submission with consent timestamps
[ ] Test 4: Suppressed email handling
[ ] Test 5: Rate limiting (5 quick submissions)
[ ] Test 6: Honeypot spam detection
```

## Cleanup Query

```sql
-- Run after testing to clean up test data
DELETE FROM form_submissions 
WHERE data->>'email' LIKE '%@example.com';

DELETE FROM crm_customers 
WHERE email LIKE '%@example.com';

DELETE FROM form_rate_limits 
WHERE form_id = 'TEST_FORM_ID';

DELETE FROM email_suppressions 
WHERE email = 'bounced@example.com';
```
