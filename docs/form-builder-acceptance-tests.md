# BloomSuite Form Builder v1.0.0 - Acceptance Tests

## Overview

This document defines acceptance tests for the Form Builder submission flow, covering compliance, security, and data integrity requirements.

**Version**: 1.0.0  
**Last Updated**: 2026-01-28

---

## Canonical Field Reference

Before testing, understand the correct field names:

| crm_customers Field | Type | Description |
|---------------------|------|-------------|
| `opt_out` | boolean | Global hard suppression - NEVER modified by forms |
| `email_opt_in` | boolean | Email channel permission |
| `sms_opt_in` | boolean | SMS channel permission |
| `email_consent_details` | JSONB | Legal proof of email consent |
| `sms_consent_details` | JSONB | Legal proof of SMS consent |
| `suppressed` | boolean | Technical send block |

**NOTE**: The following fields DO NOT EXIST and should never be referenced:
- `opt_out_email` - DOES NOT EXIST
- `opt_out_sms` - DOES NOT EXIST
- `email_consent` (as a column) - DOES NOT EXIST (only in form data payload)
- `sms_consent` (as a column) - DOES NOT EXIST (only in form data payload)

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
    "sms_consent_text": "I agree to receive SMS messages from Test Company"
  }
}
```

---

## Test 1: CASL Email Consent Required - Unchecked Rejection

### Scenario
User submits form with email but does NOT check email consent checkbox when `email_consent_required: true`.

### Payload
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

### Expected HTTP Response
**Status**: `400 Bad Request`
```json
{
  "error": "Validation failed",
  "details": ["Email consent is required"]
}
```

### Expected DB State

| Table | Query | Expected |
|-------|-------|----------|
| `crm_customers` | `WHERE email = 'casl-test@example.com'` | **No record created** |
| `form_submissions` | `WHERE data->>'email' = 'casl-test@example.com'` | 1 record |
| `form_submissions.result` | | `'rejected_invalid'` |

### Verification Query
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

### Payload
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

### Expected HTTP Response
**Status**: `400 Bad Request`
```json
{
  "error": "Validation failed",
  "details": ["SMS consent is required when providing a phone number"]
}
```

### Expected DB State

| Table | Query | Expected |
|-------|-------|----------|
| `crm_customers` | `WHERE email = 'tcpa-test@example.com'` | **No record created** |
| `form_submissions` | `WHERE data->>'email' = 'tcpa-test@example.com'` | 1 record |
| `form_submissions.result` | | `'rejected_invalid'` |

### Verification Query
```sql
SELECT id, result, reason, data->'sms_consent' as sms_consent
FROM form_submissions
WHERE form_id = 'TEST_FORM_ID'
  AND data->>'phone' = '+15551234567'
ORDER BY submitted_at DESC
LIMIT 1;
```

---

## Test 3: Valid Submission - Customer Created with Consent

### Scenario
User submits form with all required consents checked.

### Payload
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

### Expected HTTP Response
**Status**: `200 OK`
```json
{
  "success": true,
  "message": "Thank you for your submission!",
  "customer_id": "uuid-here"
}
```

### Expected DB State

#### crm_customers Table (CORRECT FIELD NAMES)
| Field | Expected Value |
|-------|----------------|
| `email` | `'valid-user@example.com'` |
| `first_name` | `'Valid'` |
| `phone` | `'+15559876543'` |
| `email_opt_in` | `true` |
| `email_opt_in_at` | Timestamp within last 5 seconds |
| `email_consent_source` | `'form'` |
| `email_consent_details` | JSONB with consent_text, consented_at, form_id, etc. |
| `sms_opt_in` | `true` |
| `sms_opt_in_at` | Timestamp within last 5 seconds |
| `sms_consent_source` | `'form'` |
| `sms_consent_details` | JSONB with consent_text, consented_at, form_id, etc. |
| `suppressed` | `false` |
| `opt_out` | `null` or `false` (NEVER set by form) |

#### form_submissions Table
| Field | Expected Value |
|-------|----------------|
| `result` | `'accepted'` |
| `customer_id` | Matches created customer UUID |
| `metadata->>'email_consent'` | `'true'` |
| `metadata->>'email_consent_text'` | Full consent text verbatim |
| `metadata->>'email_consent_at'` | ISO timestamp |
| `metadata->>'sms_consent'` | `'true'` |
| `metadata->>'sms_consent_text'` | Full consent text verbatim |
| `metadata->>'sms_consent_at'` | ISO timestamp |
| `metadata->>'utm_source'` | `'google'` |
| `metadata->>'utm_campaign'` | `'spring2024'` |

### Verification Queries
```sql
-- Verify customer created with consent (CORRECT FIELD NAMES)
SELECT 
  id, email, first_name, phone,
  email_opt_in, email_opt_in_at, email_consent_source,
  jsonb_pretty(email_consent_details) as email_details,
  sms_opt_in, sms_opt_in_at, sms_consent_source,
  jsonb_pretty(sms_consent_details) as sms_details,
  suppressed, opt_out
