# BloomSuite Form Builder v1 — Release Readiness Checklist

**Version**: 1.0.0  
**Last Updated**: 2026-01-28  
**Owner**: Engineering Team

---

## Pre-Release Verification Checklist

### Legend
- ✅ = Verified, passing
- ❌ = Failed, blocking
- ⚠️ = Warning, needs review
- ⏳ = Not yet tested

---

## 1. Edge Functions Deployment

| Check | Status | Verified By | Date |
|-------|--------|-------------|------|
| `get-form-config` deployed and responding | ⏳ | | |
| `submit-form` deployed and responding | ⏳ | | |
| `form-data-cleanup` deployed | ⏳ | | |
| Routes return expected status codes | ⏳ | | |

### Verification Commands

```bash
# Check get-form-config is live
curl -I "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/get-form-config?embed_key=test"
# Expected: HTTP/2 400 (invalid key is fine, means function is live)

# Check submit-form is live  
curl -I -X POST "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/submit-form" \
  -H "Content-Type: application/json" -d '{}'
# Expected: HTTP/2 400 (embed_key required)

# Check form-data-cleanup is live
curl -I -X POST "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/form-data-cleanup" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
# Expected: HTTP/2 200
```

**Go Criteria**: All three functions respond (any status except 5xx connection errors)

---

## 2. CORS Configuration

| Check | Status | Verified By | Date |
|-------|--------|-------------|------|
| OPTIONS preflight returns 204 with CORS headers | ⏳ | | |
| 200 responses include CORS headers | ⏳ | | |
| 400 responses include CORS headers | ⏳ | | |
| 404 responses include CORS headers | ⏳ | | |
| 429 responses include CORS headers | ⏳ | | |

### Verification Commands

```bash
# OPTIONS preflight test
curl -i -X OPTIONS "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/submit-form" \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST"
# Expected: access-control-allow-origin: *

# 400 error includes CORS
curl -i -X POST "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/submit-form" \
  -H "Origin: https://example.com" \
  -H "Content-Type: application/json" \
  -d '{"embed_key": "invalid"}'
# Expected: access-control-allow-origin: * in response headers
```

See full test matrix: `docs/cors-testing-guide.md`

**Go Criteria**: All CORS headers present on all response types

---

## 3. Embed.js Production Hosting

| Check | Status | Verified By | Date |
|-------|--------|-------------|------|
| `embed.js` accessible at production URL | ⏳ | | |
| `embed.css` accessible at production URL | ⏳ | | |
| `embed.v1.js` alias works | ⏳ | | |
| Cache headers correct (stable = 1hr, pinned = 1yr) | ⏳ | | |
| SCRIPT_VERSION matches expected | ⏳ | | |

### Verification Commands

```bash
# Check embed.js is accessible
curl -I "https://forms.bloomsuite.com/embed.js"
# Expected: HTTP/2 200, Cache-Control: public, max-age=3600

# Check embed.css is accessible
curl -I "https://forms.bloomsuite.com/embed.css"
# Expected: HTTP/2 200, Cache-Control: public, max-age=31536000, immutable

# Check pinned version
curl -I "https://forms.bloomsuite.com/embed.v1.0.1.js"
# Expected: HTTP/2 200, Cache-Control: public, max-age=31536000, immutable

# Verify version in script
curl -s "https://forms.bloomsuite.com/embed.js" | grep "SCRIPT_VERSION"
# Expected: var SCRIPT_VERSION = '1.0.1';
```

**Go Criteria**: All embed assets accessible with correct cache headers

---

## 4. Acceptance Tests (1-7)

Reference: `docs/form-builder-acceptance-tests.md`

| Test | Description | Status | Notes |
|------|-------------|--------|-------|
| Test 1 | Basic form submission creates customer | ⏳ | |
| Test 2 | Email consent stored correctly | ⏳ | |
| Test 3 | SMS consent stored correctly | ⏳ | |
| Test 4 | Rate limiting blocks excessive submissions | ⏳ | |
| Test 5 | Honeypot blocks spam | ⏳ | |
| Test 6 | Invalid data rejected with proper errors | ⏳ | |
| Test 7 | UTM tracking captured | ⏳ | |

### Database Inspection SQL

```sql
-- Test 1: Verify customer created
SELECT id, email, first_name, last_name, created_at 
FROM crm_customers 
WHERE email = 'test@example.com' 
ORDER BY created_at DESC LIMIT 1;

-- Test 2 & 3: Verify consent details
SELECT 
  id, 
  email,
  email_consent,
  email_consent_details->>'consent_text' as email_consent_text,
  email_consent_details->>'consented_at' as email_consented_at,
  sms_consent,
  sms_consent_details->>'consent_text' as sms_consent_text,
  sms_consent_details->>'consented_at' as sms_consented_at
FROM crm_customers 
WHERE email = 'test@example.com'
ORDER BY created_at DESC LIMIT 1;

-- Test 4: Verify rate limit records
SELECT * FROM form_rate_limits 
WHERE form_id = 'YOUR_FORM_ID' 
ORDER BY window_start DESC LIMIT 10;

-- Test 7: Verify UTM captured
SELECT 
  id,
  metadata->>'utm_source' as utm_source,
  metadata->>'utm_medium' as utm_medium,
  metadata->>'utm_campaign' as utm_campaign
FROM form_submissions 
WHERE form_id = 'YOUR_FORM_ID'
ORDER BY submitted_at DESC LIMIT 5;
```

