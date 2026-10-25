# CRM, website and e-commerce feature libraries

Added October 25, 2026. These public marketing guides use the POS library's discover → inspect → compare → request a tailored demo pattern.

## Public entry points

| Product | Feature finder | Comparison library | Switching checklist |
| --- | --- | --- | --- |
| CRM | `/crm/features` | `/crm/compare` | `/crm/switching` |
| Website Builder | `/website/features` | `/website/compare` | `/website/switching` |
| E-commerce | `/ecomm/features` | `/ecomm/compare` | `/ecomm/switching` |

Each product has 42 feature guides in seven categories, four comparisons, two hubs and a switching checklist: 56 pages each, 168 in total. The existing `/crm` authenticated workspace and `/website/app` are unchanged. Existing product overview pages remain available. The Website Builder navigation entry opens its new marketing library instead of the old waitlist.

## Content and evidence

`content/product-libraries/catalog.mjs` contains owner-focused scenarios, benefit explanations, three-step illustrations, configuration boundaries and demonstration questions. `deep-dives.mjs` adds a distinct, substantial walkthrough and assessment for every feature, explicitly presented as a demonstration exercise rather than an observed customer result. Category evidence paths identify relevant source modules and knowledge-base chapters for future editors. These paths are internal editorial references, not public private-repository links.

CRM evidence includes customer/profile/import helpers, campaign studio, recipient/sender checks, segment selection, SMS consent/delivery/tracking tests, automation templates, Customer Intelligence and campaign analytics helpers in this repository.

Website/commerce evidence was inspected through the CMS repository at `66443196ef936b1be88536e6125d7f2ddf78d343`, including:

- Seasonal homepage actions, presets, schedule and server selection.
- Content editor and storefront system-page modules.
- Sitemap generation and runtime redirect lookup.
- `docs/bloomsites/03-products-and-master-catalogue.md`.
- `docs/bloomsites/04-inventory-and-pos-integrations.md`.
- `docs/bloomsites/09-fundraising-commerce.md` and canonical cart/checkout modules.
- Ticketing checkout and public/staff gift-registry modules.
- Order, pricing/shipping, mixed-cart and known-limitations chapters.

Several older CMS chapters retain historical operational status. Those documents are not treated as proof of current store activation. Copy explicitly scopes payment readiness, connector direction/freshness, specialist-program availability, shipping eligibility and registry claiming versus payment. No universal live stock, two-way POS sync, digital gift-card redemption, automatic payouts or revenue guarantee is advertised.

`content/product-libraries/comparisons.mjs` contains 12 original buyer guides. Narrow vendor capability summaries link to official sources retrieved October 25, 2026. The fit guidance and demonstration tasks are editorial analysis. No live subscription price or unsupported competitor feature-absence claim is published. Each guide explains when retaining the incumbent can make sense.

The visual maps and step panels are explicitly workflow illustrations. They are not screenshots, testimonials or fabricated customer results. Existing generic illustrations were inspected and not relabelled as product screenshots. Social PNGs are editorial title cards generated deterministically by `scripts/product-guides/social.py`.

## Architecture

`npm run build` runs Vite, the suite shells, POS pages, then `write-product-guides.mjs`. Marketing HTML is fully rendered without application hydration or a database request. The final writer reconstructs the complete sitemap from the public baseline, reviewed POS routes and current product-library routes. It verifies POS output exists and never relies on a mutable sitemap from an earlier writer. A regression check simulates POS-only regeneration and verifies that the final writer restores all libraries without duplicates.

Reviewed route changes use `node scripts/write-product-guides.mjs --sync-routes`. Builds fail if exact routes or editorial requirements are missing. Explicit `/crm/features` and `/crm/compare` rewrites do not intercept authenticated CRM routes. Unknown feature/comparison URLs use a true HTTP 404 and `noindex` instead of the SPA's HTTP-200 fallback.

`guides.js` provides token-based search combined with category filters, empty-state reset, query restoration, and a six-topic demo shortlist. Selections are encoded in the page URL, not silently submitted or retained in a customer database. All cards remain visible with JavaScript disabled.

Contact form context accepts only product/feature/comparison keys from the reviewed generated topic manifest. The normal editable enquiry and explicit submit flow remain responsible for sending. Unknown URL input, prototype keys and cross-product topics are ignored. POS and suite inquiry handling remain independent.

## Verification

- `npm run build` produces all marketing pages, assets and the combined sitemap.
- `npm run test:product-guides` checks metadata, structured data, all 168 routes, internal library links, sitemap preservation, true-404 configuration, search, URL state, shortlist limits and reset behaviour.
- `npx vitest run src/components/suite/productGuideContext.test.ts` checks trusted topic resolution and contact handoff boundaries.
- `node scripts/product-guides/browser.mjs` checks every page at 360px and 1440px, twelve axe scans across representative hubs/details, search/reset, shortlist/reload, actual 404-handler responses and JavaScript-disabled content. It uses a local HTTP server and never sends an enquiry or payment.

The focused workflow runs these checks on relevant pull requests. A repository-wide TypeScript check currently reports pre-existing parser errors in unrelated files; use the production build and focused gates to assess this change without claiming the full repository typecheck passes.

## Expansion: AI, website growth and pre-sales

The second pass adds 18 substantive guides: Bloom AI, campaign drafting, calendar planning, content reuse, CRM forms and email preferences; guided plant discovery, AI page drafting, migration/image review, Site Doctor and domain launch planning; and six pre-sales workflows. Pre-sales copy explicitly retains the documented store-level release and hosted acceptance prerequisites and the full-payment-now limit. No campaign, checkout, DNS, email or operational setting is changed by publishing these guides. Counts in browsing copy, entry links, social cards and tests now derive from the reviewed catalogue.
