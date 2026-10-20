# Coordinated release plan — 2026-10-20

Code is in draft PRs CMS #3914 and CRM #221. Merge, production deployment, migrations and configuration changes have not been performed. Approval to open PRs does not authorize those release actions. Fixture tests do not establish merchant authorization.

## Read-only configuration inventory

Only names, migration versions, schema existence and deployment metadata were inspected; no secret values or merchant data were retrieved.

| Target | Present | Missing or unverified |
| --- | --- | --- |
| CMS Vercel `cms-brandsinblooms-latest` | Production `VENDOR_INTEGRATION_CREDENTIALS_KEY` name | `LIGHTSPEED_STOREFRONT_BRIDGE_ENABLED` absent (defaults disabled); key validity unverified |
| CRM Supabase `udldmkqwnxhdeztyqcau` | X fallback `LIGHTSPEED_CLIENT_ID`, `LIGHTSPEED_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`; active v1 `lightspeed-storefront-bridge` function | R client ID/secret absent; authority baseline migration `20261009161000`, authority tables/RPCs and edition migration `20261020181144` absent |
| CMS Supabase `isvcjikzheswgvpkfpfr` (project linked by repository integration) | Baseline migrations `20261009164000`, `20261009170000`; connection/state tables | Edition migration `20261020181144` absent; no edition columns; no Lightspeed cron jobs |
| Provider applications | Not inspected | X/R app approval, registered callback, granted scopes and usable credentials unverified |

Confirm the CMS production deployment actually uses the inspected Supabase project before applying anything; the project ref came from repository integration metadata, not a retrieved production environment value. The CRM Vercel application is `brandsinblooms` at `bloomsuite.app`; credentials belong in its Supabase authority, not frontend environment variables.

The CMS Supabase Preview check reports: “Maximum number of concurrent branches reached. You can update this limit in Project Integrations Settings.” An administrator must resolve preview capacity if that check is required. No branches were removed or limits changed.

## Ordered release gates

1. Obtain explicit release approval and complete independent review and final-head CI. Confirm production targets, backup/rollback procedure and maintenance owner. Keep the CMS bridge feature disabled.
2. Review/apply CRM baseline `20261009161000_lightspeed_storefront_authority.sql`, then CRM `20261020181144_lightspeed_editions.sql`. Verify service-only RLS/RPC permissions. Apply the CMS edition migration after confirming existing baseline and project mapping. Never run all unrelated pending migrations blindly.
3. Deploy the updated CRM Edge Function and CRM callback application, then CMS application. Check schema/authority compatibility before enabling either edition. An active old function alone is insufficient: current CRM authority schema is missing.
4. Separately authorized platform administrator provisions a confidential R-Series app and stores `LIGHTSPEED_R_CLIENT_ID` and `LIGHTSPEED_R_CLIENT_SECRET` in the CRM Supabase secret store. Register `https://bloomsuite.app/integrations/lightspeed/callback`. Validate existing X app credentials/callback/scopes and both encryption keys through readiness and authorized tests without copying values into chat, logs or docs. Complete any Lightspeed partner/app approval requirements through the provider's process; do not accept agreements implicitly.
5. Validate on dedicated, consenting test tenants before enabling broad availability. Fixed authority/callback domains mean a generic preview URL alone cannot prove the live OAuth path. Enable the production bridge only under configuration approval after the authority, schemas and credentials are ready; use an isolated test site. Disabled/missing edition configuration must remain visibly unavailable.
6. Complete the sandbox checklist below and record actual results. Code deployment, platform readiness and successful live merchant authorization are three distinct milestones.

## Required sandbox input and checks

A designated tester must supply the identity of a dedicated BloomSites test site/tenant they own, its currency/tax settings and pickup locations, plus an approved Lightspeed X sandbox store prefix and an R sandbox account identity. The tester signs into Lightspeed themselves; no password, token or secret is requested in chat. Do not use Alex Scott's account without separate explicit authorization.

Use known fixture data in the authorized sandbox: two shops/outlets; more than 100 R items and more than 200 X items to exercise multiple pages; known stock totals including zero/negative/archived/non-inventory items and variants; expected account ID/currency and per-shop stock. Verify the least-privilege R `employee:inventory_read` scope actually permits Account/Shop/Item/ItemShop reads, because official endpoint scope tables are inconsistent. Do not silently broaden scopes.

Test success/cancel/expired/replayed OAuth state, wrong site/tenant, token refresh and revocation, missing configuration, location mapping, 429/503 retry, partial/cancelled imports and resume, repeated imports, and preserved curated images/content. Confirm no POS writes, automatic publication or selling. R-Series prices are deliberately held for review until shop price-level/tax policy is implemented and verified; importing stock does not make R products sale-ready.

## Operational limits and rollback

Imports currently advance through the owner screen and can be resumed there. No scheduled Lightspeed sync or retired-grant cleanup implementation was found in the inspected application code, and no Lightspeed CMS cron jobs were present. Do not promise automatic background completion or completed upstream revocation. Local disconnect stops local access; pending retirement requires an explicitly implemented/verified cleanup process or the merchant removing app consent in Lightspeed. This release does not provision persistent workers.

If validation fails, keep/return the bridge flag to disabled under approved configuration access, retain completed snapshots and evidence, and review a code rollback. Do not destroy grants/data or apply destructive down migrations as an automatic rollback. Keep R prices held until the separate policy gate passes.
