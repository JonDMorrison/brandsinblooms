# Operation Phoenix — West Coast Gardens implementation and acceptance

## Bryan's October 14 business requirements

- **CGI:** Historical baseline 100, equally weighted 50% by distinct recorded visits and 50% by net spending. MTD versus the exact same dates last year by default; YTD, completed months, annual, custom dates, and historical trend by business/customer/audience.
- **Historical segments:** Always Active, Frequent Returner, Occasional, One & Done, Inactive.
- **Independent lifecycle:** New, Growing, Stable, Slipping, At Risk, Lapsed, Reactivated, Rebuilding, Recovered. Seasonal buyers must not be called lapsed simply for shopping once each spring.
- **Audiences:** Combine segment, lifecycle, lifetime spend, CGI, visits, last purchase, products, departments and seasonal patterns. Allow dynamic/fixed audiences without changing the customer's underlying historical segment.
- **IdealPOS:** Remains the source of truth for purchasing. Six original Crystal Reports Excel shapes need documented transformation and strict cross-report reconciliation. Weekly updates must not silently overwrite source history or customer types.
- **TYPE export:** User reviews audience and proposed Ideal Customer Type before exporting CODE, LASTNAME, FIRSTNAME, MOBILE, EMAIL, TYPE, MAILOUT, ACCOUNT, PRICELEVEL. Preserve leading zeros and non-TYPE fields. Nothing writes automatically to Ideal.
- **Outcome reporting:** Source counts, CGI trends, coupon issued/redeemed, no reminders after redemption, segment movements, reactivation rate, and campaign change against baseline. Missing data remains unknown.

## Work completed in the current development pass

- Reused merged Bloom deep exploration, ranking, immutable programme baselines and static segments, marketing calendar importer, and reviewed Ideal TYPE export.
- Added a safe preview for the documented Crystal B/C/H/J grouped customer sales format; preserves leading-zero customer codes and source row references.
- Enforced unique, dated transaction and line IDs for Ideal purchasing facts and added a database-only collision guard. Exact identical re-exports can be skipped; changed receipts require reconciliation.
- Prevented missing or malformed amounts/quantities from becoming zero. The original raw report stays in the restricted SharePoint source folder; only explicitly reviewed valid records may be imported to CRM.
- Added an exact review fingerprint tied to the original file and diagnostic counts. The importer requires a preview and approval before any customer write; source errors require explicit acknowledgement.
- Grouped/undated reports are never committed as distinct transaction rows. These sources can inform reconciled totals through a separate aggregate pathway, not individual visits.
- MTD CGI default now uses the same local calendar dates last year, with YTD, previous month, prior year and custom-date controls and leap-year warnings.

## Gate checklist for client activation

- [x] Review source file candidates and report shape; no unexpected direct writes.
- [x] Preserve leading zeros, distinguish missing values from zero, disclose incomplete source rows.
- [x] Require explicit reviewed import confirmation and source digest before writes.
- [x] Enforce unique transaction/line IDs for Ideal sales and block changed duplicate receipts rather than inflating totals.
- [x] Block grouped totals masquerading as dated transactions.
- [x] Add MTD/YTD/completed month/prior year/custom CGI date presets and day-count warnings.
- [x] Retain reviewed Customer Type export as review-only.
- [ ] Validate all six actual Crystal report formats with Bryan's full original exports and reconcile source totals and dates.
- [ ] Verify one distinct dated transaction ID per visit, receipt amounts/refunds, report timezone and overlap between exports. Do not certify CGI without these facts.
- [ ] Obtain the numerical rules behind Bryan's five existing segments, nine lifecycle stages, and zero-baseline/seasonality treatment. Never invent them.
- [ ] Verify with Canadian IdealPOS support whether a TYPE-only import updates by Customer CODE, including leading zeros, and how it impacts PRICELEVEL, MAILOUT and ACCOUNT.
- [ ] Reconcile coupon issue/redemption IDs and delayed file refresh with the no-send-until-fresh reminder policy.
- [ ] Dry-run a small agreed source dataset in the client's isolated tenant, verify customer values, then obtain sign-off before production imports or promotional messaging.
- [ ] Confirm whether Ideal provides a scheduled export or authenticated API; manual weekly supervised update is the safe fallback.

## Privacy and release rules

Client data is confidential. Do not put actual customer files, receipts or identity data in GitHub, public file-serving endpoints or unit tests. Only fictional test records may appear in the source tree. Promotion TYPE changes are never automated by weekly imports. The software can be deployed after automated checks, but the customer-specific migration and live customer-type promotion must remain blocked until the documented gates are satisfied.