**Go Criteria**: All 7 tests passing

---

## 5. Consent Proof Storage

| Check | Status | Verified By | Date |
|-------|--------|-------------|------|
| `form_submissions.metadata` contains consent flags | ⏳ | | |
| `crm_customers.email_consent_details` populated | ⏳ | | |
| `crm_customers.sms_consent_details` populated | ⏳ | | |
| Consent text stored matches form config | ⏳ | | |
| `consented_at` timestamp accurate | ⏳ | | |

### Verification SQL

```sql
-- Check submission metadata
SELECT 
  id,
  metadata->>'consent_email' as email_consent,
  metadata->>'consent_sms' as sms_consent,
  metadata->>'email_consent_text' as email_text,
  metadata->>'sms_consent_text' as sms_text
FROM form_submissions 
WHERE form_id = 'YOUR_FORM_ID'
ORDER BY submitted_at DESC LIMIT 1;

-- Check customer consent details structure
SELECT 
  email,
  email_consent,
  jsonb_pretty(email_consent_details) as email_details,
  sms_consent,
  jsonb_pretty(sms_consent_details) as sms_details
FROM crm_customers 
WHERE email = 'test@example.com';
```

**Expected Structure**:
```json
{
  "consent_text": "I agree to receive marketing emails...",
  "consented_at": "2026-01-28T12:00:00.000Z",
  "form_id": "uuid",
  "submission_id": "uuid",
  "ip_hash": "sha256_hash"
}
```

**Go Criteria**: Both storage locations contain accurate consent proof

---

## 6. Opt-Out Protection

| Check | Status | Verified By | Date |
|-------|--------|-------------|------|
| `submit-form` never modifies `opt_out_email` | ⏳ | | |
| `submit-form` never modifies `opt_out_sms` | ⏳ | | |
| Existing opt-outs preserved after submission | ⏳ | | |

### Verification Process

1. Set a customer to opted-out:
```sql
UPDATE crm_customers 
SET opt_out_email = true, opt_out_sms = true 
WHERE email = 'optout-test@example.com';
```

2. Submit form with that email
3. Verify opt-out flags unchanged:
```sql
SELECT email, opt_out_email, opt_out_sms 
FROM crm_customers 
WHERE email = 'optout-test@example.com';
-- Expected: opt_out_email = true, opt_out_sms = true (unchanged)
```

4. Code inspection: Search `submit-form/index.ts` for `opt_out`:
```bash
grep -n "opt_out" supabase/functions/submit-form/index.ts
# Expected: No matches, or only in comments
```

**Go Criteria**: opt_out fields never modified by form submission

---

## 7. Persona Idempotency

| Check | Status | Verified By | Date |
|-------|--------|-------------|------|
| Partial unique index on `(customer_id, persona_id)` exists | ⏳ | | |
| Partial unique index on `(customer_id, predefined_persona_id)` exists | ⏳ | | |
| Code handles 23505 (unique violation) gracefully | ⏳ | | |
| Duplicate submissions don't create duplicate assignments | ⏳ | | |

### Verification SQL

```sql
-- Check indexes exist
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'customer_personas' 
AND indexdef LIKE '%WHERE%';

-- Expected output:
-- customer_personas_custom_unique | CREATE UNIQUE INDEX ... WHERE persona_id IS NOT NULL
-- customer_personas_predefined_unique | CREATE UNIQUE INDEX ... WHERE predefined_persona_id IS NOT NULL

-- Test idempotency (submit same form twice, check for duplicates)
SELECT 
  customer_id, 
  persona_id, 
  predefined_persona_id, 
  COUNT(*) as count
FROM customer_personas 
WHERE customer_id = 'YOUR_CUSTOMER_ID'
GROUP BY customer_id, persona_id, predefined_persona_id
HAVING COUNT(*) > 1;
-- Expected: No rows (no duplicates)
```

**Go Criteria**: Indexes exist and no duplicates created on repeat submissions

---

## 8. Rate Limit Configuration

| Check | Status | Verified By | Date |
|-------|--------|-------------|------|
| `upsert_rate_limit` RPC function exists | ⏳ | | |
| Atomic UPSERT working (no race conditions) | ⏳ | | |
| `RATE_LIMIT_SALT` secret configured | ⏳ | | |
| Rate limit triggers at correct thresholds | ⏳ | | |

### Verification SQL

```sql
-- Check RPC function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'upsert_rate_limit';

-- Check unique constraint for atomic upsert
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'form_rate_limits'::regclass;
-- Expected: form_rate_limits_form_id_ip_hash_window_start_key
```

