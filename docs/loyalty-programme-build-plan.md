# BloomSuite loyalty programmes — implementation plan

Status: approved direction for implementation, not a production-completion certificate.
Version: 2026-10-14.

## 1. Product decision

Build one rewards-led loyalty capability shared by CRM, POS and the existing customer portal. Make successful customer relationships the purpose: welcome people, encourage a worthwhile return, recognize loyalty, introduce a relevant department, and measure what changed. Events, useful benefits and targeted offers are the default; retain existing provider points and earned balances without migration or conversion.

Do not create another CRM, campaign editor, calendar, identity system, gift-card balance or loyalty-points ledger. The programme designer assembles existing capabilities around a small, well-defined promotional reward lifecycle.

Three distinctions must remain visible:

1. Analytics eligibility is not marketing consent or deliverability.
2. A programme definition is not an issued benefit, and an issued benefit is not proof of redemption.
3. Observed customer growth or attributed purchases are not proof of incremental campaign impact.

## 2. Existing assets and boundaries

Use these current repository anchors, verifying their live contracts before changes:

| Concern | Existing authority to reuse |
| --- | --- |
| Customer identity and matching | crm_customers; resolve_crm_customer_identity; existing merge review |
| Purchase evidence and imports | customer_purchase_line_items; customer_intelligence_imports; customer_intelligence_source_events; existing integrations wizard |
| Conversation audiences | bloom_customer_sets; customer-exploration tools; included/excluded/unknown buckets |
| Segments and recipient selection | crm_segments; customer_segments; existing campaign eligibility and suppression checks |
| Email/SMS | Existing campaign composer, send queue, delivery events and unsubscribe handling |
| Provider balances | loyalty_provider_accounts and existing provider reconciliation; never fabricate points from import events |
| Customer experience | Existing preference-token validation and loyalty wallet; verify token scope before adding benefits |
| Planning | Existing campaigns/content_tasks calendar; do not introduce a second calendar |
| Product imagery | product_images related to products; image_url and thumbnail_url are not products columns |
| Access | Distinguish has_tenant_permission's legacy singular keys from crm_has_permission's CRM permission keys |

The earlier customer-exploration release did not deliver permanent programme baselines, conversational dynamic-rule execution, Ideal write-back, invoice formatting, calendar migration or a complete reward-redemption authority. Do not present these as completed because nearby code or demo data exists.

## 3. Customer and staff experience

### Owner/marketing: Plan → Rewards → Results

Plan starts with the business goal and a reviewed template. A five-step setup gathers: goal and dates; audience and data coverage; benefit and qualifying basket; budget and communication; review and approval.

Review shows the exact rules in plain language, source coverage, included/excluded/unknown counts, recipient count, contactable count by channel, maximum financial exposure, reward inventory requirements, programme limits, and redemption integration readiness. Values without evidence display as unknown, not zero. Save draft, simulate and preview never activate a programme or send a message.

Rewards shows issued, reserved, redeemed, expired, cancelled and reversed benefits. Every entry links to the original programme version, issuance reason, customer, qualifying event and redemption evidence. Editing a programme creates a new version; it does not silently rewrite issued terms.

Results shows qualified → issued → contacted → redeemed → purchased → returned again. Definitions, periods, denominators, data freshness and limitations are always accessible. Unknown or inaccessible customers remain accounted for, rather than silently disappearing from an analysis.

### Cashier

Identify the customer using existing POS identity. Display relevant available benefits and a concrete eligibility reason. Apply a benefit to the current basket, show the adjusted total and reserve it during payment. Commit redemption only with authoritative sale completion. Release it on failed/cancelled payment. Replaying a completed sale must produce the same result, not consume another reward.

Manual external-POS fulfilment is a separate permissioned workflow. A staff-confirmed fulfilment must be labelled as manual evidence, not as a verified POS discount. Do not offer automatic checkout claims for connectors that cannot enforce them.

### Member

Extend the existing mobile member page: member identification, available benefits and terms, event invitations, recorded usage and the existing preference controls. Add purchased-plant care information where product identification supports it. Customers can mark gifts or plants they no longer own. Start web-first; native apps and Apple/Google Wallet distribution are optional integrations, not prerequisites.

## 4. Programme catalogue

