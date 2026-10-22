# Reviewed manual IdealPOS synchronization

This is an operator workflow for original large Excel/CSV exports. It prepares private, bounded review bundles and, for reconciled product summaries, proposed SQL. It never connects to production or executes an import. The in-app prepared-source review verifies the same manifest/chunk contract; it is not an import approval.

## Requirements and limits

- Node.js with this repository's installed `xlsx` dependency.
- For legacy `.xls`: Python 3 with `xlrd` 2.0.2 (the version verified in this environment). Set `IDEAL_SYNC_PYTHON` to an explicitly managed Python interpreter if `/usr/bin/python3` differs. No package download or credentials are performed by these scripts.
- Preserve the original outside the generated bundle. Input SHA-256 is checked before and after preparation, and again when preparing a SQL plan.
- CSV/TXT streams through an RFC4180 parser; encoding is explicit (`utf-8` default, or `windows-1252`). Invalid UTF-8 fails instead of replacing bytes. The actual WCG master and current sales CSV require the Windows-1252 option.
- Legacy XLS uses memory-mapped, on-demand worksheets and unloads each worksheet. Decoder RSS is sampled against a 512 MiB budget after loading and during iteration; this is not a hard OS memory cap. Node has a separate 384 MiB V8 heap limit. XLSX uses selected worksheets in the isolated heap-limited worker.
- Source maximum 128 MiB, 2 million source rows, 512 columns; CSV cells at most 1 MiB. JSONL output chunks contain at most 1,000 rows or approximately 1 MiB. A single row cannot exceed 1 MiB. Failure leaves `FAILED.json`; do not upload or use partial output. Choose a new output directory for every preparation.
- Normalized master output uses only CODE plus the reviewed nine-field export subset. Passwords, credit limits and balances are excluded at normalization. All files are private (directories0700/files0600). Never commit bundles, originals, identity snapshots or generated SQL to Git.

## Steps

1. Retain the original unmodified. Select the exact report family and explicit period from the source, not from assumptions about dates.
2. Prepare a private bundle, for example:

```sh
node scripts/ideal-manual-sync.mjs original.xls private-output annual_sales TENANT_UUID 2025-01-01 2025-12-31
node scripts/ideal-manual-sync.mjs original.csv private-output customer_sales TENANT_UUID 2026-01-01 2026-10-14 windows-1252
node scripts/ideal-manual-sync.mjs master.txt private-output customer_master TENANT_UUID - - windows-1252
```

Families: `customer_master`, `annual_sales`, `customer_sales`, `customer_spending`, `points`, `coupons_redeemed`, `journal`. XLS customer-sales sheets and Crystal CSV have distinct verified transformations. Spending supports its two observed column layouts. Journal emits receipt-header candidates only; it does not invent financial lines. Coupon codes are not customer IDs. Points dates and coupon timestamps remain local Excel evidence, without invented timezone conversion.

3. Review `manifest.json` and all numbered chunk files together in the application's prepared-source review. Confirm source hash, tenant, all worksheets, counts, period, warnings and subtotals. Every row retains source SHA/sheet/row and payload hash. Status `review_required` means extraction finished, not that a production import is authorized. `quarantined` requires correction/reconciliation. All prepared records are `committable:false`.
4. Product summaries only: obtain a fresh read-only exact active customer identity snapshot `{tenantId, customers:[{code,id}]}` and prior source inventory for the same tenant. IDs must be UUIDs; do not create customers to make a report match. Prior entries use the manifest scope fields `{tenantId,source:{sha256},reportFamily,periodStart,periodEnd,status:'completed'}`.
5. Generate a proposed summary plan locally:

```sh
node scripts/ideal-manual-sync-plan.mjs private-output original.xls identity-snapshot.json prior-sources.json private-plan [reviewed-supersede-hashes.json]
```

