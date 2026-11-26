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
| Photo Banner: spacing, max height, overlay area | Partial | Root cause of the 150px problem and the empty band: the renderer forced a 200px minimum (150px for Image). The floor is now 60px, and the slider goes down to 60 with a number box. The control is named for what it does: "Banner height" when the photo fills, "Tallest the photo can be" when the whole photo shows. Still open: with "Show whole photo" plus an overlay, the overlay covers the whole box, including the bands beside the photo. Not hand-tested with portrait, square, wide and very short photos. |
| Website Links: appearance vs alignment, pills cannot be turned off | Merged | Root cause: the Left / Centred / Right looks did not reset the pill style, so it stayed. The look presets are replaced by two controls: "How the links look" (Standard links / Pills) and "Link alignment". Links, heading and colours are untouched by either. |
| Newsletter Header: vertical padding has no effect | Merged | Root cause: any Block spacing value, even an emptied box, switched the header's own padding off. Empty spacing no longer counts. The separate slider is removed; Block spacing starts from the saved padding. Same change for Quote content padding. |
| Footer: multiline address, three-state business details, logo width slider | Merged | Root cause of "the default comes back": the footer was refilled from the account every time it was empty. Name and address now have two labelled sources: "My business name / address" (follows the account, with a link to Contact & Footer settings) and "A different one" (kept exactly as typed, never refilled, multi-line). Phone and email are optional lines with a Show switch each. Decision held for Jon: name and address cannot be hidden, because CASL and CAN-SPAM require sender identification and a mailing address. An empty custom box shows the account value and says so. Every slider, including logo width, now has a number box. Unsubscribe is untouched. Footer vertical padding still has its own slider. |
| Properties panel disappearing on Coupon "Show button" | Done | Reproduced on production 2026-11-26: turning the switch off shortened the drawer and the switch jumped about 250px, so the next click hit another control. The drawer now keeps the last-used control in place (`BlockPropertiesPanel`, interaction anchor). Checked live 2026-11-26: four toggles in a row, the switch stayed at the same pixel and the button words were kept. |
| Barcode formats (UPC-A, UPC-E, EAN-13, EAN-8, Code 128) | Done | Format picker with per-format validation. A missing check digit is worked out; a wrong one is named. Bar patterns for UPC-A, EAN-13, EAN-8 and Code 128 match an independent encoder (python-barcode) bit for bit across 500 random codes; UPC-E checked against the published 0 425261 4 example. Checked live 2026-11-26: 11 digits typed, check digit added, barcode shown on the coupon. Not yet scanned with a physical scanner. The panel says the barcode does not create a discount. |

## Milestone B: editing experience

| Item | Status | Evidence / gap |
| --- | --- | --- |
| Inline editing on the canvas | Partial | Plain text can be typed on the canvas: headline, subheading, small label, button words, product name and second line, quote author and title, event location, caption. Click the words, type, then click away or press Enter. Escape puts the old words back. It writes to the same block field the panel edits, as one undo step, saved as plain text only. Clicking button words never follows the link. Not editable on the canvas yet: paragraph text and other rich text (use the panel), text holding personalisation such as {{ first_name }}, prices, formatted dates, gallery items, and the footer. Preview stays read-only. Template locks do not exist yet, so there is nothing to respect there. |
| Drag handle visibility, Move to Top / Bottom, keyboard reorder, undo | Done | Toolbar has Move to top, Move up, Move down, Move to bottom, Duplicate, Delete, each with a hover hint. Bottom means just above the footer. The drag handle is a bordered button with hover and focus states. Alt + Up / Down moves the selected block, with Shift for top / bottom, and never while typing. The block stays selected. Each move is one undo step (tested). Checked live 2026-11-26: coupon moved to top, stayed selected, footer stayed last, undo restored the order. Not yet tested by hand with 20 blocks. Outline tab still has up / down only. |
| Four starting options, "Customize in Design Studio" | Merged | "Choose a design" now opens with four labelled options: Start from scratch (chosen for a new email), Pick a preset, Choose a template, Choose a theme. Each says what it is. Only the chosen option shows its choices. Choosing an option changes nothing in the email. "Customize in Design Studio" stays the main button below. Fixed on the way: "Blank canvas" replaced an existing email without asking. Starting over now goes through the same confirmation as every other design, and the dialog says what will be replaced. All presets, saved designs and the weekly theme with AI writing are kept. |

## Milestone C: content library

| Item | Status | Evidence / gap |
| --- | --- | --- |
| Template Library under Campaigns | Partial | New page at Campaigns, Templates (`/crm/campaigns/templates`), built on the existing `saved_campaign_templates` table. No second template system. It has previews drawn from the saved blocks, names, descriptions, search across name, category and tags, category and owner filters, sorting, edit details, copy, delete with a confirmation, and "Use for a new email". A template has no send or schedule action. Using one copies its blocks into a new email, so later template changes do not touch that email. Ownership and saved date are shown. Only the person who saved a design can change or delete it; anyone on the team can copy it. Not built yet, because each needs new database columns: favourites, default company template, brand-approved flag, archive (delete is permanent today), and versions. Also open: editing a template's design directly in Design Studio. Today a template is changed by using it, editing, and saving it again. |
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
