# 📧 BlooMSuite Email Marketing – Complete UX Status & Risk Visibility Framework
## Version 1.0 – Customer, Campaign, Segment & Persona Experience Design

---

# 1. PURPOSE

This document defines the complete user experience framework for displaying:

- Warnings
- Success indicators
- Errors
- Risk badges
- Domain health visibility
- Campaign risk analysis

Across:

- Customers
- Campaigns
- Segments
- Personas
- Global Email Dashboard

Objective:

Prevent domain reputation damage by making risk visible before it becomes dangerous.

---

# 2. GLOBAL STATUS COLOR SYSTEM

All modules must use consistent visual semantics.

| Color | Meaning | System Behavior |
|--------|----------|----------------|
| 🟢 Green | Healthy / Safe | Normal sending |
| 🟡 Yellow | Warning | Attention required |
| 🟠 Orange | High Risk | Throttled / Restricted |
| 🔴 Red | Critical | Blocked / Paused |
| 🔵 Blue | Informational | Suggestion / Insight |
| ⚫ Grey | Neutral | No activity / Draft |

These must remain consistent across all UI components.

---

# 3. GLOBAL DOMAIN HEALTH BANNER

## 3.1 Placement

The Domain Health Banner must be visible at:

- Email Dashboard (top of page)
- Campaign List page
- Campaign Builder page
- Segment Builder page
- Send Confirmation modal

It must always remain visible when health is Warning or Critical.

---

## 3.2 Healthy State

Display:

Domain Health: 🟢 Healthy
Reputation Score: 94 / 100
Bounce Rate (24h): 1.2%
Complaint Rate (24h): 0.04%
Sending Status: Normal

No restrictions applied.

---

## 3.3 Warning State

Display:

Domain Health: 🟡 Elevated Risk
Reputation Score: 78 / 100
Bounce Rate (24h): 3.4%
Complaint Rate (24h): 0.11%
Sending Status: Throttled Automatically

System Action:

- Batch size reduced
- Sending delay increased
- Warning notification shown

---

## 3.4 Critical State

Display:

Domain Health: 🔴 Sending Paused
Reputation Score: 58 / 100
Complaint Rate exceeded threshold (0.2%)
All campaigns temporarily suspended

System Action:

- New sends blocked
- Running campaigns paused
- Admin + Tenant notified
- Manual review required

---

# 4. CUSTOMER-LEVEL UX DESIGN

## 4.1 Customers List Table

Columns Required:

- Email
- Email Status
- Engagement Status
- Risk Flag
- Last Activity
- Persona
- Segment Count

---

## 4.2 Email Status Badges

| Condition | Badge |
|------------|--------|
| Active | 🟢 Active |
| Unsubscribed | 🔴 Unsubscribed |
| Hard Bounce | 🔴 Hard Bounce |
| Soft Bounce | 🟠 Soft Bounce |
| Spam Complaint | 🔴 Complaint |
| Suppressed | ⚫ Suppressed |

---

## 4.3 Engagement Status Badges

| Condition | Badge |
|------------|--------|
| Opened within 30 days | 🟢 Engaged |
| No open for 90 days | 🟡 Cooling |
| No open for 180 days | 🟠 Inactive |
| No open for 365 days | 🔴 Dormant |

---

## 4.4 Customer Profile – Email Health Panel

Example (Healthy):

Email Health
Status: 🟢 Active
Total Deliveries: 18
Open Rate: 62%
Click Rate: 24%
Last Engagement: 3 days ago

Example (Hard Bounce):

Email Health
Status: 🔴 Hard Bounce
Reason: Invalid Mailbox
Date: Jan 12, 2026
Suppressed Automatically

---

## 4.5 Customer Risk Flags

Displayed beside email address:

- 🟡 Generic Address (admin@, support@)
- 🟠 Multiple Soft Bounces
- 🟡 Imported Contact
- 🔴 Previous Spam Complaint

---

# 5. CAMPAIGN-LEVEL UX DESIGN

## 5.1 Campaign List Table

Columns:

- Campaign Name
- Status
- Health
- Sent
- Delivery %
- Bounce %
- Complaint %
- Reputation Impact

---

## 5.2 Campaign Status Badges

