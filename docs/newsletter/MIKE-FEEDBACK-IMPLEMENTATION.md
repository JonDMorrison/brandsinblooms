# Newsletter editor expansion

Source: Mike's newsletter block editor feedback supplied by Jon.
Implementation branch: `feat/newsletter-mike-feedback-20261027`.

## Release status

Implemented in source and locally validated. This document is not a claim of a
production release, browser acceptance, inbox-client certification, or successful
production migration. Deployment requires the database and email workers as well
as the frontend. Do not release the frontend alone.

## Feature coverage

| Feedback | Implementation |
| --- | --- |
| Higher contrast and wayfinding | Medium-grey top bar, darker category headings, labelled Blocks / Outline / Saved tabs, Block builder and Properties headings. |
| Block navigation without scrolling | Outline with select, duplicate, up/down, delete and save controls. Top/bottom navigation in outline and canvas. |
| Wider right panel / newsletter width | Properties panel expands to 420px on wide screens. Newsletter width is configurable from 480–800px, including 640 and 700px. |
| Master defaults | Newsletter design dialog: width, outer/content backgrounds, default font, allowed font list, gap, H1–H6/body/button/price/fine-print typography, colors, link decoration, spacing and borders. |
| Individual overrides | Common controls for edge-by-edge margins/padding, image spacing, button padding, borders, legend, font size/weight/line-height/color/font, transparent background and vertical alignment. |
| Utility vs contextual library | Basic blocks and layout controls separated from ready-made promotions and galleries/data. |
| Visible preview text | Preview Text block; also used as hidden inbox preheader fallback when campaign preview text is blank. |
| Header | Subtitle, logo size control, full-width optional banner; shared typography/spacing/background controls. |
| Email Safe Hero | Separate headline/subtitle/body appearance controls; shared button and spacing controls. |
| Graphic Hero | Left-to-right and right-to-left overlay gradients added. |
| Image | Generic library name for the existing full-width image type, preserving stored content. Graphic Hero remains a separate advanced overlay preset. |
| Image + Text | 30/70 and 70/30 splits; vertical alignment; independently clickable image; image padding/margins; shared border/typography/button controls. |
| Headline | Semantic H1–H6 block, with individual typography. |
| Text | Existing rich text plus a separate one-to-three-column Text Columns block. |
| Quote | Shared appearance controls, preserving existing quote layouts. |
| Coupon / Promotion | Introduction, title, botanical subtitle, description, offer, original price, sizing, conditions, expiry, image left/right/top, button/text link, badges, border/scissors. Conditions and expiry render after the CTA. |
| Offer presets | Just price, percentage off, amount off, BOGO, buy X/get one, X for a bundle price, quantity-tiered price, and quick 25%/50% choices. |
| Coupon barcode | Validated UPC-A, generated as a raster image and uploaded via existing media storage. Existing POS coupon code required; does not create discounts. |
| Product card | Botanical/alternate subtitle, left/right/top photos, up to three badges, full-width CTA and shared appearance. |
| Divider | One line-style selector; thickness, width, color, alignment and optional center ornament. |
| Product gallery | One-to-four items per row, common/alternate names, independently linked images and buttons. Additional existing items are preserved in subsequent rows. |
| Image gallery | One visual layout selection, one-to-four across or feature + grid; every image slot has its own image picker, alt text, caption and link. |
| Consistent photo editing | Click or keyboard-activate a canvas image to upload a replacement. All standard image pickers also offer a public URL input. |
| CTA / Button | Subheading, full-width option, shared button appearance; separate one-to-three Button Group. |
| YouTube | Linked thumbnail and watch button; no unsupported embedded video player. |
| Navigation | One-to-five labelled links. |
| Data table / chart | Accessible table with caption and column headers; labelled email-compatible horizontal bar chart. |
| Poll / survey | Question with linked response choices. The destination survey records answers; email clicks alone are not counted as votes. |
| Conditional blocks | Segment selectors; server validates customer/segment tenant boundaries and membership before sending. No verified membership means no conditional block. Database errors stop the conditional send for retry. |
| Store personalization | Store.Name, Store.Phone, Store.Address, Store.Email and Store.Website aliases available in the existing personalization list and canonical merge engine. |
| Named account Saved Blocks | Full configured block snapshots, naming, rename, shared library, delete and independent insertion. No duplicate type-favourites list. |
| Seasonal templates | Existing named campaign template library retained. New settings are stored in footer block metadata and therefore survive campaign/template save/reload. |
| Spreadsheet import | XLSX, CSV, TSV, JSON or pasted rows; column mapping; preview; explicit append. Creates coupon/product cards, gallery rows or data tables. |
| Feed URL | Public HTTPS CSV/JSON snapshot loader, with CORS, no credentials, no redirects, bounded size and explicit review. No unattended recurring refresh. |
| Default image folders | Named public base URLs saved with the newsletter/template. Enter a filename or use a full public URL. |
| Fieldset-like grouping | Border legend and border around an individual block. Does not create nested draggable block groups. |

