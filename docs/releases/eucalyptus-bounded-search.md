# Eucalyptus search release plan

PR #366 adds a covering population index and a bounded SECURITY INVOKER report-search RPC. It changes no RLS policy or source/customer data. Deploy SQL before the new edge code: the existing main-push workflow automatically deploys changed edge functions after merge.

## Required gates and authority

- GitHub main branch protection requires **one approving review**. Verified via `/repos/JonDMorrison/brandsinblooms/branches/main/protection/required_pull_request_reviews`; technical feedback in chat is not a GitHub approval. Do not self-approve or bypass it.
- `docs/database.md`, “Migration Strategy”, requires local creation, staging database testing, breaking-change review, **production deployment during a maintenance window**, and post-deployment integrity verification. This PR has a disposable local staging fixture; it is not a hosted production replica.
- `CLAUDE.md` requires investigation, tenant boundaries and tool preference; it does not add a separate human migration-approval requirement. The parent explicitly prohibited unreviewed production DDL. Existing user authorization covers the scoped repair after the genuine gates are satisfied.
- The earlier generic “migration approval” hold was a precaution, not a discovered additional repository approval rule. The remaining human action is the required independent GitHub review. Coordinate the documented maintenance window before the production transaction; do not invent an extra credential or access requirement.

## Narrow supported migration

Production was inspected as PostgreSQL **17.6**, which supports `transaction_timeout`. The migration runs in one transaction with:

- `lock_timeout = 250ms`: abort if a required lock cannot be obtained promptly.
- `statement_timeout = 4s`: abort a slow individual statement.
- `transaction_timeout = 5s`: terminate/roll back the entire transaction, bounding how long the ordinary index build can hold write-blocking locks. This includes the function/grant statements and commit window; these limits are not a production speed guarantee.

The index covers **all tenants**, not only West Coast. Catalog inspection estimated 213,226 rows, 152,436,736 heap bytes and 550,281,216 total relation bytes. Local fixture scale was expanded accordingly. If production cannot finish within these limits, stop and reassess; do not silently increase limits or repeatedly retry.

Use Supabase `apply_migration` for this reviewed, exact migration only. Do not run an unrelated `db push`. Confirm the runner wraps the body and migration-history write in a transaction; the `SET LOCAL` limits require that transaction. Inspect migration history and catalog after any uncertain result before retrying.

Preflight: verify final reviewed commit, CI, maintenance window, server >=17, no conflicting same-name function/index or invalid index, and no long-running conflicting writers. If an index already exists, verify its definition and validity; `IF NOT EXISTS` alone does not certify its shape. Apply only `20261105003000_bloom_bounded_summary_search.sql`.

After SQL: verify index validity/definition, function SECURITY INVOKER, expected execute grants and migration history. Profile the real authenticated admin and location-scoped paths, including index-only behavior/heap fetches. Then merge the reviewed code and watch the existing edge deployment to its terminal success. Confirm deployed revision before browser acceptance.

## Why not concurrent index creation in this migration?

PostgreSQL supports `CREATE INDEX CONCURRENTLY`, allowing normal writes, but prohibits it inside a transaction block. The repository's Management API migration example wraps SQL plus history in `BEGIN/COMMIT`; the migration tool is not a demonstrated standalone autocommit connection. Placing CONCURRENTLY in that transaction is not a safe plan. See [PostgreSQL CREATE INDEX](https://www.postgresql.org/docs/17/sql-createindex.html).

If the bounded transaction fails, the alternative is a separately reviewed standalone concurrent-index operation using an **already authorized** autocommit deployment connection, with session lock/statement limits, then index-validity checks and the RPC/history migration. Concurrent builds can leave an invalid index on failure; inspect and remove only that invalid new index before a reviewed retry. Do not acquire new credentials, bypass the tool's DDL restrictions, or claim this alternative has been validated on production. The currently tested plan is the bounded transaction above.

## Local benchmark and reproduction

