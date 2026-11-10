# Premium botanical email design — platform-wide contract

Status: staged across three repositories, with a shared visual specification rather than a shared runtime package.

**Design reference:** the premium botanical garden-care receipt approved on 2026-10-14. Typography, item facts, action text and legal information must remain readable when mail clients block images. Never substitute emoji for purposeful iconography.

## Design tokens

| Role | Hex |
| --- | --- |
| Headlines, hero and primary CTA | #1B3049 |
| Body | #536475 |
| Muted | #5B6B79 |
| Botanical accent | #527566 |
| Page | #FAF9F6 |
| Card panel | #F8F9F6 |
| Border | #DBE3DF |
| Card surface | #FFFFFF |

First-party decorative 64px PNG artwork is served from the BloomSites production public /email/premium-icons/ path. Names: sun, water, soil, check, truck, calendar, mail, alert, leaf. Serve via HTTPS, with empty alt attributes; no important status, amount or link may rely on an image.

## Runtime-specific renderers

- BloomSites: src/lib/emails/premium-botanical.ts, src/lib/email/bloom-template.ts and src/lib/emails/render-store-email.ts, covering shared store-branded order and platform notification shells.
- BloomSuite POS: supabase/functions/_shared/botanical-email.ts, email-design.ts and receipt-email.ts. Transaction source-of-truth, frozen tax/amount, explicit refund status and approved care evidence stay unchanged.
- BloomSuite CRM: src/lib/email/premiumBotanical.ts, with system messages for trial, account, usage, opt-in, support and administrative workflows.

These are **three separate renderers following one versioned visual contract**, not one linked package. Updating tokens or icons therefore requires parallel work and cross-repository tests. Do not pull browser frameworks into Deno Edge Functions.

## Message composition

1. Uppercase eyebrow and a clear, human headline.
2. One short explanatory paragraph with no generic motivational filler.
3. One or two bordered, softly coloured information cards, with consistent icons.
4. One prominent action when an action is genuinely required; optional secondary link.
5. Support/help context and unobtrusive legal and preference information.

Plant care can mention sunlight, watering and soil only for an exact catalogue identity with approved data. Unknown, draft and unsupported care is omitted, not invented. Do not equate receipt delivery with marketing opt-in.

Order payment/refund status must distinguish completed, processing, failed and unknown outcomes; uncertain states cannot use confirmation copy or artwork. Keep the correct retailer identity on their customer messages, not duplicated BloomSuite marks. Maintain customer preference/unsubscribe links, sensitive-link click-tracking exclusions, sender/domain verification and frozen provider idempotency.

## Acceptance checklist

- [ ] Icon URLs respond from the real BloomSites production domain.
- [ ] BloomSites PR #3828 passes its email, store, commerce and editor tests; merge to main.
- [ ] POS PR #495 passes full till, back-office and database checks; merge to main after assets exist.
- [ ] CRM PR #202 passes Deno bundling and security/unit tests; merge to main after assets exist.
- [ ] CRM support/admin follow-up PR #203 passes and merges after #202.
- [ ] Confirm production Git commit and deployment SHA for each product.
- [ ] Check Gmail mobile, Apple Mail, Outlook and 320px display sizes, both with and without images.
- [ ] Test provider delivery using sandbox/test-mode emails; never equate provider acceptance with inbox delivery.

## Scope boundary and follow-ups

The first wave updates shared system/transactional senders and built-in starter templates. CRM customer-authored campaigns are **not overwritten**: their saved designs, personalization, compliance footers and links are user assets.

Other direct system-mail senders, including sender/domain diagnostics, account deletion and standalone operational reports, should be migrated as touched. A path is not marked complete merely because the design spec says it should be. Add a regression for each change, confirm existing sender/recipient/consent behaviour and record the release.