## Persistence and safety

- New draft/template settings are JSON-only and retained in the required footer
  block, so the existing draft history, autosave and template round trip own them.
- Saved blocks are tenant-keyed and use the same `campaign.read` / `campaign.write`
  authorization function as campaigns. Editing an inserted copy does not update
  the source snapshot. Nested product/image/link IDs are regenerated.
- Browser-only saved blocks are **never auto-imported into the currently selected
  account**. Their ownership is unknown. The user must explicitly confirm the
  destination account; unsuccessful remaining entries stay in the browser.
- The saved-block migration requires `save_schema_version = 2`, without a default.
  This blocks old open tabs from performing their unsafe automatic local import.
- Account changes clear/scope query state. Database errors remain visible rather
  than reporting a successful local-only save.
- Imports append new content in one undoable change. They do not send mail, modify
  a store catalogue, create discounts, or overwrite an existing newsletter.
- Data and feed inputs are bounded; image/link schemes are validated. A feed
  snapshot does not continue to mutate a scheduled email.
- Store aliases normalize into the existing canonical merge names; they do not
  expose arbitrary account/database fields.
- Footer compliance links are kept outside conditional hiding.

## Implementation boundaries

1. A survey block links to survey response pages. Native survey hosting, response
   storage and bot-resistant voting are not implemented here.
2. Feed imports are manually loaded snapshots, not recurring subscriptions.
3. Barcode generation does not provision POS redemption rules. Scanner and print
   validation are still required against a real coupon configured in the POS.
4. Border legends group the content of one block; arbitrary nested block groups
   are outside this change.
5. Web fonts use email-safe fallback stacks. Inbox clients may substitute fonts
   or transform colors; no claim of identical rendering in every email client.
6. Interactive browser acceptance, saved-block tenant permission tests against a
   deployed database, and Gmail/Outlook/iOS inbox inspection remain release checks.

## Verification performed

- Existing newsletter baseline: 39 tests passed before modification.
- Expanded newsletter suite: 103 tests passed, including seven editor interaction
  tests and 57 shared-feature tests, plus all existing newsletter tests.
- Conditional audience worker: six Deno behavioral tests passed with intercepted
  fetch calls, no production customer query and no email sent.
- Production build (`npm run build`) passed.
- Existing security release gate: four tests passed.
- Changed-file semantic comparison: zero new TypeScript diagnostics relative to
  the baseline. The application still has unrelated pre-existing TypeScript errors.
- The full Deno typecheck reports existing DOM/footer/profile type issues; it is
  not represented as passing. The deployment module-resolution gate is checked
  independently for all 19 affected edge-function entrypoints; none had a missing
  or unresolved module.

See `ROLLOUT.md` for release order and acceptance checks.
