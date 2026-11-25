# Modular BloomSuite pricing preview — 25 November 2026

## Proposed USD price book, not a billing authority
- $99/month per product: BloomSites (website and commerce capability), POS (one location, one register), CRM (20,000 email sends).
- $250/month all three, $47 monthly saving. Two products $198.
- Additional email $3 per 1,000 prorated to the cent; SMS 4.5 cents per billable segment (rounded aggregate). Regional, sender, MMS and high-volume costs need review.
- Additional independent website $99, POS location $79, additional register $29 per location, advanced AI from $29; optional 0.5% illustrative ordinary online commerce platform fee. No new in-store transaction surcharge assumed. Supplier programme terms are separate.
- Proposed calculator only. No new Stripe products or checkout price mapping, existing subscription migration, database entitlement, payment or fee change. Preserve existing agreements and old pricing route at /pricing?existing=1. Existing checkout callback/query parameters continue through the legacy screen.
- No annual discount or CAD conversion assumed.

## Release and financial validation
Before activating paid plans, reconcile actual email/SMS provider invoices, 12 months of tenant usage and support, current Stripe subscriptions and commerce/processing economics. Confirm margin targets, country/currency, contract and included setup limits. Define high-volume negotiated pricing. Reconcile existing customers and honour grandfathered terms. Implement server-side SKU/price IDs, entitlement and usage ledger, webhooks, idempotent segment metering, spend caps and alerts, then test with Stripe test mode and explicit production approval. Do not use client query estimates as trusted prices. Existing supplier fees are not changed by this preview.

## Public design
Homepage, /pricing and /build-your-suite share the proposed modular architecture; calculator has real-time breakdown, independent email/SMS controls, optional expansion costs, copy and editable quote request. Existing feature-library URL structure and SEO are preserved. Public estimates disclose unpriced costs. Browser and accessibility QA required before declaring visual acceptance.