FROM crm_customers
WHERE email = 'valid-user@example.com';

-- Verify submission metadata
SELECT 
  id, result, customer_id,
  metadata->>'email_consent' as email_consent,
  metadata->>'email_consent_text' as consent_text,
  metadata->>'email_consent_at' as consent_at,
  metadata->>'utm_source' as utm_source
FROM form_submissions
WHERE data->>'email' = 'valid-user@example.com'
  AND result = 'accepted';
```

---

## Test 4: Suppressed Email - Submission Accepted, Sending Blocked

### Scenario
Previously suppressed email submits form. Submission is accepted but customer remains suppressed.

### Test Setup
```sql
INSERT INTO email_suppressions (tenant_id, email, suppression_type, source)
VALUES ('TEST_TENANT_ID', 'bounced@example.com', 'hard_bounce', 'resend_webhook');

INSERT INTO crm_customers (tenant_id, email, first_name, suppressed)
VALUES ('TEST_TENANT_ID', 'bounced@example.com', 'Bounced', true);
```

### Payload
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

### Expected HTTP Response
**Status**: `200 OK`
```json
{
  "success": true,
  "message": "Thank you for your submission!"
}
```

### Expected DB State

| Table | Field | Expected Value |
|-------|-------|----------------|
| `crm_customers` | `email` | `'bounced@example.com'` |
| `crm_customers` | `first_name` | `'Resubmit'` (updated) |
| `crm_customers` | `suppressed` | `true` (**unchanged**) |
| `crm_customers` | `email_opt_in` | `true` (updated) |
| `email_suppressions` | `email = 'bounced@example.com'` | Record **still exists** |
| `form_submissions` | `result` | `'accepted'` |

### Verification Query
```sql
-- Customer updated but still suppressed
SELECT id, email, first_name, suppressed, email_opt_in, opt_out
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

### Payload (repeat 6 times)
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

### Expected HTTP Response (Submissions 1-5)
**Status**: `200 OK`

### Expected HTTP Response (Submission 6+)
**Status**: `429 Too Many Requests`
**Headers**: `Retry-After: 60`
```json
{
  "error": "Rate limit exceeded: 5 submissions per minute"
}
```

### Expected DB State

| Table | Condition | Expected |
|-------|-----------|----------|
| `form_submissions` | `result = 'accepted'` | 5 records |
| `form_submissions` | `result = 'rejected_rate_limited'` | 1+ records |
| `form_rate_limits` | `form_id = X AND ip_hash = Y` | count >= 5 |

### Verification Query
```sql
-- Check rate limit counter
SELECT form_id, ip_hash, count, window_start
FROM form_rate_limits
WHERE form_id = 'TEST_FORM_ID'
ORDER BY window_start DESC
LIMIT 5;

-- Check rejected submissions
SELECT id, result, reason, submitted_at
FROM form_submissions
WHERE form_id = 'TEST_FORM_ID'
  AND result = 'rejected_rate_limited'
ORDER BY submitted_at DESC;
```

---

## Test 6: Honeypot Spam - Silent Success (Bot Deceived)

### Scenario
Bot fills hidden honeypot field. Submission is rejected internally but returns fake success.

### Payload
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

### Expected HTTP Response
**Status**: `200 OK` (fake success to deceive bots)
```json
{
  "success": true,
  "message": "Thank you for your submission!"
}
```

### Expected DB State

| Table | Condition | Expected |
|-------|-----------|----------|
| `crm_customers` | `email = 'spambot@example.com'` | **No record created** |
| `form_submissions` | `data->>'email' = 'spambot@example.com'` | 1 record |
| `form_submissions.result` | | `'rejected_spam'` |
| `form_submissions.reason` | | `'Spam detected (honeypot)'` |

