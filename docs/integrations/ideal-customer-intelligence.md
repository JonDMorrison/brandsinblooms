# Ideal Computer Systems integration research — 2026-09-29

## Confirmed publicly

Ideal Computer Systems currently advertises an **API** as an Additional Product / Partner Integration. Ideal describes it as enabling real-time integrations between Ideal data and e-commerce websites.

Official source:
- https://www.idealcomputersystems.com/dealership-management-software/additional-products

Ideal also documents a broad integrations ecosystem and several automated interfaces, including QuickBooks, OEM/distributor interfaces, price-list updates, ARI, and other partner workflows.

Official source:
- https://www.idealcomputersystems.com/integrations

## Not confirmed publicly

Public developer documentation was not located for:
- authentication method
- base URL / endpoint catalog
- webhook support
- rate limits
- customer endpoints
- transaction / invoice line-item endpoints
- loyalty / points endpoints
- coupon-issued or coupon-redemption endpoints
- commercial/API entitlement requirements

Therefore BloomSuite must **not** claim that Ideal API can satisfy Customer Intelligence until account-specific API access and endpoint coverage are verified.

## BloomSuite integration policy

1. Prefer Ideal API when West Coast Gardens / another Ideal customer has API entitlement and the API exposes the required customer + transaction history.
2. Validate capabilities before activation; never infer missing purchase, loyalty, or coupon fields.
3. Use the existing Ideal report adapter/import ledger as the production fallback.
4. Both paths normalize into the same Customer Intelligence model, so switching from report sync to API later does not rebuild customer history.
5. Request from Ideal:
   - API/developer documentation
   - sandbox/test credentials
   - authentication instructions
   - customer endpoint/schema
   - invoice/transaction + line-item endpoint/schema
   - product/category/department fields
   - loyalty/points endpoint/schema
   - coupons issued/redeemed endpoint/schema
   - incremental sync/webhook options
   - API pricing/entitlement and partner approval process
