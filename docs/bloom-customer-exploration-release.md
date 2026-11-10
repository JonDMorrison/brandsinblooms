# Bloom customer exploration

This release extends the existing CRM and Bloom tools. It does not replace the POS or marketing integrations.

## Delivered

- `explore_customer_purchases`: literal product/SKU/category/department/date rules, exact stored customer IDs, explicit all/previous/saved population, purchase intersections and negatives, and elapsed-days follow-ups.
- `inspect_customer_set`: included/excluded/unknown buckets with pagination and a complete rule trail.
- `explain_customer_set_member`: original imported row fields alongside normalized purchase evidence, plus reasons for inclusion/exclusion.
- `analyze_customer_basket`: other purchases by the same customer group, distinct-customer counts and explicit denominators.
- `compare_customer_growth`: each customer's completed-order spending and visits compared with their own earlier period, decimal money arithmetic, refunds, one currency, explicit weights and index 100 = unchanged. No imputed values or fabricated percentages when a weighted baseline is missing/zero.
- `save_customer_set_segment`: confirmation, actual count, atomic/idempotent static audience creation and stored source provenance. Does not send messages or alter consent.
- Customer rankings use selected factors only, percentile ranking, explicit missing factors, disclosed Top-N omissions and the current/saved customer group.
- Intelligence includes a direct date/weight/currency comparison form and product exploration entry point. Bloom result cards show rules, evidence, source limitations and drill-down actions.
- Dynamic/static segment helper copy; Ask Bloom links prefill the composer rather than silently executing a prompt.

## Safety and precision

Customer data reads require the authenticated data client, both customer/report permissions and tenant scope. Snapshots are written server-side and readable only by their owner with the same permissions. They cannot be forged by client inserts. Customer sets are scoped to conversation as well as tenant/user. A changed access boundary fails instead of silently shrinking a saved set. Each step records when its source was read; membership is frozen, not the underlying mutable POS ledger.

No consent/persona filtering is hidden inside analytics. Sending eligibility remains a separate existing campaign check. A negative purchase match means no match in the available records, not proof of complete source history. New customers in the report are labelled newly observed, not automatically new loyalty members. Growth/retention are observations, not causal campaign uplift.

Queries page through all visible rows and reject scans beyond 250,000 records rather than returning misleading partial totals. No new dependencies are required.

## Validation

Run `npm test`, `npm run test:security`, `npm run build` and targeted ESLint for the new modules. New precision/component tests exercise follow-up membership, branching, missing data, time zones, duplicate facts/orders, refunds, zero baselines, explicit weights and approval-safe actions. Run `scripts/tests/customer-exploration-db.sql` only in a disposable database named `bloom_analysis_test`; it creates and rolls back isolated fixtures. The dedicated CI workflow executes that database contract.

## Deployment order and remaining boundaries

Apply `20261007202819_bloom_customer_exploration.sql` before deploying the updated `bloom-assist` function. The repository's existing edge deployment workflow handles function changes on main; verify its run rather than assuming a frontend deployment deployed server functions.

Growth requires canonical, dated completed orders. Do not synthesize orders or visit counts from aggregate Ideal reports or demo line items. Validate Bryan's real export coverage before client sign-off. The Ideal API remains dependent on the actual vendor's documentation and permissions. This release does not deliver Ideal write-back, invoice import formatting, master-calendar migration, campaign holdouts, or a permanent program-baseline store. Existing dynamic segments retain their current rule system; a conversational exploration saves a reviewed static audience, not an unimplemented dynamic rule.
