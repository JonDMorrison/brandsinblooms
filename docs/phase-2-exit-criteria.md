# BloomSuite Form Builder — Phase 2 Exit Criteria

**Document Purpose:** Define the explicit conditions under which Phase 2 is considered complete and ready for stakeholder sign-off.

---

## Phase 2 Completion Checklist

All criteria must be marked **PASS** before Phase 2 can be closed.

---

### 1. Self-Service Form Creation

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1.1 | Non-technical user can create a form end-to-end without assistance | ☐ PASS | QA checklist §1 |
| 1.2 | Template selection provides starting point for common use cases | ☐ PASS | Templates: Newsletter, VIP, Event |
| 1.3 | Drag-and-drop field reordering is functional | ☐ PASS | Manual test |
| 1.4 | Field properties (label, required, placeholder) are editable inline | ☐ PASS | Manual test |
| 1.5 | Form can be published with one click | ☐ PASS | Manual test |

---

### 2. Self-Service Embedding

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 2.1 | Embed code is displayed after publishing | ☐ PASS | UI verification |
| 2.2 | Copy-to-clipboard works with visual feedback | ☐ PASS | Manual test |
| 2.3 | Documentation exists for WordPress, Squarespace, Shopify | ☐ PASS | `docs/form-builder-user-guide.md` |
| 2.4 | Embedded form renders correctly on external site | ☐ PASS | Cross-platform test |
| 2.5 | No developer intervention required for embedding | ☐ PASS | User testing |

---

### 3. Submission Inspection & Export

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 3.1 | Submissions tab shows all form submissions | ☐ PASS | UI verification |
| 3.2 | Submissions can be filtered by date range | ☐ PASS | Manual test |
| 3.3 | Submissions can be filtered by status (accepted/rejected) | ☐ PASS | Manual test |
| 3.4 | Submissions can be searched by email | ☐ PASS | Manual test |
| 3.5 | Rejection reason is visible in plain language | ☐ PASS | UI verification |
| 3.6 | Submission detail modal shows full data | ☐ PASS | Manual test |
| 3.7 | CSV export is functional | ☐ PASS | Export test |
| 3.8 | Export respects active filters | ☐ PASS | Manual test |
| 3.9 | Support can diagnose failed submission in <60 seconds | ☐ PASS | Timed test |

---

### 4. Brand-Aligned Styling

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 4.1 | Primary color is configurable | ☐ PASS | Settings UI |
| 4.2 | Button style options are available (filled, outline, rounded) | ☐ PASS | Settings UI |
| 4.3 | Border radius is configurable | ☐ PASS | Settings UI |
| 4.4 | Spacing options are available | ☐ PASS | Settings UI |
| 4.5 | Font selection is available | ☐ PASS | Settings UI |
| 4.6 | Preview matches live embed appearance | ☐ PASS | Visual comparison |
| 4.7 | All styling uses existing SETTINGS_ALLOWLIST keys only | ☐ PASS | Code review |

---

### 5. Analytics (Basic, Read-Only)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 5.1 | Total submissions metric is displayed | ☐ PASS | Analytics tab |
| 5.2 | Accepted/rejected counts are displayed | ☐ PASS | Analytics tab |
| 5.3 | Acceptance rate is calculated | ☐ PASS | Analytics tab |
| 5.4 | Last submission timestamp is shown | ☐ PASS | Analytics tab |
| 5.5 | Top referrer URLs are listed | ☐ PASS | Analytics tab |
| 5.6 | No per-user tracking implemented | ☐ PASS | Code review |

---

### 6. Phase 1 Integrity

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 6.1 | No modifications to consent logic | ☐ PASS | Git diff |
| 6.2 | No modifications to rate limiting logic | ☐ PASS | Git diff |
| 6.3 | No modifications to spam detection | ☐ PASS | Git diff |
| 6.4 | No modifications to RLS policies | ☐ PASS | Git diff |
| 6.5 | No modifications to `form-submit` edge function core logic | ☐ PASS | Git diff |
| 6.6 | All Phase 1 tests still pass | ☐ PASS | Test suite |

---

### 7. No New Public Endpoints

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 7.1 | No new edge functions created | ☐ PASS | `supabase/functions/` audit |
| 7.2 | No new public API routes | ☐ PASS | Code review |
| 7.3 | All new queries use existing RLS-protected tables | ☐ PASS | Code review |
| 7.4 | Analytics derived from existing `form_submissions` table only | ☐ PASS | Code review |

