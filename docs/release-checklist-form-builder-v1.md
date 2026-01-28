# BloomSuite Form Builder v1.0.0 - Release Readiness Checklist

**Version**: 1.0.0  
**Last Updated**: 2026-01-28  
**Owner**: Engineering Team  
**Status**: FINAL

---

## Canonical Consent Semantics

The following field definitions are **non-negotiable** and apply to all form builder operations:

### crm_customers Fields

| Field | Type | Description | Form Behavior |
|-------|------|-------------|---------------|
| `opt_out` | boolean | Global hard suppression (unsubscribe all) | **NEVER modified by forms** |
| `email_opt_in` | boolean | Email channel permission | Only set to `true` on explicit consent; NEVER set to `false` |
| `sms_opt_in` | boolean | SMS channel permission | Only set to `true` on explicit consent; NEVER set to `false` |
| `email_consent_details` | JSONB | Legal proof of email consent | Updated with latest consent proof when granted |
| `sms_consent_details` | JSONB | Legal proof of SMS consent | Updated with latest consent proof when granted |
| `suppressed` | boolean | Technical send block (bounce/spam) | Read-only from forms; set by webhooks |

### Consent Rules

1. `submit-form` **NEVER** modifies `opt_out` field
2. `submit-form` **ONLY** sets `email_opt_in = true` when explicit consent is granted
3. `submit-form` **ONLY** sets `sms_opt_in = true` when explicit consent is granted
4. `submit-form` **NEVER** sets `email_opt_in = false` or `sms_opt_in = false`
5. Consent can only be "upgraded" (false->true), never "downgraded" (true->false)
6. Original `email_opt_in_at` and `sms_opt_in_at` timestamps are preserved on resubmission
7. `email_consent_details` and `sms_consent_details` are updated on each consent grant
8. Consent details include: `consent_text`, `consent_required`, `page_url`, `referrer`, `consented_at`, `form_id`, `submission_id`, `ip_hash`

### Code References

- **Consent logic**: `supabase/functions/submit-form/index.ts` lines 600-655
- **opt_out protection**: Lines 603-605 explicitly document opt_out is never touched
- **Upgrade-only logic**: Lines 614-633 (email) and 635-655 (SMS)

---

## Pre-Release Verification Checklist

### Legend
- [ ] = Not yet tested
- [x] = Verified, passing
- [!] = Failed, blocking
- [?] = Warning, needs review

---

## 1. Edge Functions Deployment

| Check | Status | Verified By | Date |
|-------|--------|-------------|------|
| `get-form-config` deployed and responding | [ ] | | |
| `submit-form` deployed and responding | [ ] | | |
| `form-data-cleanup` deployed | [ ] | | |
| Routes return expected status codes | [ ] | | |

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
| OPTIONS preflight returns 204 with CORS headers | [ ] | | |
| 200 responses include CORS headers | [ ] | | |
| 400 responses include CORS headers | [ ] | | |
| 404 responses include CORS headers | [ ] | | |
| 429 responses include CORS headers | [ ] | | |

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
| `embed.js` accessible at production URL | [ ] | | |
| `embed.css` accessible at production URL | [ ] | | |
| `embed.v1.js` alias works | [ ] | | |
| `embed.v1.0.0.js` pinned version works | [ ] | | |
| Cache headers correct (stable = 1hr, pinned = 1yr) | [ ] | | |
| SCRIPT_VERSION = '1.0.1' | [ ] | | |

### Verification Commands

```bash
# Check embed.js is accessible (use project preview URL until custom domain configured)
curl -I "https://brandsinblooms.lovable.app/forms/embed.js"
# Expected: HTTP/2 200, Cache-Control: public, max-age=3600

# Check embed.css is accessible
curl -I "https://brandsinblooms.lovable.app/forms/embed.css"
# Expected: HTTP/2 200, Cache-Control: public, max-age=31536000, immutable

# Check pinned version
curl -I "https://brandsinblooms.lovable.app/forms/embed.v1.0.0.js"
# Expected: HTTP/2 200, Cache-Control: public, max-age=31536000, immutable

# Verify version in script
curl -s "https://brandsinblooms.lovable.app/forms/embed.js" | grep "SCRIPT_VERSION"
# Expected: var SCRIPT_VERSION = '1.0.1';
```

**Go Criteria**: All embed assets accessible with correct cache headers

---

## 4. Acceptance Tests (1-8)

Reference: `docs/form-builder-acceptance-tests.md`