### Verification Query
```sql
SELECT 
  id, result, reason,
  data->>'email' as email,
  data->>'_honeypot' as honeypot_value
FROM form_submissions
WHERE result = 'rejected_spam'
  AND data->>'email' = 'spambot@example.com';
```

---

## Test 7: Existing Customer Resubmission - Idempotent Upsert

### Scenario
Existing customer submits form again with same email. System must:
- Upsert to same customer record (not create duplicate)
- Never downgrade consent (preserve existing opt-ins)
- Not duplicate persona assignments
- Create new form_submissions row

### Test Setup
```sql
INSERT INTO crm_customers (
  id, tenant_id, email, first_name, phone,
  email_opt_in, email_opt_in_at, email_consent_source,
  sms_opt_in, sms_opt_in_at, sms_consent_source
) VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'TEST_TENANT_ID',
  'returning@example.com',
  'Original',
  '+15551112222',
  true,
  '2024-01-01T10:00:00Z',
  'form',
  true,
  '2024-01-01T10:00:00Z',
  'form'
);

-- Pre-assign persona
INSERT INTO customer_personas (customer_id, persona_id)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'EXISTING_PERSONA_ID');
```

### Payload (WITHOUT consent checkboxes)
```json
{
  "embed_key": "test_form_key",
  "data": {
    "email": "returning@example.com",
    "first_name": "Updated",
    "phone": "+15553334444",
    "email_consent": false,
    "sms_consent": false
  },
  "meta": {
    "page_url": "https://example.com/promo",
    "utm_source": "email",
    "utm_campaign": "summer2024"
  }
}
```

### Expected HTTP Response
**Status**: `200 OK`
```json
{
  "success": true,
  "message": "Thank you for your submission!",
  "customer_id": "aaaaaaaa-0000-0000-0000-000000000001"
}
```

### Expected DB State

#### crm_customers Table (Upserted, Same ID)
| Field | Expected Value | Notes |
|-------|----------------|-------|
| `id` | `'aaaaaaaa-0000-0000-0000-000000000001'` | **Same ID, not new record** |
| `email` | `'returning@example.com'` | Unchanged |
| `first_name` | `'Updated'` | **Updated** from form |
| `phone` | `'+15553334444'` | **Updated** from form |
| `email_opt_in` | `true` | **NOT downgraded** (was true) |
| `email_opt_in_at` | `'2024-01-01T10:00:00Z'` | **Preserved** original timestamp |
| `sms_opt_in` | `true` | **NOT downgraded** (was true) |
| `sms_opt_in_at` | `'2024-01-01T10:00:00Z'` | **Preserved** original timestamp |
| `opt_out` | `null` or `false` | **NEVER set by form** |

### Critical Assertions

1. **Customer ID unchanged**: Same ID, not a new record
2. **Consent never downgraded**: `email_opt_in` and `sms_opt_in` remain `true`
3. **Original timestamps preserved**: `email_opt_in_at` and `sms_opt_in_at` unchanged
4. **opt_out untouched**: Form submission NEVER sets opt_out
5. **Personas not duplicated**: No duplicate persona assignments

### Verification Queries
```sql
-- 1. Verify customer upserted (same ID, consent NOT downgraded)
SELECT 
  id,
  email,
  first_name,
  phone,
  email_opt_in,
  email_opt_in_at,
  sms_opt_in,
  sms_opt_in_at,
  opt_out,
  updated_at
FROM crm_customers
WHERE email = 'returning@example.com';
-- Expected: id = 'aaaaaaaa-...', email_opt_in = true, sms_opt_in = true

-- 2. Verify persona assignment is idempotent
SELECT 
  cp.customer_id,
  cp.persona_id,
  COUNT(*) as assignment_count
FROM customer_personas cp
WHERE cp.customer_id = 'aaaaaaaa-0000-0000-0000-000000000001'
GROUP BY cp.customer_id, cp.persona_id;
-- Expected: Each persona appears exactly once
```

---

## Test 8: Persona Assignment Idempotency (Custom + Predefined)

### Scenario
Submit form twice with the same persona assignments. Verify no duplicate rows are created.