### Verification Commands

```bash
# Check secret is set
curl -X POST "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/submit-form" \
  -H "Content-Type: application/json" \
  -d '{"embed_key": "valid_key", "data": {"email": "test@example.com"}}'
# Check logs for: "RATE_LIMIT_SALT not configured" warning
# If warning appears, secret needs to be set
```

**Go Criteria**: RPC exists, constraint exists, RATE_LIMIT_SALT configured (no warning in logs)

---

## 9. Settings Allowlist Security

| Check | Status | Verified By | Date |
|-------|--------|-------------|------|
| `get-form-config` returns only allowlisted fields | ⏳ | | |
| `notification_emails` NOT exposed | ⏳ | | |
| `webhook_url` NOT exposed | ⏳ | | |
| `webhook_secret` NOT exposed | ⏳ | | |
| Internal fields NOT exposed | ⏳ | | |

### Verification Process

1. Add sensitive data to a test form's `settings_json`:
```sql
UPDATE forms SET settings_json = jsonb_set(
  COALESCE(settings_json, '{}'),
  '{notification_emails}',
  '["admin@secret.com"]'
) WHERE id = 'YOUR_TEST_FORM_ID';

UPDATE forms SET settings_json = jsonb_set(
  settings_json,
  '{webhook_url}',
  '"https://secret.webhook.com/endpoint"'
) WHERE id = 'YOUR_TEST_FORM_ID';
```

2. Call get-form-config and verify secrets not returned:
```bash
curl -s "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/get-form-config?embed_key=YOUR_EMBED_KEY" | jq .settings_json
# Expected: NO notification_emails, webhook_url, webhook_secret
```

3. Code inspection:
```bash
grep -A 5 "SETTINGS_ALLOWLIST" supabase/functions/get-form-config/index.ts
# Verify only safe fields listed
```

**Go Criteria**: No sensitive fields in API response

---

## 10. URL Scheme Validation

| Check | Status | Verified By | Date |
|-------|--------|-------------|------|
| `success_redirect_url` only allows http/https | ⏳ | | |
| `javascript:` URLs blocked | ⏳ | | |
| `data:` URLs blocked | ⏳ | | |
| Invalid URLs return null | ⏳ | | |

### Verification Process

1. Add malicious URL to test form:
```sql
UPDATE forms SET settings_json = jsonb_set(
  COALESCE(settings_json, '{}'),
  '{success_redirect_url}',
  '"javascript:alert(1)"'
) WHERE id = 'YOUR_TEST_FORM_ID';
```

2. Verify it's sanitized:
```bash
curl -s "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/get-form-config?embed_key=YOUR_EMBED_KEY" \
  | jq '.settings_json.success_redirect_url'
# Expected: null (blocked)
```

3. Code inspection:
```bash
grep -A 10 "sanitizeValue" supabase/functions/get-form-config/index.ts | grep -A 5 "protocol"
# Expected: Only http: and https: allowed
```

**Go Criteria**: Only http/https URLs pass validation

---

## Go/No-Go Decision Rubric

### Blocking Criteria (Any = NO-GO)

| Category | Blocking Issue |
|----------|----------------|
| **Security** | Sensitive data exposed via API |
| **Security** | CORS headers missing on any response |
| **Security** | opt_out fields modified by form |
| **Security** | javascript: URLs not blocked |
| **Compliance** | Consent proof not stored |
| **Compliance** | Consent text mismatch |
| **Functionality** | Edge functions not responding |
| **Functionality** | Form submissions not creating customers |
| **Functionality** | Rate limiting not working |

### Warning Criteria (Review Required)

| Category | Warning Issue | Mitigation |
|----------|---------------|------------|
| Performance | RATE_LIMIT_SALT not set | Set secret before production traffic |
| Performance | Rate limit RPC missing | Fallback upsert works but less atomic |
| Data | Missing indexes | Create indexes before high traffic |

### Go Decision Matrix

| Result | Criteria |
|--------|----------|
| **GO** | All blocking checks ✅, warnings addressed or accepted |
| **CONDITIONAL GO** | All blocking checks ✅, warnings documented with timeline |
| **NO-GO** | Any blocking check ❌ |

---

## Sign-Off

| Role | Name | Status | Date | Signature |
|------|------|--------|------|-----------|
| QA Lead | | ⏳ | | |
| Security Review | | ⏳ | | |
| Engineering Lead | | ⏳ | | |
| Product Owner | | ⏳ | | |

---

## Post-Release Monitoring

After release, monitor for 24 hours:

- [ ] Edge function error rates < 1%
- [ ] Form submission success rate > 95%
- [ ] No CORS errors in browser consoles
- [ ] Rate limiting triggering appropriately
- [ ] No duplicate customer records
- [ ] Consent data complete for all submissions

---

**Document Version**: 1.0  
**Created**: 2026-01-28  
**Next Review**: Before any Form Builder release