| Test | Description | Status | Notes |
|------|-------------|--------|-------|
| Test 1 | CASL email consent rejection | [ ] | |
| Test 2 | TCPA SMS consent rejection | [ ] | |
| Test 3 | Valid submission with consent timestamps | [ ] | |
| Test 4 | Suppressed email handling | [ ] | |
| Test 5 | Rate limiting | [ ] | |
| Test 6 | Honeypot spam detection | [ ] | |
| Test 7 | Existing customer resubmission (idempotent) | [ ] | |
| Test 8 | Persona assignment idempotency | [ ] | |

### Database Inspection SQL

```sql
-- Test 1: Verify customer created
SELECT id, email, first_name, last_name, created_at 
FROM crm_customers 
WHERE email = 'test@example.com' 
ORDER BY created_at DESC LIMIT 1;

-- Test 2 & 3: Verify consent fields (CORRECT field names)
SELECT 
  id, 
  email,
  email_opt_in,
  email_opt_in_at,
  email_consent_details->>'consent_text' as email_consent_text,
  email_consent_details->>'consented_at' as email_consented_at,
  sms_opt_in,
  sms_opt_in_at,
  sms_consent_details->>'consent_text' as sms_consent_text,
  sms_consent_details->>'consented_at' as sms_consented_at
FROM crm_customers 
WHERE email = 'test@example.com'
ORDER BY created_at DESC LIMIT 1;

-- Test 4: Verify rate limit records
SELECT * FROM form_rate_limits 
WHERE form_id = 'YOUR_FORM_ID' 
ORDER BY window_start DESC LIMIT 10;

-- Test 7: Verify UTM captured in form_submissions metadata
SELECT 
  id,
  metadata->>'utm_source' as utm_source,
  metadata->>'utm_medium' as utm_medium,
  metadata->>'utm_campaign' as utm_campaign
FROM form_submissions 
WHERE form_id = 'YOUR_FORM_ID'
ORDER BY submitted_at DESC LIMIT 5;
```

**Go Criteria**: All 8 tests passing

---

## 5. Consent Proof Storage

| Check | Status | Verified By | Date |
|-------|--------|-------------|------|
| `form_submissions.metadata` contains consent flags | [ ] | | |
| `crm_customers.email_consent_details` populated | [ ] | | |
| `crm_customers.sms_consent_details` populated | [ ] | | |
| Consent text stored matches form config | [ ] | | |
| `consented_at` timestamp accurate | [ ] | | |

### Verification SQL

```sql
-- Check submission metadata (consent booleans and text)
SELECT 
  id,
  metadata->>'email_consent' as email_consent,
  metadata->>'sms_consent' as sms_consent,
  metadata->>'email_consent_text' as email_text,
  metadata->>'sms_consent_text' as sms_text,
  metadata->>'email_consent_at' as email_consent_at,
  metadata->>'sms_consent_at' as sms_consent_at
FROM form_submissions 
WHERE form_id = 'YOUR_FORM_ID'
ORDER BY submitted_at DESC LIMIT 1;

-- Check customer consent details structure (CORRECT field names)
SELECT 
  email,
  email_opt_in,
  email_opt_in_at,
  jsonb_pretty(email_consent_details) as email_details,
  sms_opt_in,
  sms_opt_in_at,
  jsonb_pretty(sms_consent_details) as sms_details
FROM crm_customers 
WHERE email = 'test@example.com';
```

**Expected email_consent_details Structure**:
```json
{
  "consent_text": "I agree to receive marketing emails...",
  "consent_required": true,
  "page_url": "https://example.com/signup",
  "referrer": "https://google.com",
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
| `submit-form` never modifies `opt_out` | [ ] | | |
| Existing opt_out preserved after submission | [ ] | | |

### Verification Process

1. Set a customer to opted-out:
```sql
UPDATE crm_customers 
SET opt_out = true 
WHERE email = 'optout-test@example.com';
```

2. Submit form with that email
3. Verify opt_out flag unchanged:
```sql
SELECT email, opt_out, email_opt_in, sms_opt_in 
FROM crm_customers 
WHERE email = 'optout-test@example.com';
-- Expected: opt_out = true (unchanged)
```

4. Code inspection: Search `submit-form/index.ts` for `opt_out`:
```bash
grep -n "opt_out" supabase/functions/submit-form/index.ts
# Expected: Only in comments (lines 603-605), never in customerData assignment
```

**Go Criteria**: opt_out field never modified by form submission

---

## 7. Persona Idempotency

| Check | Status | Verified By | Date |
|-------|--------|-------------|------|
| Partial unique index on `(customer_id, persona_id)` exists | [ ] | | |
| Partial unique index on `(customer_id, predefined_persona_id)` exists | [ ] | | |
| Code handles 23505 (unique violation) gracefully | [ ] | | |
| Duplicate submissions don't create duplicate assignments | [ ] | | |

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
| `upsert_rate_limit` RPC function exists | [ ] | | |
| Atomic UPSERT working (no race conditions) | [ ] | | |
| `RATE_LIMIT_SALT` secret configured | [ ] | | |
| Rate limit triggers at correct thresholds | [ ] | | |

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
# Check secret is set (look for warning in logs)
curl -X POST "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/submit-form" \
  -H "Content-Type: application/json" \
  -d '{"embed_key": "valid_key", "data": {"email": "test@example.com"}}'
# Check logs for: "RATE_LIMIT_SALT not configured" warning
# If warning appears, secret needs to be set
```