Every monetary example is illustrative and must be configured for the tenant's currency and economics. Never infer a customer's birthday, membership, consent, gardening ability or missing purchases.

| Programme | Eligibility/trigger | Benefit and essential controls | Primary outcome |
| --- | --- | --- | --- |
| Welcome and second visit | Confirmed membership enrolment | One issued welcome benefit per membership identity; expiry; qualifying next transaction; no automatic marketing opt-in | Completed second purchase |
| Valuable-customer win-back | Explicit value, frequency and same-season inactivity rules | Reviewed recipient snapshot; selected gift/voucher; budget; comparison group only for discretionary promotion | Return rate and subsequent net spending |
| Spend and receive | Verified single qualifying basket | Fixed gift SKU; explicit > or >= threshold; exclude gift cards, taxes, fees and the gift itself by default; one per basket or repeatable across transactions; stock and campaign cap | Basket value and contribution after actual gift cost |
| Department discovery | Recorded buyers with no purchase in a selected department during a declared coverage window | Department-restricted fixed/percentage voucher; maximum discount; exclusions; one use | First recorded department purchase and later repeat |
| Seasonal member voucher | Confirmed membership and campaign window | Fixed amount against minimum eligible spend; redemption dates; no silent stacking | Seasonal return and net spend |
| Recognition/VIP experience | Explicit frequency and/or value rules | Lunch, consultation, member event or early access; booking capacity; distinguish invitation, booking and attendance | Attendance and subsequent repeat business |
| Multi-buy | Eligible SKU/category quantity in one basket | Defined group size and free-unit count; exact cheapest-unit/grouping policy; whole-unit validation; no double-discounted line allocation | Eligible product sales and margin |
| Purchase milestone | Verified qualifying completed transactions/items | Configurable nth-purchase benefit; deduplicate transactions; state whether reward applies to nth or next purchase; refund reversal | Repeat purchasing |
| Referral | Confirmed referring member and distinct new identity | Configurable signup or first qualifying purchase trigger; reward both parties; cancellation and duplicate controls; no household/IP-only auto-rejection | Acquired purchasing members |
| Birthday | Voluntarily provided month/day | One per member per programme year; leap-day policy; minimal personal data; owner-approved expiry | Redemption and useful member engagement |
| Staff kindness | Authenticated employee within assigned location | Approved benefit menu; daily per-staff allowance; total budget; supervisor exceptions; no sensitive personal stories required | Verified gifts and subsequent relationship outcomes |
| Unused-benefit reminder | Active unused benefit near expiry | Fresh redemption state, separate channel permission, frequency cap and send-time recheck; expiry reminder lead time configurable | Redemption without duplicate/incorrect reminders |

## 5. Shared rule and reward authority

### Rule evaluation

Implement a pure, versioned rule evaluator with typed input. Its inputs must be server-resolved facts, not model-invented values. It returns eligible, ineligible or needs-review, explicit reason codes, the qualifying lines/events and an exact benefit calculation. UI simulations use the same semantics but are explicitly non-authoritative.

Money uses integer minor units and an explicit supported currency. Never combine currencies or infer conversion. Define amount basis (eligible goods after existing discounts, before tax by default), exclusions, comparator, caps and stacking. Missing quantity, currency, date or product identity blocks the affected rule rather than defaulting to zero or one. Validate non-finite numbers, unsafe totals, unsupported fields and empty product selectors.

### Persistence

Reuse coupons where their existing contract genuinely fits. Add a narrow promotional entitlement/event layer only where necessary for non-coupon benefits, repeatable earning, reservation and immutable evidence. Do not replace purchased gift cards or provider balance ledgers.

The design needs immutable programme versions; approved audience snapshots; issued entitlements; qualifying events; reservation/redemption/reversal events; and explicit references to customer, tenant, location, programme version and external transaction. Separate promotional value, actual cost and points units.

### Concurrency and money safety

All issuance, reservation and redemption mutations go through authenticated server operations. Browser/model clients never supply an authoritative discount or directly update a usage counter. Use unique idempotency constraints, transactional row locks and consistent lock ordering. Validate the same tenant/customer/location on every linked record.

