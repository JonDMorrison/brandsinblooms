# BloomSuite Form Builder v1.0.0 - Release Decision Summary

**Date**: 2026-01-28  
**Prepared By**: Engineering Team  
**Status**: READY FOR QA EXECUTION

---

## Executive Summary

The Form Builder v1.0.0 codebase has been audited for release readiness. All documentation has been corrected to match the canonical data model. No code changes were required - the implementation is correct.

---

## Canonical Consent Semantics (Confirmed)

### crm_customers Fields (Source of Truth)

| Field | Type | Exists | Form Behavior |
|-------|------|--------|---------------|
| `opt_out` | boolean | YES | **NEVER modified** |
| `email_opt_in` | boolean | YES | Only set to `true` on explicit consent |
| `sms_opt_in` | boolean | YES | Only set to `true` on explicit consent |
| `email_consent_details` | JSONB | YES | Updated with consent proof |
| `sms_consent_details` | JSONB | YES | Updated with consent proof |
| `suppressed` | boolean | YES | Read-only from forms |

### Non-Existent Fields (Removed from Docs)

| Field | Status |
|-------|--------|
| `opt_out_email` | DOES NOT EXIST - removed from checklist |
| `opt_out_sms` | DOES NOT EXIST - removed from checklist |
| `email_consent` (column) | DOES NOT EXIST - only in form payload |
| `sms_consent` (column) | DOES NOT EXIST - only in form payload |

### Code Compliance (Verified)

| Rule | Status | Evidence |
|------|--------|----------|
| `submit-form` NEVER modifies `opt_out` | COMPLIANT | Lines 603-605 explicitly document this |
| `submit-form` ONLY sets `email_opt_in = true` on consent | COMPLIANT | Lines 614-633 |
| `submit-form` ONLY sets `sms_opt_in = true` on consent | COMPLIANT | Lines 635-655 |
| `submit-form` NEVER sets opt-in to `false` | COMPLIANT | No false assignments exist |

---

## Documentation Corrections Made

### Release Checklist (`docs/release-checklist-form-builder-v1.md`)

| Issue | Fix |
|-------|-----|
| `opt_out_email` references | Changed to `opt_out` |
| `opt_out_sms` references | Removed (no such field) |
| `email_consent` as column | Changed to `email_opt_in` |
| `sms_consent` as column | Changed to `sms_opt_in` |
| SQL queries using wrong fields | All updated |
| Version 1.0.1 in embed section | Noted as current script version |
| Consent details structure | Documented correct JSONB schema |

### Acceptance Tests (`docs/form-builder-acceptance-tests.md`)

| Issue | Fix |
|-------|-----|
| Test 3 using `email_consent` column | Changed to `email_opt_in` |
| Test 7 using `opt_out` incorrectly | Fixed to verify it's untouched |
| All inspection queries | Updated to correct field names |
| Added canonical field reference | Documents what exists vs. doesn't |

---

## Security & Abuse Protection (Confirmed)

| Protection | Implementation | Status |
|------------|----------------|--------|
| Settings allowlist | `SETTINGS_ALLOWLIST` in get-form-config | IMPLEMENTED |
| URL scheme validation | Only http/https allowed | IMPLEMENTED |
| Atomic rate limiting | UPSERT with unique constraint | IMPLEMENTED |
| IP hashing | SHA-256 with RATE_LIMIT_SALT | IMPLEMENTED |
| Honeypot detection | 6 honeypot field names checked | IMPLEMENTED |
| CORS on all responses | `jsonResponse()` helper | IMPLEMENTED |
| Consent preservation | Upgrade-only logic | IMPLEMENTED |
| opt_out protection | Never modified by forms | IMPLEMENTED |
| Persona idempotency | Partial unique indexes + 23505 handling | IMPLEMENTED |

---

## Embed Script Contract (v1.0.1)

| Attribute | Value |
|-----------|-------|
| SCRIPT_VERSION | `'1.0.1'` |
| Stable URL | `https://brandsinblooms.lovable.app/forms/embed.js` |
| CSS URL | `https://brandsinblooms.lovable.app/forms/embed.css` |
| Pinned URL | `https://brandsinblooms.lovable.app/forms/embed.v1.0.0.js` |
| Consent pre-checked | **NEVER** (line 11 documents this) |
| Meta captured | `page_url`, `referrer`, `utm_*`, `user_agent` |

### Production Embed Snippet
```html
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

## Pre-Release Blocking Criteria

| # | Criteria | Status | Notes |
|---|----------|--------|-------|
| 1 | Edge functions deployed and responding | PENDING QA | curl tests required |
| 2 | CORS headers on all response types | IMPLEMENTED | Code verified |
| 3 | opt_out never modified by forms | COMPLIANT | Code verified |
| 4 | Consent proof stored correctly | IMPLEMENTED | Code verified |
| 5 | javascript: URLs blocked | IMPLEMENTED | sanitizeValue() |
| 6 | Rate limiting functional | IMPLEMENTED | Code verified |
| 7 | Settings allowlist enforced | IMPLEMENTED | Code verified |

---

## Pre-Release Warnings

| # | Warning | Risk | Mitigation |
|---|---------|------|------------|
| 1 | RATE_LIMIT_SALT may not be configured | Medium | Set secret before production traffic |
| 2 | `upsert_rate_limit` RPC may be missing | Low | Fallback upsert is atomic via constraint |
| 3 | Production embed URLs use project subdomain | Low | Configure custom domain when available |

---

## Go/No-Go Decision

### Current Status: CONDITIONAL GO

**Rationale**:
- All blocking criteria pass at the code level
- Documentation has been corrected to match implementation
- QA must execute acceptance tests (1-8) to confirm runtime behavior
- RATE_LIMIT_SALT secret must be verified/set

### Required Before Launch

1. [ ] Execute all 8 acceptance tests with database verification
2. [ ] Verify RATE_LIMIT_SALT is configured (check edge function logs)
3. [ ] Verify embed assets accessible at production URLs
4. [ ] Complete sign-off from QA, Security, Engineering, Product

### Final Decision

| Outcome | Trigger |
|---------|---------|
| **GO** | All acceptance tests pass, no blocking issues found |
| **CONDITIONAL GO** | Acceptance tests pass, warnings documented with timeline |
| **NO-GO** | Any acceptance test fails on blocking criteria |

---

## Artifacts Updated

| Document | Version | Status |
|----------|---------|--------|
| `docs/release-checklist-form-builder-v1.md` | 1.0.0 | CORRECTED |
| `docs/form-builder-acceptance-tests.md` | 1.0.0 | CORRECTED |
| `docs/release-decision-form-builder-v1.md` | 1.0.0 | NEW |

---

## Sign-Off

| Role | Name | Decision | Date |
|------|------|----------|------|
| QA Lead | | PENDING | |
| Security Review | | PENDING | |
| Engineering Lead | | PENDING | |
| Product Owner | | PENDING | |

---

**Document Version**: 1.0.0  
**Created**: 2026-01-28
