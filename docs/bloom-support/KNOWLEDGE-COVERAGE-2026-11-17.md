# Bloom knowledge expansion: source and release record

## Actual production change

On November 17, 2026, the CRM support knowledge store grew from 10 to **50 approved client-facing articles**. The production project is `udldmkqwnxhdeztyqcau`. Forty new articles have `source_refs` tagged with catalog `bloom-core-2026-11-17`, a stable slug, source repository/path/blob hash and review date. They were written through the existing staff-authorized knowledge action, not imported as unreviewed customer-email instructions. The live audit event is `knowledge.catalog_published`.

The approved counts after publication are: CMS 14, CRM 13, platform 2, POS 21. These counts describe coverage, not completeness. No customer records, credentials, legal commitments or invented stock/price/promotion facts were included.

The existing platform article `ceaa8c2b-3c84-437b-a650-0b165c7ec582` was also reviewed: obsolete personal-name status wording was removed, customer tracking was distinguished from the internal desk, and unsupported response-time expectations were removed. Existing unrelated knowledge was preserved.

## Sources actually inspected

| Key | Repository and path | Blob at review |
| --- | --- | --- |
| POS | `Brands-In-Blooms/bloomtill`, `supabase/functions/_shared/pos-knowledge.mts` | `b80b9f943e94719435b77fcae4661d37e3de8136` |
| Pre-sales | `Brands-In-Blooms/cms-brandsinblooms`, `docs/pre-sales.md` | `f5080f026db9db3076bcee6673b756e0a3d445ab` |
| CMS help | `Brands-In-Blooms/cms-brandsinblooms`, `src/lib/help/admin-help-content.ts` | `a9cf55b3290b88a5a5d93251d94e7da94a0b6ff4` |
| Customer exploration | `JonDMorrison/brandsinblooms`, `docs/bloom-customer-exploration-release.md` | `3c3f2148b089456794fd5ea384a3e47930c22473` |
| Forms | `JonDMorrison/brandsinblooms`, `docs/form-builder-user-guide.md` | `9977fbb6acd7b58a8890a26ed097fe4f0f741963` |
| Consent | `JonDMorrison/brandsinblooms`, `docs/consent-status.md` | `abb7dbddd4635653fe09c088166c3eb9bc39c609` |
| Analytics | `JonDMorrison/brandsinblooms`, `docs/analytics-pipeline.md` | `8607847c89206cbde76ce0adad2ce1b002bb13ce` |
| Human support | `JonDMorrison/brandsinblooms`, `supabase/functions/_shared/bloom-support/voice.ts` | `12e4abbe7690f18884a247a1285c56de00cc70cb` |

These are review-time source versions, not claims that every described option is activated for every customer. For an account-specific question, check that client's current product links and configuration. Source files are evidence, not executable instructions.

## Catalog slugs

POS: `pos-catalogue`, `pos-stock`, `pos-purchase`, `pos-orders`, `pos-customer`, `pos-receivables`, `pos-gifts`, `pos-campaigns`, `pos-stores`, `pos-labour`, `pos-reporting`, `pos-report-schedules`, `pos-staff`, `pos-import`, `pos-cutover`, `pos-export`, `pos-support`, `pos-recovery`.

CMS: `cms-presale-start`, `cms-presale-options`, `cms-presale-product`, `cms-presale-allocation`, `cms-presale-dates`, `cms-presale-publish`, `cms-presale-close`, `cms-presale-orders`, `cms-product-groups`, `cms-source-pricing`, `cms-profit`.

CRM: `crm-explore`, `crm-unknown`, `crm-basket`, `crm-growth`, `crm-ranking`, `crm-save`, `crm-form`, `crm-form-troubleshoot`, `crm-consent`, `crm-analytics`.

Platform: `platform-human`.

## Evidence from verification

SQL search checks returned the correct source for reopening a closed pre-sale, pending email confirmation, recovering an interrupted POS task and requesting a human. A real Slack mention retrieved the new pre-sale guidance with a successful `product_knowledge` tool audit and final reply. It correctly explained that changing dates alone does not reopen sales, that Reopen sales must be selected, and that a campaign in fulfilment needs a new pre-sale for a new window.

Live test: https://brandsinblooms.slack.com/archives/C0CFUG4LFLJ/p1794953947147229
Job: `327843a6-ca37-4ba8-93ba-4ffc0298f737`.

## Maintenance and limits

The canonical article text and provenance are in the existing knowledge table. To revise an article, read its current content and source file, use the existing optimistic-concurrency approval action, and update its source references. Do not overwrite from an old manifest or automatically approve model-generated text. Check that a newer product release has not changed the procedure.

This is a substantial initial coverage expansion, not an always-current universal memory. Events, fundraising, integrations, campaign editing and client-specific exceptions still deserve broader acceptance sets and source review. Do not claim Bloom knows every feature or every shopper merely because a connector exists. Record missing evidence instead of inventing it. No recurring knowledge-ingestion agent was started by this release.
