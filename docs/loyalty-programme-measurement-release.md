# Programme measurement and existing-calendar integration

## Delivered in this change

- Save/reopen a typed rewards programme; edits append immutable versions instead of rewriting prior commitments.
- Choose an explicit cohort from all active profiles, recorded members, actual segment membership, or an owned Bloom result. Review exact included/excluded/unknown counts, date coverage and contributing orders.
- Confirm an immutable baseline bound to the actual user, tenant, programme version, exact cohort, source-read cutoff and review digest. Unknown history never becomes a fabricated baseline.
- Save customer-over-customer comparisons with exact minor-unit net order totals, separate spend/transaction changes, frozen weighting, explicit daily normalization and immutable source evidence.
- Preserve inaccessible/merged members as identity-review records rather than changing the denominator. Full refunds remain evidence but do not count as a retained positive-net purchasing transaction.
- Optional actual sent-campaign evidence measures subsequent purchases, not causal lift. Enrolment dates, CRM creation and newsletter consent are separate concepts.
- Inspect original evidence, paginate full results, export all members with CSV-formula protection, and explicitly save selected result states as a static segment.
- Import an existing Excel/CSV marketing calendar into existing `campaigns`/`content_tasks`: sheet/heading selection, mapping, explicit date convention/timezone, original cells, duplicate detection, rejected-row acknowledgement and atomic repeat-safe commit. Every imported task is `planned`; no messages are scheduled.
- Bloom can discover actual programme definitions and read saved baselines/results. These tools are read-only and keep the source limitations visible.

## Reused authorities

Existing customer identities, order records, segments, campaign sending, consent, provider points and purchased gift-card balances are not replaced. Programme publication records are intents only, not a second money ledger. Real reward issue/reserve/redeem/reverse still belongs to the shared offer authority and its separate checkout integration.

## Deployment order

1. Apply `20261015170116_loyalty_programme_operations.sql` to the CRM project.
2. Deploy `loyalty-programmes` and the affected `bloom-assist` modules.
3. Deploy the CRM bundle from the tested merged commit.
4. Verify the saved-programme and calendar workflows with synthetic records before a client rollout.

The new tables allow authenticated, company-wide read access only through the existing permission model. Browser writes are denied. Mutations use server-only invoker RPCs which recheck the actor's current role/company at commit. Immutable evidence cannot be overwritten even by the application service role.

## Verification

Run:

- `npm test -- --maxWorkers=4`
- `npm run build`
- `npx playwright test --config=playwright.loyalty.config.ts`
- `PGDATABASE=bloom_loyalty_test python3 scripts/tests/loyalty-programme-db.py`
- `deno check supabase/functions/loyalty-programmes/index.ts`

The PostgreSQL contract refuses to run outside the explicitly disposable test database. It exercises two actual concurrent connections, actor revocation, cross-company denial, immutable snapshots, exact cohort identity, repeat-safe static segments, and complete rollback after a later calendar row fails.

The dedicated desktop/mobile browser fixture uses real UI components with intercepted synthetic API responses. It is not a production auth bypass, and is not a substitute for the independent API and PostgreSQL authorization tests. No real customer files, credentials or personal data are included.

## Boundaries

Human confirmation of reconciled source coverage is recorded with the evidence description; the software does not assert that an external POS export is complete merely because it parsed successfully. Source dates are read cutoffs, not a claim of historical database time travel. Programme effects require real dated completed orders; imported aggregate statistics are not converted into visits. Live Ideal API entitlement and historical coverage still require vendor/client verification.