### Test Setup
```sql
-- Custom persona
INSERT INTO crm_personas (id, tenant_id, name, is_custom)
VALUES ('cccccccc-0000-0000-0000-000000000001', 'TEST_TENANT_ID', 'VIP Customer', true);

-- Predefined persona
INSERT INTO crm_personas (id, tenant_id, name, is_custom)
VALUES ('pppppppp-0000-0000-0000-000000000001', null, 'New Subscriber', false);
```

### Payload (submit twice, identical)
```json
{
  "embed_key": "test_form_key",
  "data": {
    "email": "persona-test@example.com",
    "first_name": "Persona",
    "email_consent": true
  }
}
```

### Expected HTTP Response (Both Submissions)
**Status**: `200 OK`

### Expected DB State After Both Submissions

#### customer_personas Table
| customer_id | persona_id | predefined_persona_id | Count |
|-------------|------------|----------------------|-------|
| customer-uuid | `CUSTOM_PERSONA_ID` | `null` | **1** |
| customer-uuid | `null` | `PREDEFINED_PERSONA_ID` | **1** |

**Total rows: 2** (not 4)

### Verification Queries
```sql
-- 1. Verify NO duplicate persona assignments
SELECT 
  customer_id,
  persona_id,
  predefined_persona_id,
  COUNT(*) as duplicate_count
FROM customer_personas
WHERE customer_id = (
  SELECT id FROM crm_customers WHERE email = 'persona-test@example.com'
)
GROUP BY customer_id, persona_id, predefined_persona_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows (no duplicates)

-- 2. Verify two submission rows exist
SELECT COUNT(*) as submission_count
FROM form_submissions
WHERE customer_id = (
  SELECT id FROM crm_customers WHERE email = 'persona-test@example.com'
)
AND result = 'accepted';
-- Expected: 2
```

### Database Constraints Enforced
```sql
-- Custom personas (persona_id column)
CREATE UNIQUE INDEX unique_customer_custom_persona 
ON customer_personas (customer_id, persona_id) 
WHERE persona_id IS NOT NULL;

-- Predefined personas (predefined_persona_id column)
CREATE UNIQUE INDEX unique_customer_predefined_persona 
ON customer_personas (customer_id, predefined_persona_id) 
WHERE predefined_persona_id IS NOT NULL;
```

---

## Summary: Tables & Fields to Inspect

| Test | Primary Table | Key Fields |
|------|---------------|------------|
| 1. CASL Rejection | `form_submissions` | `result`, `reason` |
| 2. TCPA Rejection | `form_submissions` | `result`, `reason` |
| 3. Valid Submission | `crm_customers`, `form_submissions` | `email_opt_in`, `email_opt_in_at`, `sms_opt_in`, `sms_opt_in_at`, `email_consent_details`, `sms_consent_details`, `metadata` |
| 4. Suppressed Email | `crm_customers`, `email_suppressions` | `suppressed`, `lifted_at` |
| 5. Rate Limiting | `form_rate_limits`, `form_submissions` | `count`, `result` |
| 6. Honeypot Spam | `form_submissions` | `result`, `reason` |
| 7. Existing Customer | `crm_customers`, `customer_personas` | `id` (same), `email_opt_in` (preserved), `opt_out` (untouched) |
| 8. Persona Idempotency | `customer_personas` | `persona_id`, `predefined_persona_id`, duplicate count |

---

## Test Execution Checklist

```
[ ] Test 1: CASL email consent rejection
[ ] Test 2: TCPA SMS consent rejection  
[ ] Test 3: Valid submission with consent timestamps
[ ] Test 4: Suppressed email handling
[ ] Test 5: Rate limiting (5 quick submissions)
[ ] Test 6: Honeypot spam detection
[ ] Test 7: Existing customer resubmission (idempotent upsert)
[ ] Test 8: Persona assignment idempotency (custom + predefined)
```

---

## Cleanup Query

```sql
-- Run after testing to clean up test data
DELETE FROM form_submissions 
WHERE data->>'email' LIKE '%@example.com';

DELETE FROM customer_personas
WHERE customer_id IN (
  SELECT id FROM crm_customers WHERE email LIKE '%@example.com'
);

DELETE FROM crm_customers 
WHERE email LIKE '%@example.com';

DELETE FROM form_rate_limits 
WHERE form_id = 'TEST_FORM_ID';

DELETE FROM email_suppressions 
WHERE email = 'bounced@example.com';
```

---

**Document Version**: 1.0.0  
**Created**: 2026-01-28
