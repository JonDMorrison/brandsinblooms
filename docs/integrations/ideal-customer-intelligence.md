# West Coast Gardens — IdealPOS integration research

_Last reviewed October 15, 2026. Do not conflate different businesses with similar names._

## Identify the exact POS before promising an API

West Coast Gardens' support relationship is with **Ideal POS Ltd. in Winnipeg, Manitoba** (https://www.idealpos.ca/). The Canadian company supports multiple POS solutions. It is **not the same vendor as Ideal Computer Systems** (American dealership management software). Any API described on `idealcomputersystems.com` is **not evidence** that Bryan's IdealPOS installation exposes that API.

Official Idealpos (Australian product) documentation describes Customer Types, coupon promotions, customer `CODE` matching and customer file imports:

- https://userguide.idealpos.com.au/content/Import%20Data/Format%20of%20Import%20Files.htm
- https://userguide.idealpos.com.au/content/Customers/Importing%20Customers.htm
- https://userguide.idealpos.com.au/content/Promotions/Import%20Promotions.htm
- https://userguide.idealpos.com.au/content/Customers/Customer%20Types.htm

Ideal POS Ltd. Canada lists Idealpos alongside other supported vendors. **Confirm exact manufacturer, product and version with Bryan or Robert/Chris before treating the Australian guide as the contract for his database.**

## Confirmed client direction

Bryan's October 14, 2026 Operation Phoenix brief says his customer update export has nine fields in this order:

`CODE,LASTNAME,FIRSTNAME,MOBILE,EMAIL,TYPE,MAILOUT,ACCOUNT,PRICELEVEL`

BloomSuite should support weekly source-data refreshes for customer intelligence, but must **not** automatically change the limited set of Ideal Customer Types. Selected campaigns get a separately reviewed, explicit outbound TYPE update. The original customer IDs and fields must remain unchanged unless a specific approved update requires them to change.

## Manual import implementation & known limitations

The six current Ideal data families are: customer sales, category sales, customer spending, customer points, coupon issued, coupon redeemed. A CRM import wizard and server adapter exist, but their **report-specific Crystal Reports `.xls` layouts are not yet fully reconciled** against Bryan's actual source files.

Important implementation gap: numeric values missing or malformed in the existing `ideal-pos.ts` normalizer can currently become **zero**. This risks fabricating a measured purchase quantity or dollar amount. Additionally, grouped sales-category reports without unique transaction identifiers and dated sales are **not** evidence of separate visits. Test a staging upload, fix coercions before any real-data activation, preserve original rows and separate unscorable measurements from true zeros.

If Ideal has an API, only a confirmed customer/transaction/product/coupon scope and account entitlement can authorize live integration. Until then, use the upload workflow after report-specific QA. Automatic file retrieval and server-side conversions are separate options, subject to a secure transport agreement.

## Support questions for West Coast Gardens / Ideal POS Ltd.

1. Which exact underlying software/product and version is installed?
2. Is a documented API available for customers, dated line-item transactions, loyalty points and issued/redeemed coupon events? Authentication, commercial access, change feeds and rate limits?
3. Does customer update/import match existing records by `CODE`, including leading zeros, without clearing existing fields?
4. Is the expected customer update an all-customer file or changed records only? What is the correct filename/encoding/delimiter, preview/error process and backup/rollback?
5. Which 20 Customer Types are configured, and how are Type-based promotions actually applied at the till? Does `TYPE` contain an internal code or description?
6. Which Crystal Reports exports provide **actual distinct dated visits** rather than category summary aggregates, and a verified unique receipt/transaction key?
7. What distinguishes issued coupons, redeemed coupons and historical coupon changes? Does each record contain a unique redemption event and date? How frequently can export be automated?

## Product policy

The authoritative customer and purchase record remains CRM, with Ideal continuing to own checkout promotions. Existing marketing consent is separate from Ideal's `MAILOUT` field; exporting existing values never establishes consent. Avoid duplicating the existing Identity Resolution, Customer Intelligence, loyalty or promotional ledgers.
