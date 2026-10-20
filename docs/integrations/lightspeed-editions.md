# Lightspeed Retail editions — local implementation and release checklist

This change extends the existing BloomSuite credential authority and BloomSites staged catalogue import. It does not authorize any customer, enable selling, alter POS records, or prove production configuration. R-Series prices are held for review: shop price levels and tax inclusion must be verified before price publication. Source price records remain in the staged raw payload.

## Owner instructions

1. Open Integrations → Lightspeed Retail in BloomSites as the site owner.
2. Select Retail X-Series (formerly Vend) or Retail R-Series. X-Series addresses end in `retail.lightspeed.app`; R-Series signs in at `cloud.lightspeedapp.com`. If unsure, confirm the edition before continuing.
3. For X-Series, enter only the store prefix. R-Series discovers the account after authorization and does not request a prefix.
4. If platform setup is pending, ask the platform team to finish it. Never paste a password, client secret or developer token into BloomSites.
5. Continue to Lightspeed and authorize the application there. On return, import products and stock, then match outlets to active website pickup locations.
6. Review import results. A completed import is a staged source snapshot; it does not publish products or enable checkout. R-Series prices require separate review.
7. A cancelled or expired authorization can be restarted. Retry a paused import after its delay. Disconnect stops local sync and queues bridge revocation; also remove application consent in Lightspeed if desired.

## Provider contracts and official references checked 2026-10-20

| Contract | X-Series | R-Series |
|---|---|---|
| Authorization | `https://secure.retail.lightspeed.app/connect` | `https://cloud.lightspeedapp.com/auth/oauth/authorize` |
| Token exchange and refresh | Merchant origin `/api/1.0/token` | `https://cloud.lightspeedapp.com/auth/oauth/token` |
| Requested scopes | `products:read inventory:read outlets:read retailer:read payment_types:read` | `employee:inventory_read` |
| Account discovery | `/api/2.0/retailer` | `/API/V3/Account.json`, then `/API/V3/Account/{id}.json` for `defaultCurrency.code` |
| Catalogue/location/stock | Pinned `/api/2.0/products`, `/outlets`, `/inventory` | `/API/V3/Account/{id}/Item.json`, `Shop.json`, `ItemShop.json` |
| Pagination | Decimal int64 version cursor; end on empty page | V3 `@attributes.next`; maximum 100 rows; opaque continuation preserved and restricted to the original account/resource/query |
| Refresh | Rotating refresh token saved atomically | Rotating pair saved atomically; unused refresh tokens expire after 30 days |

The CRM authority previously omitted `payment_types:read`; this change aligns it with CMS and the [retailer endpoint requirements](https://x-series-api.lightspeedhq.com/v1.0/reference/getretailer). Existing grants without the required scope may need fresh owner authorization.

Sources: [X authorization](https://x-series-api.lightspeedhq.com/docs/authorization), [X scopes](https://x-series-api.lightspeedhq.com/v1.0/docs/scopes), [X refresh update](https://x-series-api.lightspeedhq.com/changelog/2025-03-refresh-token-flow-update), [X rate limits](https://x-series-api.lightspeedhq.com/docs/rate_limiting), [X product-version migration](https://x-series-api.lightspeedhq.com/v1.0/docs/2026_10_products_migration_guide).

R-Series sources: [client registration](https://developers.lightspeedhq.com/retail/authentication/clients/), [authorization](https://developers.lightspeedhq.com/retail/authentication/authorization-code-grant/), [scopes](https://developers.lightspeedhq.com/retail/authentication/scopes/), [refresh](https://developers.lightspeedhq.com/retail/authentication/refresh-token/), [account](https://developers.lightspeedhq.com/retail/endpoints/Account/), [items](https://developers.lightspeedhq.com/retail/endpoints/Item/), [inventory](https://developers.lightspeedhq.com/retail/endpoints/ItemShop/), [shops](https://developers.lightspeedhq.com/retail/endpoints/Shop/), [pagination](https://developers.lightspeedhq.com/retail/introduction/pagination/), [rate limits](https://developers.lightspeedhq.com/retail/introduction/ratelimits/).

R uses a leaky bucket (base 90, drain 1/sec; allowances scale with registers) plus burst limiting. X exposes per-connection limits. Both return 429; the shared transport respects bounded Retry-After and the durable worker persists a retry time. Failed/partial runs do not replace the last complete snapshot. R shop ID 0 is an aggregate and is excluded. Missing prices or unsupported item types are review issues, not invented zero prices or stock.

R endpoint scope tables are inconsistent with the documented `employee:inventory_read` scope list. Validate account, shop, item and ItemShop GET access in an authorized sandbox before release. Do not silently expand to `employee:all`, `employee:register`, or other write scopes to make a test pass.

## Platform prerequisites — not performed by this change

- Register/confirm a distinct R-Series confidential OAuth client and its permitted callback. X-Series credentials cannot be reused as R credentials.
- R client registration may be auto-approved or require review (the docs quote 24–48 hours). Confirm public-distribution/partner requirements with Lightspeed. X public production applications require approval; unapproved apps have a 30-store limit.
- Register the exact shared return URL `https://bloomsuite.app/integrations/lightspeed/callback` for each application. The CRM callback routes site-minted `bs_` state to the storefront authority; ordinary CRM OAuth remains separate.
- Configure **server-side only** CRM `LIGHTSPEED_R_CLIENT_ID`, `LIGHTSPEED_R_CLIENT_SECRET`; preserve the existing X `LIGHTSPEED_CLIENT_ID_PROD` / `LIGHTSPEED_CLIENT_SECRET_PROD` (or existing fallback names). Verify `TOKEN_ENCRYPTION_KEY` is a valid base64 32-byte key without printing it.
- Verify the CMS bridge flag `LIGHTSPEED_STOREFRONT_BRIDGE_ENABLED`, production `VENDOR_INTEGRATION_CREDENTIALS_KEY`, existing signed bridge endpoint, owner membership and confirmed site currency/tax settings.
- Review/apply CRM migration `20261020181144_lightspeed_editions.sql` and deploy the authority/callback together, then review/apply the CMS migration of the same name and release the CMS. Both depend on their existing October 9 Lightspeed migrations. No migrations were applied outside disposable local test databases.
- Verify the durable sync and retirement/revocation workers are configured. This change does not create schedules or expand persistent access.
- Run authorized sandbox tests for both editions: authorize, cancel, callback replay, expiry/refresh, revoked consent, account mismatch, multiple pages, multi-shop inventory, repeated imports and reconnect. Fixture tests are not evidence of live authorization.
- Verify R-Series price-level selection and tax semantics before implementing price publication; until then prices remain held and checkout remains uncertified.
- Only after explicit customer authorization, confirm the customer's actual edition and test the owner journey. No access to Scott's account was attempted.

## Security and compatibility

Edition is persisted in owner OAuth state, authority grants and site connections. Old records default to X-Series. Caller-supplied editions do not select credentials for an existing grant. The existing user/site/tenant checks, browser nonce, state expiry, ECDSA proof, one-use request nonce and refresh compare-and-swap lease remain in place. Tokens remain encrypted in CRM. Continuations cannot send tokens to another host/account/resource. The CMS receives only source data. R source IDs are namespaced separately from X IDs. Imports retain primary-key upserts and atomic snapshot promotion; they do not replace curated content or images.

The shared authority/provider files in both repositories must stay equivalent apart from Deno `.ts` import suffixes. This PR pair should be reviewed together. The old Scott's branch had only a workspace-preparation commit beyond main at discovery; no open Lightspeed implementation PR overlapped this change.