State flow: draft programme → approved version → issued entitlement → reserved → redeemed. Expiry/cancellation/reversal are explicit events. Reservations expire safely. Preserve already-issued commitments if a programme is paused; an emergency cancellation requires a separate authorized action and audit reason. Decide refund effects per benefit and avoid auto-restoring cash-like value without a documented policy.

Offline checkout must not spend a one-use server-authorized reward without a proven conflict-resolution design. First release should explain that online verification is needed instead of risking duplicate redemption.

## 6. Bloom's role

Reuse the current conversation and exact customer sets. Bloom can propose a goal, explain audience rules, explore follow-ups, compare periods, summarize results and draft communications. It must not generate factual purchase values, invent qualifying evidence, silently discard unknowns, or activate money-affecting operations.

Add tool contracts incrementally: list programme templates; simulate a programme; inspect eligibility; prepare a programme draft; read a saved programme result; prepare issuance; prepare a campaign. Any mutation retains existing role checks and an explicit approval step bound to the reviewed version and count. Changes after approval require a fresh preview. Sending requires the existing campaign approval, consent and suppression checks independently of reward issuance.

Use one deterministic authority for eligibility and redemption, not different AI interpretations in CRM, website and POS. A prompt saying 'do not invent data' is not the control; validation and database invariants are.

## 7. Measurement and data integrity

### Customer growth

Show spend growth and transaction-frequency growth separately. Optional weighted index: 100 = unchanged; index = 100 + weighted mean of comparable percentage changes. One transaction becoming two is +100%, not +50%. Use the same customers in both windows. Include recorded refunds using the declared accounting convention. Current partial months compare to equal elapsed prior periods unless the owner explicitly chooses daily normalization.

Zero/non-positive baseline, missing dates, incomplete transactions, mixed currencies and ambiguous identities remain unscored or separately classified. Imported line items and summary reports are not automatically visits. New-to-database does not mean new member.

### Permanent baseline and scorecard

Capture an immutable programme baseline with source cutoff, periods, rule/version, cohort IDs, values and evidence references. New reports must not rewrite that baseline. If customer identity merges or access changes, show a reconciliation rather than silently shrinking/reassigning the original population. Preserve retention denominators and exportable customer-level explanations.

Track new member enrolments from actual enrolment events, subscriber changes from consent state/events and purchase reactivation from declared inactivity rules. Show financial outcomes as net spending, actual reward cost, messaging cost and contribution where cost data exists. A gift's shelf price is not the merchant's cost.

### Attribution and experiments

Separate observed post-message purchasing, explicit voucher-linked sales and estimated incremental impact. Optional randomized holdouts apply only to discretionary promotional actions; never withhold benefits already promised. Freeze assignment before launch, keep assignment stable, prevent exposure contamination and report sample sizes/uncertainty. Do not declare a winner from tiny groups or compare voluntary members against nonmembers as though assignment were random.

## 8. Integration capability matrix

Every connector declares verified capabilities: customer read/write, historical orders and lines, incremental changes, completed-sale events, coupon creation, checkout validation, redemption events, refunds, loyalty balances, inventory and data freshness.

Manual exports support historical analysis and evidence reconciliation, not automatic external till enforcement. API availability must be verified for the actual vendor/account. A locally designed adapter or catalogue label does not establish a working API.

Bloomsuite POS should eventually reserve and redeem against the shared authority in the sale lifecycle. Before implementation, discover its actual repository, tenant mapping, transaction identifiers and payment hooks. Do not copy an unverified client pattern or assume databases are shared. Reuse existing events and receipts for invitations/care delivery.

A missing connector capability produces a clear unavailable/manual path. Stale redemption data blocks unused-voucher reminders. A missing price/cost/history never becomes a made-up figure.

## 9. Delivery sequence and exit gates

### Release A — trustworthy foundation and planning

Correct verified image-query and permission-contract failures; keep source and tenant restrictions intact. Add the complete template catalogue, typed programme draft, plain-language rule summary and side-effect-free preview. Draft export and Ask Bloom may reuse existing surfaces. No issuance/sending claim in a planning-only release. Exit: focused regression tests, full unit/component suite, build, reviewed diff and merged source evidence.

### Release B — three complete core journeys

