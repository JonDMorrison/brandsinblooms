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
| Campaigns page crash (#676) | Not reproducible, evidence posted on the issue | 2026-11-26, Northfield, production: sidebar entry, direct URL, full reload, Drafts / Scheduled / Sent / Failed / All filters, Table and Cards views. No error boundary, no console errors. The list page was rebuilt in #679 after the incident. No stack trace exists for the original incident, so no root cause is claimed. |
| One copy per contact across segments | Merged (#718) | Customer IDs are collected in a `Set` per audience source. `email_messages` has a unique index on `(campaign_id, customer_id, retry_sequence)` and inserts use `ignoreDuplicates`. Scheduled sends are claimed with `claim_scheduled_campaigns` (row locks) and then call the same function. `resend-missed-recipients` uses the same conflict key. |
| One copy per email address | Merged (#718) | New `supabase/functions/_shared/recipientEmailDedup.ts`, used by `send-email-campaign`. Records sharing an address after trim + lower-case send once. The oldest record is kept. If any loaded record for the address opted out or is suppressed, the address is skipped. No rows are merged. |
| Audience note about one copy | Merged (#718) | `SegmentsAudienceSelect` shows the sentence from the brief. |
| Opted-out twin outside the loaded audience | Open | The send query leaves out opted-out rows before dedup, so an opted-out record with a different letter case is not seen. Production on 2026-11-26: 22 such addresses in 2 accounts. Real unsubscribes are still blocked by the suppression list, which is keyed by address. A closed fix needs a small read-only database function. |
| Recipient estimate equals unique addresses | Partial | The estimate counts unique customer IDs. It can be higher than the send by the number of same-address records (47 groups in production, in 2 accounts). |
| Shared text alignment (Left / Centre / Right) | Done | One control (`AlignmentControls.TextAlignField`). Now on Top Line of Text, Headline, Announcement, Blog Post, Event, Coupon, Product Card and Quote, next to the blocks that already had it. Alignment is written on each text element, so buttons do not move with the words. Tests: `sharedBlockControls.test.ts`. Checked live 2026-11-26 on the Northfield QA draft: coupon words centred, button moved right on its own, both saved and present in the stored email HTML. |
| Shared element alignment (Left / Centre / Right / Full width) | Partial | One control (`ElementAlignField`). Used for every button (Full width replaces the separate switch) and for the Divider line. Logos and images still use their own controls. |
| Shared vertical alignment (Top / Middle / Bottom) | Merged | One three-button control. Shown only when a photo sits beside the words: Image + Text, Call to Action split, Product Card, Coupon, Event, Blog Post, Announcement. The Event card ignored it before; fixed. |
| Shared button controls, "Button Padding" name | Partial | "Adjust the button size" is now "Button padding". Event, Blog Post, Announcement and Coupon share one button group with a Show button switch that keeps the saved words, link and style. Older blocks (Headline Banner, Photo Banner, Image + Text, Call to Action, Product Card) share the alignment control but keep their own colour and size fields. |
| Shared image controls | Partial | Event, Blog Post and Announcement gained Show photo, description, placement, fit (whole photo / fill / stretch) and height. Not yet one shared component for every block. |
| Spacing consolidation | Partial | Header and Quote vertical padding folded into Block spacing. Footer and Social Follow still have their own slider. |
| Clear text and lorem ipsum shortcuts | Merged | Single-line boxes have a clear button. Multi-line boxes and the rich text editor have "Clear text" and "Insert lorem ipsum". Local text, no AI. |
| Top Line of Text: alignment | Merged | |
| Headline: alignment | Merged | |
| Headline Banner: lorem ipsum, separate button alignment | Merged | |
| Divider: Left / Centre / Right / Full width | Merged | Full width sets the line to 100%. |
| Announcement: alignment, Show button, Show photo | Merged | Hidden content stays saved. |
| Event: photo sizing, fit, placement, vertical and text alignment | Merged | Photo on top now spans the card. |
| Blog Post: alignment, photo fit, height, placement | Merged | Ratio presets not added. |
| Quote: avatar size, text alignment, author photo switch | Merged | Root cause: the email renderer ignored these fields. Quote mark size is shown only for the centred look, the only one that draws a mark. |
| Photo Banner: spacing, max height, overlay area | Open | |
| Website Links: appearance vs alignment, pills cannot be turned off | Merged | Root cause: the Left / Centred / Right looks did not reset the pill style, so it stayed. The look presets are replaced by two controls: "How the links look" (Standard links / Pills) and "Link alignment". Links, heading and colours are untouched by either. |
| Newsletter Header: vertical padding has no effect | Merged | Root cause: any Block spacing value, even an emptied box, switched the header's own padding off. Empty spacing no longer counts. The separate slider is removed; Block spacing starts from the saved padding. Same change for Quote content padding. |
| Footer: multiline address, three-state business details, logo width slider | Open | |
| Properties panel disappearing on Coupon "Show button" | Done | Reproduced on production 2026-11-26: turning the switch off shortened the drawer and the switch jumped about 250px, so the next click hit another control. The drawer now keeps the last-used control in place (`BlockPropertiesPanel`, interaction anchor). Checked live 2026-11-26: four toggles in a row, the switch stayed at the same pixel and the button words were kept. |
| Barcode formats (UPC-A, UPC-E, EAN-13, EAN-8, Code 128) | Merged | Format picker with per-format validation. A missing check digit is worked out; a wrong one is named. Bar patterns for UPC-A, EAN-13, EAN-8 and Code 128 match an independent encoder (python-barcode) bit for bit across 500 random codes; UPC-E checked against the published 0 425261 4 example. Not yet scanned with a physical scanner. The panel says the barcode does not create a discount. |

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
