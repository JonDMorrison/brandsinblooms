# 📧 BlooMSuite Email Marketing Governance & Deliverability Policy
## Version 1.0 – Domain Protection & High-Volume Sending Framework
## Applies To: All Tenants Using BlooMSuite Email Marketing App
## Provider: Resend API (Batch Sending)

---

# 1. PURPOSE

This document defines the governance, safety controls, and reputation-protection mechanisms required to operate a high-volume (up to 100,000 emails per campaign) email marketing infrastructure using Resend API.

The primary objective is:

- Protect sending domain reputation
- Prevent blacklist incidents
- Minimize bounce, complaint, and unsubscribe risks
- Maintain high deliverability
- Enforce tenant-level responsibility
- Protect the BlooMSuite master sending infrastructure

---

# 2. CORE PRINCIPLES

1. Domain reputation is a shared infrastructure asset.
2. No tenant may degrade the sender reputation.
3. Deliverability > volume.
4. Sending must automatically slow or stop if risk metrics exceed thresholds.
5. Every email must be traceable, auditable, and attributable to a tenant.

---

# 3. DEFINITIONS

| Term | Meaning |
|------|--------|
| Hard Bounce | Permanent failure (invalid email, domain not found) |
| Soft Bounce | Temporary failure (mailbox full, server busy) |
| Complaint | Recipient marked email as spam |
| Unsubscribe | User opted out |
| Suppression List | Blocked addresses list |
| Sending Reputation Score | Internal computed risk score per tenant |
| Domain Reputation Guard | System module that auto-pauses sending |

---

# 4. GLOBAL DOMAIN PROTECTION RULES

These rules protect the primary sending domain.

## 4.1 Absolute Hard Stop Thresholds

If ANY of the following thresholds are exceeded in a rolling 24-hour window:

- Hard Bounce Rate ≥ 5%
- Complaint Rate ≥ 0.2%
- Spam Rate ≥ 0.3%
- Total Failed Deliveries ≥ 8%
- Rejected Emails ≥ 10%

Then:

- Immediately pause ALL campaigns for that tenant
- Flag tenant for review
- Prevent new campaign launches
- Notify admin + tenant owner
- Require manual review before reactivation

---

## 4.2 Warning Thresholds (Auto Throttle)

If:

- Hard Bounce Rate ≥ 3%
- Complaint Rate ≥ 0.1%
- Soft Bounce ≥ 5%

System will:

- Reduce batch send speed by 50%
- Switch from 10k batch to 2k batch chunks
- Increase delay between batches
- Trigger warning alert in dashboard

---

# 5. TENANT REPUTATION SCORING SYSTEM

Each tenant gets a dynamic reputation score (0–100).

### Base Score: 100

Deductions:

- Hard Bounce: -2 points per 1%
- Complaint: -5 points per 0.1%
- Spam trap detection: -25 points
- Sending to suppressed email: -10 per event
- High unsubscribe spike: -5 per 2% above baseline

Score Tiers:

| Score | Status | Action |
|-------|--------|--------|
| 90–100 | Healthy | Normal sending |
| 75–89 | Warning | Slow sending |
| 60–74 | Risk | Manual approval required |
| <60 | Critical | Sending suspended |

Reputation recalculated every 6 hours.

---

# 6. SUPPRESSION MANAGEMENT POLICY

The system must maintain:

1. Global Suppression List
2. Tenant-level Suppression List
3. Complaint-based Suppression
4. Bounce-based Suppression

Emails must NOT be sent if:

- Email is unsubscribed
- Email previously hard bounced
- Email marked spam
- Email in global blocklist
- Email flagged as role-based address (admin@, support@, etc)

Resend webhook events must immediately update suppression records.

---

# 7. LIST HYGIENE POLICY

Before campaign launch:

System must:

- Validate email format
- Remove duplicates
- Remove previously bounced emails
- Remove unsubscribed emails
- Remove complaint emails
- Remove inactive recipients (no open in 180 days)
- Remove role-based generic emails (optional but recommended)

If list contains:

- >5% invalid addresses → block campaign
- >10% inactive contacts → warning displayed

---

# 8. SENDING WARMUP POLICY

New tenants or new domains must follow warmup schedule:

Day 1: 200 emails
Day 2: 500 emails
Day 3: 1,000 emails
Day 4: 3,000 emails
Day 5: 5,000 emails
Day 6+: Gradual increase based on performance

If bounce <2% and complaint <0.1%, volume may scale.

Warmup must reset if domain paused for 30+ days.

---

# 9. RATE LIMITING & BATCHING POLICY