---

### 8. Documentation

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 8.1 | User guide created | ☐ PASS | `docs/form-builder-user-guide.md` |
| 8.2 | Embedding instructions for major platforms | ☐ PASS | User guide §1 |
| 8.3 | Consent explanation in plain language | ☐ PASS | User guide §2 |
| 8.4 | Troubleshooting guide | ☐ PASS | User guide §3 |
| 8.5 | QA checklist created | ☐ PASS | `docs/phase-2-qa-checklist.md` |

---

## Summary

| Category | Total | Passed | Status |
|----------|-------|--------|--------|
| Self-Service Form Creation | 5 | | |
| Self-Service Embedding | 5 | | |
| Submission Inspection & Export | 9 | | |
| Brand-Aligned Styling | 7 | | |
| Analytics | 6 | | |
| Phase 1 Integrity | 6 | | |
| No New Public Endpoints | 4 | | |
| Documentation | 5 | | |
| **TOTAL** | **47** | | |

**Phase 2 Exit Requirement:** 47/47 criteria must PASS

---

## Deferred Features (Phase 3+)

The following features are explicitly **out of scope** for Phase 2 and deferred to future phases:

### Phase 3: Advanced Form Features

| Feature | Rationale for Deferral |
|---------|------------------------|
| Conditional field logic (show/hide based on answers) | Requires new data model for field dependencies |
| Multi-page/wizard forms | Significant UX complexity |
| File upload fields | Requires storage bucket setup and security review |
| Custom validation rules (regex patterns) | Needs UI for non-technical pattern building |
| Form versioning/history | Requires version control data model |
| A/B testing for forms | Needs analytics infrastructure |

### Phase 3: Advanced Analytics

| Feature | Rationale for Deferral |
|---------|------------------------|
| Conversion funnel tracking | Requires session tracking (privacy implications) |
| Time-to-complete metrics | Requires client-side timing events |
| Field-level drop-off analysis | Requires partial submission tracking |
| Geographic breakdown | Requires IP geolocation (privacy implications) |
| Device/browser breakdown | Requires user-agent parsing |
| Custom date comparison (week-over-week, etc.) | UI complexity |

### Phase 3: Integrations

| Feature | Rationale for Deferral |
|---------|------------------------|
| Zapier/webhook on submission | Requires new endpoint and security review |
| Direct CRM sync (beyond current customer creation) | Requires mapping UI |
| Slack/email notifications per submission | Requires notification infrastructure |
| Google Sheets export | Requires OAuth integration |
| Mailchimp/Klaviyo direct sync | Requires OAuth integration |

### Phase 3: Advanced Embedding

| Feature | Rationale for Deferral |
|---------|------------------------|
| Popup/modal embed option | Requires trigger configuration UI |
| Slide-in embed option | Requires animation and position settings |
| Exit-intent trigger | Requires client-side behavior tracking |
| Timed trigger | Requires client-side timer |
| Scroll-depth trigger | Requires client-side scroll tracking |

### Phase 3: Support Tools

| Feature | Rationale for Deferral |
|---------|------------------------|
| Submission replay (see what user saw) | Requires form state capture |
| Bulk actions on submissions | Needs careful permission design |
| Submission notes/tagging | Requires new data model |
| Support escalation workflow | Requires ticketing integration |

### Phase 4+: Enterprise Features

| Feature | Rationale for Deferral |
|---------|------------------------|
| Custom CSS injection | Security review required |
| White-label embed domain | Infrastructure change |
| HIPAA-compliant forms | Requires compliance audit |
| Signed submissions (audit trail) | Requires cryptographic implementation |
| Form access controls (team permissions) | Requires RBAC expansion |

---

## Sign-Off

| Role | Name | Date | Phase 2 Complete? |
|------|------|------|-------------------|
| Engineering Lead | | | ☐ Yes ☐ No |
| Product Owner | | | ☐ Yes ☐ No |
| QA Lead | | | ☐ Yes ☐ No |
| Support Lead | | | ☐ Yes ☐ No |

**Phase 2 is COMPLETE when all sign-offs are obtained.**

---

*Document Version: 1.0*  
*Created: January 2026*
