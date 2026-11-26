# Newsletter Builder 2.0 checklist

Source: Jon's "Newsletter Builder 2.0" brief, 2026-11-26. This file is the resume point for the work.
Update it in every pull request. Mark an item Done only with evidence.

Status words: **Done** (merged, deployed, checked live), **Merged** (in main, not yet checked live),
**Open** (not started), **Partial** (some of it shipped, the gap is written down).

Rules that stay in force for every step:

- Northfield Garden Center is the test account. No real customer campaign is edited.
- No live marketing email is sent for testing. Use fixtures and mocked delivery.
- Consent, unsubscribe, suppression and sender-identity safeguards are never weakened.
- The draft email to Mike is written but not sent without Jon's approval.

## Milestone A: stability and shared controls

| Item | Status | Evidence / gap |
| --- | --- | --- |
| Campaigns page crash (#676) | Not reproducible | 2026-11-26, Northfield, production: sidebar entry, direct URL, full reload, Drafts / Scheduled / Sent / Failed / All filters, Table and Cards views. No error boundary, no console errors. The list page was rebuilt in #679 after the incident. No stack trace exists for the original incident, so no root cause is claimed. |
| One copy per contact across segments | Merged in this PR | Customer IDs are collected in a `Set` per audience source. `email_messages` has a unique index on `(campaign_id, customer_id, retry_sequence)` and inserts use `ignoreDuplicates`. Scheduled sends are claimed with `claim_scheduled_campaigns` (row locks) and then call the same function. `resend-missed-recipients` uses the same conflict key. |
| One copy per email address | Merged in this PR | New `supabase/functions/_shared/recipientEmailDedup.ts`, used by `send-email-campaign`. Records sharing an address after trim + lower-case send once. The oldest record is kept. If any loaded record for the address opted out or is suppressed, the address is skipped. No rows are merged. |
| Audience note about one copy | Merged in this PR | `SegmentsAudienceSelect` shows the sentence from the brief. |
| Opted-out twin outside the loaded audience | Open | The send query leaves out opted-out rows before dedup, so an opted-out record with a different letter case is not seen. Production on 2026-11-26: 22 such addresses in 2 accounts. Real unsubscribes are still blocked by the suppression list, which is keyed by address. A closed fix needs a small read-only database function. |
| Recipient estimate equals unique addresses | Partial | The estimate counts unique customer IDs. It can be higher than the send by the number of same-address records (47 groups in production, in 2 accounts). |
| Shared text alignment (Left / Centre / Right) | Open | |
| Shared element alignment (Left / Centre / Right / Full width) | Open | |
| Shared vertical alignment (Top / Middle / Bottom) | Open | |
| Shared button controls, "Button Padding" name | Open | |
| Shared image controls | Open | |
| Spacing consolidation | Open | |
| Clear text and lorem ipsum shortcuts | Open | |
| Block-by-block list from 26 Nov (Top Line, Photo Banner, Headline, Headline Banner, Website Links, Newsletter Header, Divider, Footer, Announcement, Coupon, Event, Quote, Blog Post) | Open | |
| Properties panel disappearing on Coupon "Show button" | Open | |
| Barcode formats (UPC-A, UPC-E, EAN-13, EAN-8, Code 128) | Open | UPC-A exists today. |

## Milestone B: editing experience

| Item | Status | Evidence / gap |
| --- | --- | --- |
| Inline editing on the canvas | Open | |
| Drag handle visibility, Move to Top / Bottom, keyboard reorder, undo | Open | |
| Four starting options, "Customize in Design Studio" | Open | |

## Milestone C: content library

| Item | Status | Evidence / gap |
| --- | --- | --- |
| Template Library under Campaigns | Open | |
| Spreadsheet import for repeatable blocks | Partial | An import dialog exists (`DataImportDialog`). Not yet checked against the brief. |
| Plant Care Spotlight block | Open | |

## Milestone D: governance

| Item | Status | Evidence / gap |
| --- | --- | --- |
| Locked templates, enforced on the server | Open | |
| Campaign approval workflow, permissions, audit trail | Open | |

## Milestone E: iContact migration (Arts Nursery, January 2027)

| Item | Status | Evidence / gap |
| --- | --- | --- |
| iContact import with consent-safe mapping | Open | No provider credentials have been validated. XLSX / CSV import is the fallback. |

## Cross-cutting

| Item | Status | Evidence / gap |
| --- | --- | --- |
| Editor-wide design audit | Open | |
| Email client rendering consistency | Open | |
| QA newsletter "Newsletter Builder 2.0 — Full QA" in Northfield, unsent | Open | |
| Report for Jon and draft email to Mike | Open | |