**Go Criteria**: RPC exists (or fallback works), constraint exists, RATE_LIMIT_SALT configured (no warning in logs)

---

## 9. Settings Allowlist Security

| Check | Status | Verified By | Date |
|-------|--------|-------------|------|
| `get-form-config` returns only allowlisted fields | [ ] | | |
| `notification_emails` NOT exposed | [ ] | | |
| `webhook_url` NOT exposed | [ ] | | |
| `webhook_secret` NOT exposed | [ ] | | |
| Internal fields NOT exposed | [ ] | | |

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
| `success_redirect_url` only allows http/https | [ ] | | |
| `javascript:` URLs blocked | [ ] | | |
| `data:` URLs blocked | [ ] | | |
| Invalid URLs return null | [ ] | | |

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

## Security & Abuse Protection Summary

| Protection | Implementation | File |
|------------|----------------|------|
| Settings allowlist | `SETTINGS_ALLOWLIST` object with explicit allowlist | `get-form-config/index.ts:245-275` |
| URL scheme validation | `sanitizeValue()` blocks non-http(s) protocols | `get-form-config/index.ts:327-364` |
| Atomic rate limiting | UPSERT with unique constraint on `(form_id, ip_hash, window_start)` | `submit-form/index.ts:130-220` |
| IP hashing | SHA-256 with `RATE_LIMIT_SALT` | `submit-form/index.ts:100-108` |
| Honeypot detection | Checks `_honeypot`, `honeypot`, `_hp`, `website`, `url`, `_blank` | `submit-form/index.ts:225-237` |
| CORS on all responses | `jsonResponse()` helper includes CORS headers | Both edge functions |
| Consent preservation | Only upgrade consent, never downgrade | `submit-form/index.ts:600-655` |
| opt_out protection | Field never modified by form submission | `submit-form/index.ts:603-605` |
| Persona idempotency | Partial unique indexes + 23505 error handling | `submit-form/index.ts` |

---

## Go/No-Go Decision Rubric

### Blocking Criteria (Any = NO-GO)

| Category | Blocking Issue |
|----------|----------------|
| **Security** | Sensitive data exposed via API |
| **Security** | CORS headers missing on any response |
| **Security** | `opt_out` field modified by form |
| **Security** | `javascript:` URLs not blocked |
| **Compliance** | Consent proof not stored in `email_consent_details` / `sms_consent_details` |
| **Compliance** | Consent text mismatch between form config and stored proof |
| **Functionality** | Edge functions not responding |
| **Functionality** | Form submissions not creating customers |
| **Functionality** | Rate limiting not working |

### Warning Criteria (Review Required)

| Category | Warning Issue | Mitigation |
|----------|---------------|------------|
| Performance | RATE_LIMIT_SALT not set | Set secret before production traffic |
| Performance | Rate limit RPC missing | Fallback upsert works but less atomic |
| Data | Missing partial unique indexes | Create indexes before high traffic |

### Go Decision Matrix

| Result | Criteria |
|--------|----------|
| **GO** | All blocking checks pass, warnings addressed or accepted |
| **CONDITIONAL GO** | All blocking checks pass, warnings documented with timeline |
| **NO-GO** | Any blocking check fails |

---

## Sign-Off

| Role | Name | Status | Date | Signature |
|------|------|--------|------|-----------|
| QA Lead | | [ ] | | |
| Security Review | | [ ] | | |
| Engineering Lead | | [ ] | | |
| Product Owner | | [ ] | | |

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

## Final Embed Snippet (Production)

```html
<!-- BloomSuite Form Embed -->
<div data-bloomsuite-form="YOUR_EMBED_KEY"></div>
<script src="https://brandsinblooms.lovable.app/forms/embed.js" async></script>
```

### CSP Requirements (Minimal)
```http
Content-Security-Policy: 
  script-src 'self' https://brandsinblooms.lovable.app;
  style-src 'self' https://brandsinblooms.lovable.app;
  connect-src 'self' https://udldmkqwnxhdeztyqcau.supabase.co;
```

---

**Document Version**: 1.0.0  
**Created**: 2026-01-28  
**Next Review**: Before any Form Builder release