For 100,000 email campaigns:

- Send in batches of 5,000 max
- 60–120 second delay between batches
- Real-time monitoring after each batch
- Auto-stop if threshold crossed mid-campaign

Never send 100,000 in single burst.

---

# 10. CONTENT COMPLIANCE POLICY

Before sending:

System must check:

- Presence of unsubscribe link (mandatory)
- Physical business address included
- No spam trigger keywords (AI scoring recommended)
- No deceptive subject lines
- Proper from name
- Valid DKIM/SPF alignment

AI-based spam score must be <5/10 before allowing send.

---

# 11. AUTHENTICATION & DOMAIN CONFIGURATION POLICY

Each tenant must:

- Configure SPF
- Configure DKIM
- Configure DMARC (p=none minimum)
- Verify domain ownership
- Use custom domain for high volume

System must prevent 50k+ sending from shared domain.

---

# 12. COMPLAINT HANDLING POLICY

Upon complaint webhook from Resend:

- Immediately suppress recipient
- Log complaint
- Deduct reputation score
- Notify tenant
- If complaints exceed threshold → pause tenant

---

# 13. UNSUBSCRIBE POLICY

- One-click unsubscribe
- Immediate suppression
- Cannot re-subscribe automatically
- Must require manual re-opt-in
- Respect global unsubscribe

Unsubscribe rate >5% triggers warning.

---

# 14. INACTIVE RECIPIENT MANAGEMENT

Recipients inactive for:

- 90 days → mark as "cool"
- 180 days → exclude from campaigns
- 365 days → archive

Tenant must run re-engagement before emailing inactive list.

---

# 15. BLACKLIST MONITORING

System must:

- Monitor domain blacklist status daily
- Monitor IP reputation
- Alert super admin if domain flagged
- Auto-pause all sending if domain blacklisted

---

# 16. EVENT LOGGING & AUDIT

All email events must be logged:

- Sent
- Delivered
- Bounced
- Opened
- Clicked
- Unsubscribed
- Complained
- Deferred
- Rejected

Logs must be tenant-scoped (site_id).

---

# 17. WEBHOOK PROCESSING POLICY (RESEND)

Webhooks must:

- Be verified using signature validation
- Process in idempotent manner
- Update suppression instantly
- Update metrics in near real-time
- Trigger reputation recalculation

If webhook fails:
- Retry with exponential backoff
- Queue in fallback table

---

# 18. ADMIN OVERRIDE POLICY

Super Admin can:

- Pause tenant sending
- Override reputation lock (manual)
- Force domain warmup
- Enforce custom limits
- Blacklist tenant

All overrides logged in audit table.

---

# 19. ANTI-ABUSE POLICY

System must detect:

- Sudden list import >50k contacts
- Sudden send volume spike
- Repeated bounce pattern
- Purchased list pattern behavior

If detected:

- Block campaign
- Require manual approval
- Lock list import until reviewed

---

# 20. DATA STRUCTURE REQUIREMENTS

Minimum tables:

- email_campaigns
- email_recipients
- email_events
- suppression_list
- tenant_reputation
- domain_health_log
- sending_batches
- webhook_logs

All must include:

- site_id (tenant isolation)
- created_at
- updated_at

---

# 21. AUTOMATIC CAMPAIGN PAUSE LOGIC

Campaign auto-pauses if:

- Hard bounce ≥ 5%
- Complaint ≥ 0.2%
- Delivery failure ≥ 8%
- Reputation score <60

Paused campaigns cannot resume automatically.

---

# 22. REPORTING & DASHBOARD METRICS

Each campaign must display:

- Delivery rate
- Open rate
- Click rate
- Hard bounce rate
- Soft bounce rate
- Complaint rate
- Unsubscribe rate
- Reputation impact score

Color-coded risk indicator:

Green / Yellow / Red

---

# 23. DISASTER RECOVERY POLICY

If domain reputation severely damaged:

- Immediate full stop on sending
- Switch to backup sending domain
- Reset sending warmup
- Notify all tenants
- Conduct internal audit

---

# 24. TENANT TERMS ENFORCEMENT

Tenants must agree:

- No purchased lists
- No scraped emails
- No illegal content
- Compliance with CAN-SPAM / GDPR

Violation results in permanent suspension.

---

# 25. FINAL GUARANTEE

No campaign should ever prioritize volume over:

- Deliverability
- Domain safety
- Compliance
- Reputation

BlooMSuite must enforce automatic protection even if tenant attempts high-risk behavior.

---

# END OF DOCUMENT