| Status | Badge |
|---------|--------|
| Draft | ⚫ Draft |
| Scheduled | 🔵 Scheduled |
| Sending | 🔵 Sending |
| Completed | 🟢 Completed |
| Throttled | 🟠 Throttled |
| Paused | 🔴 Paused |
| Blocked | 🔴 Blocked |
| Failed | 🔴 Failed |

---

## 5.3 Campaign Health Badge

Displayed next to campaign name.

| Condition | Badge |
|------------|--------|
| All metrics healthy | 🟢 Healthy |
| Bounce elevated | 🟡 Bounce Warning |
| Complaint rising | 🟠 Complaint Risk |
| Threshold exceeded | 🔴 Reputation Threat |

---

# 6. LIVE SENDING MONITOR

When campaign is running, show:

Batch 4 of 20
Sent: 20,000
Delivered: 96%
Hard Bounce: 2.3% 🟡
Complaint: 0.07% 🟢
Unsubscribe: 0.9% 🟢

If threshold crossed:

Sending Paused Automatically
Complaint rate exceeded 0.2%.
Campaign stopped to protect domain reputation.

Send button becomes disabled.

---

# 7. PRE-SEND RISK ANALYSIS

Before clicking “Send”, system must evaluate:

- Segment size
- Inactive percentage
- Bounce history
- Complaint history
- Tenant reputation score

---

## 7.1 Risk Analysis Modal Example

Campaign Risk Analysis

Recipients: 82,300
Inactive Contacts: 14%
Previous Hard Bounce Rate: 3.2%
Complaint Risk Prediction: Moderate

Expected Risk Level: 🟠 High

Recommendation:

- Remove inactive contacts
- Exclude previous bounce emails
- Reduce batch size

---

## 7.2 Send Button Logic

| Risk Level | Button State |
|-------------|--------------|
| Low | 🟢 Enabled |
| Medium | 🟡 Enabled with Warning |
| High | 🟠 Confirmation Required |
| Critical | 🔴 Disabled |

---

# 8. SEGMENT-LEVEL UX DESIGN

## 8.1 Segment List Table

Columns:

- Segment Name
- Total Contacts
- Active %
- Inactive %
- Bounce %
- Risk Level
- Last Used

---

## 8.2 Segment Risk Badge

| Condition | Badge |
|------------|--------|
| Clean list | 🟢 Clean |
| 10% inactive | 🟡 Aging |
| 20% inactive | 🟠 Risky |
| 5% bounce history | 🔴 Dangerous |

---

## 8.3 Segment Detail Health Panel

Segment Health

Total Contacts: 25,000
Active: 72%
Inactive: 18%
Hard Bounce History: 2.4%
Complaint History: 0.09%

Overall Risk Level: 🟡 Moderate

---

# 9. PERSONA-LEVEL UX DESIGN

## 9.1 Persona List View

Columns:

- Persona Name
- Contact Count
- Engagement Rate
- Revenue Generated
- Email Health

---

## 9.2 Persona Health Badge

| Condition | Badge |
|------------|--------|
| High engagement | 🟢 Engaged Persona |
| Moderate engagement | 🟡 Passive Persona |
| Low engagement | 🟠 Cold Persona |
| High complaints | 🔴 Risk Persona |

---

## 9.3 Persona Detail View

Persona: Discount Seekers

Open Rate: 64%
Click Rate: 28%
Unsubscribe Rate: 3.2% 🟡
Complaint Rate: 0.15% 🟠

System Warning (if needed):

This persona has elevated complaint risk.
Consider reducing frequency or refining content.

---

# 10. AUTOMATED ALERT SYSTEM

Warnings must appear when:

- Bounce rate rising
- Complaint rate rising
- Engagement dropping
- Inactive list growing
- Reputation score decreasing

Displayed via:

- Top banner
- Dashboard alerts
- Campaign builder warnings
- Notification bell
- Email to tenant owner (if critical)

---

# 11. SUCCESS STATES

After campaign completion:

Campaign Completed Successfully

Delivery Rate: 97.2%
Hard Bounce: 1.1%
Complaint: 0.05%
Unsubscribe: 1.4%
Reputation Impact: Positive

If metrics improved reputation:

Reputation Score Increased by +2

---

# END OF DOCUMENT