The builder deterministically reparses the original and compares prepared evidence, protecting against modified data even if an attacker recomputes every bundle hash. It verifies chunk order/count/hash, sheet bounds, subtotals/grand totals, tenant and customer identity uniqueness. Unmatched codes are excluded; ambiguous codes block the plan. Each SQL batch and finalization bind both customer CODE and the reviewed customer UUID. Replays cannot silently reassign a CODE to a different customer. The plan is limited to250,000 product items. No SQL is run.
6. Review exact plan totals, exclusions, source scope and current production ledger before separately approving execution. Execute only an approved plan with existing authorized operational tools, then verify final ledger status, totals and tenant isolation. Do not restart a completed historical import.

## Overlap and recurring-update boundary

Exact source hashes, including renamed files, produce a no-op duplicate result. By default, overlapping aggregate periods block plan generation. For a cumulative refresh, explicitly provide `reviewed-supersede-hashes.json`, a JSON array of the exact prior SHA-256 values approved for replacement in reporting. Every listed source must be a completed product-summary report in the supplied prior inventory, with known dates fully contained by the new printed period. Partial overlap, unknown periods, spending-family replacement and unlisted/unused hashes are rejected. Printed period text is accepted only from worksheet E6 following the expected report title in F1, or the verified Crystal CSV report-period column E and must match operator dates; aggregate sources without a verified printed period cannot generate plans.

The plan hash and import ledger record every superseded source hash and period. Prior imports and facts remain untouched. The existing report selector chooses the newer complete covering snapshot once; it must not add the snapshots. SQL verifies exact prior completed ledger rows and rejects any unexpected completed overlapping product snapshot at begin, every batch and finalization. A short `SHARE ROW EXCLUSIVE` lock on the import ledger makes the check atomic against other ledger writers. This briefly serializes ledger writes across tenants; the optional path uses a 5-second lock timeout and 30-second statement timeout inside an explicit transaction. Timeout rolls back that unit, retains the prior reporting snapshot and allows an idempotent retry after verifying the outcome. Do not treat a partial batch sequence as completed. No automatic supersession or production execution occurs merely by preparing this file.

## Actual-source verification (2026-10-21)

| Original | Worksheets | Extracted result | Reconciliation |
|---|---:|---|---|
| 2025 sales XLS,57,456,640 bytes |11|17,937 groups /150,300 items|All customer subtotals and grand total $3,324,735.73 match; this includes the previously quarantined25 groups. No import repeated.|
| Current sales CSV,53,386,552 bytes |1 logical stream|12,836 groups /112,452 items|$2,654,649.44 /237,156.06 quantity match.|
| Current sales XLS,42,411,520 bytes |8|12,833 groups /112,413 items|Its own grand $2,654,046.34 /237,082.06 quantity match; it differs from CSV by39 items/$603.10.|
| Spending XLS,3,321,344 bytes |1|12,826 customers|$2,645,724.79 and34,301 reported transactions match; reported totals are not dated visit events.|
| Points XLS |2|32,152 movements|Extraction only; stable event identity/opening balances unresolved.|
| Redeemed coupons XLS |1|830 redemptions|Extraction only; customer ownership/timestamp semantics unresolved.|
| Journal XLS,70,533,120 bytes |9|34,410 receipt headers|Financial detail and217 customer differences remain uncertified.|
| Master TXT |1 logical stream|47,897 customers|IDs retained; prohibited secret/financial fields omitted.|

Maximum measured legacy decoder peak:255,148,032 bytes (journal); Node preparation peak approximately122 MiB RSS. The sales CSV used approximately116 MiB Node RSS. These are actual local measurements, not a claim about Edge execution.

Tests: `node --test scripts/tests/ideal-manual-sync.test.mjs scripts/tests/ideal-annual-import.test.mjs`. Optional isolated database regression: `node scripts/tests/ideal-manual-sync-db.mjs` targets only localhost:55439 database `ideal_manual_sync_guard_test`, resets only its synthetic tables, and proves stale UUID rejection, duplicate CODE rejection, reviewed supersession with retained history, unexpected-overlap rejection, and lock-timeout rollback/idempotent retry. Never point this test at production.