Deliver welcome/second visit, win-back and spend-and-receive end to end: create draft, review eligibility, approve, issue, display benefit, validate, reserve, complete/release redemption, handle refund and report outcome. Use an isolated demo tenant and fictional transactions. Exit: database atomicity/RLS tests, concurrent duplicate-redemption test, replay and failure recovery, budget/stock tests, desktop/mobile workflow checks, and verified deploy on the exact tested commit.

### Release C — measurement and calendar

Finish immutable baseline/run persistence, cohort drill-down, retained/reactivated/new-member definitions and observed campaign outcomes. Import master-calendar files with preview, field mapping, timezone, row-level validation, duplicate detection and repeat-safe commit into the existing planner. Imported rows remain planned/draft; importing is not send scheduling. Exit: totals reconcile to independent fixtures; exports preserve original inputs; partial failures cannot produce false success.

### Release D — extended programmes

Add department discovery, seasonal vouchers, multi-buy, milestone, referral, birthday and staff kindness using the same engine. Reuse event booking/capacity rather than build another event system. Exit: each template passes its positive, boundary, missing-data, duplicate, cancellation and abuse-control cases; no template bypasses caps or permissions.

### Release E — member experience and useful automation

Extend the current member portal, care information and preference controls. Add fresh-state reminders through existing channels. Wallet passes/native push require their own verified provider setup and permission flows; app installation is not mandatory. Exit: no cross-customer token access; revoked/expired tokens fail; no marketing opt-in implied by membership or receipt; reminder rechecks prevent stale sends.

### Release F — controlled pilot and acceptance

Validate actual source exports independently against known customer lists and totals; demonstrate complete journeys with a store operator; test against the real POS payment/refund path; enable feature flags per tenant. Expand only after exact production checks and recorded pilot outcomes. Rollback disables new programme actions without deleting issued benefits, balances, history or audit evidence.

## 10. Mandatory acceptance cases

- More than 1,000/5,000 customers: complete count or an explicit refusal, never silent truncation.
- Customer X buyers → of those, Y buyers → save: exact IDs and visible trail persist.
- Customer excluded or unknown: inspect the reason and underlying source.
- Same import/event received twice: no duplicate transaction, benefit, member or redemption.
- Two tills consume one one-use benefit concurrently: exactly one succeeds.
- Reward repeatable across four qualifying transactions: four awards, not one; each replay remains one.
- Basket exactly at threshold: respect the explicit > versus >= setting.
- Gift card, tax, shipping or gift line: not silently included in eligible merchandise spend.
- Stacked discount, multi-buy and gift allocation: same line cannot receive incompatible allocations.
- Unknown inventory or merchant cost: explicit blocked/review state, not an invented stock/profit estimate.
- Cancelled or failed payment: no consumed reward; completed replay returns original redemption.
- Partial/full refund: deterministic linked reversal without changing another transaction.
- Expired benefit, wrong customer, wrong tenant or wrong location: denied with an appropriate reason.
- Member leaves a qualifying dynamic segment: previously issued benefit retains its approved terms.
- Welcome/referral/birthday duplicate identity and leap-day boundaries: deterministic limits.
- Staff kindness at/over allowance: within-limit issue works; over-limit requires a real supervisor permission.
- No SMS permission or unsubscribe: excluded from sending, not removed from analytics/member entitlement.
- Imported provider points or purchased gift-card value: unaffected by promotional rewards.
- Source history incomplete/stale: unknown status visible; misleading lapsed/unused-reminder claims blocked.
- Programme comparison: fixed cohort, exact net money, correct +100% frequency math, explicit unscored members.
- Holdout: assignment frozen, promised benefits unaffected, no causal claim without adequate evidence.
- Tenant switch during request: no prior company's data or pending draft leaks into the new company.
- Browser checks: failed network requests and permission errors remain failures, not suppressed to get a green run.

## 11. Definition of done

Every claimed feature needs evidence at five separate levels: implemented code, passing tests, merged commit, deployed runtime/schema, and verified customer workflow. A preview, model response, file in a sandbox, passing mock test or merged PR alone is not all five.

Release reports must list what changed, test names/counts and skips, commit/PR, deployment evidence, known limitations and external dependencies. Never say 'everything is complete' while a listed acceptance case is unverified. Never overwrite real customer data or send a campaign during a test. Keep all sample people, addresses, rewards and transactions unmistakably fictional.