Only synthetic records and captured schema/policy definitions are used. `scripts/tests/bounded-search-production-permissions.sql` contains the actual production `has_tenant_permission`, `is_master_admin`, and customer/source SELECT policies as inspected November 5. Supporting tables are minimal; this is not a full production schema clone. Local PostgreSQL 18 and PostgREST 16.4 differ from hosted versions.

Create a fresh disposable local cluster/database named `bloom_search_benchmark`, with localhost PostgreSQL port 55439. Run `scripts/tests/bounded-search-benchmark.sql`; optional `bounded-search-benchmark-legacy.sql` supplies one synthetic legacy-format import. Start localhost-only PostgREST on port 55440, public schema, max rows 1000, local fixture JWT key `synthetic-local-benchmark-only-not-a-production-secret`. This key grants no access outside the disposable server. The benchmark uses real HTTP, PostgREST and repository TypeScript loaders, including cache generation/read/write RPCs, full report verification and optional synthetic legacy certificate verification.

Run `BENCH_LEGACY=1 BENCH_RTT_MS=100 node_modules/.bin/vite-node scripts/tests/bounded-search-benchmark.ts`. Delay is deliberately added per HTTP request, not asserted to be the production RTT. A source update in the local fixture changes the real generation counter before the invalidated-cache run. Then the verified-cache run reuses the recorded fingerprint. Stop the local servers after testing. Never run migration timing and data benchmarks concurrently.

The fixture has 47,934 target customers, 165,292 other-tenant customers, eight annual imports, 88,044 report rows with varied 1–16-item rows and a 200-item tail, and 779 eucalyptus matches. This approximates volume/distribution; it does not reproduce private report contents. It verifies the staff location scope and denied other tenant as well. It measures the full population + facts loaders, not LLM latency, edge-runtime CPU/memory, final presentation/persistence, TLS or hosted cold storage.

Measured full loader timings (synthetic; milliseconds added to each HTTP request):

| Workload | Before | Revised |
|---|---:|---:|
| 25ms/request, invalidated cache, standard reports | 21.47s | 9.25s |
| 25ms/request, verified cache | 17.09s | 4.84s |
| 100ms/request, invalidated cache plus synthetic legacy certificate, full table scale | Not measured | 35.13s |
| 100ms/request, verified cache, full table scale | Not measured | 17.20s |

The 100ms runs returned 47,934 customers and 779 matching facts, with 595 / 435 total HTTP calls. The ID-only population used 48 calls. The legacy-invalidated run transferred about 146 MB; that is a meaningful remaining hosted bandwidth/memory concern, not hidden by a cache-only result. Staff saw 23,967 customers and the populated other tenant returned zero. The local index plan used Index Only Scan with zero heap fetches.

The ordinary migration took 316ms on the synthetic 213,226-row table. With a conflicting writer it aborted in 268ms and left no new index. A 500ms transaction-timeout probe terminated its connection in 520ms, confirming rollback protection on local PostgreSQL 18. Production version is 17.6; CI tests the migration on PostgreSQL 17.

Measurements and limitations are also recorded in the task's evidence artifact. The first local read is **not certified disk-cold**. Synthetic benchmark success is not production acceptance.

## Production acceptance and rollback

Use Jon's existing authorized session/admin switcher, not customer impersonation. Verify eucalyptus and eucalyptus bunch last year, Sea Soil, top 50 Tropical, top customers and wreath follow-ups. Check exact membership/evidence and total elapsed time, not one page. A genuinely invalidated verification-cache path must also be observed/verified without altering private source data merely to make a test. Do not certify cold storage behavior from warm repeats. Record request/deployment IDs and real timing.

If acceptance fails, deploy the previous edge revision first; old RPCs remain. The new unused index/RPC may remain while investigating. Optional removal must target only these new objects, in a separate reviewed bounded migration. An aborted initial transaction rolls back both new objects automatically. Journal import, seven segments, Growth certification and client email remain outside this release.
