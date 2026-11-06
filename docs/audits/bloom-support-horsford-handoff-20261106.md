# Horsford support handoff audit — 6 November 2026

Ticket #1019 needed a new checkout capability. Bloom's small-bug repair runner correctly stopped at its protected scope. The workflow then lost the distinction between accepting a request, implementing it, and handing it to a person.

## Evidence (UTC)

- 14:31:03: the request was opened from ChatGPT by staff, summarizing Kate's requirements.
- 14:32:01 and 14:32:04: two investigation jobs dispatched the same issue, consuming the two-dispatch budget. Triage simultaneously routed it as a feature.
- 14:33:59: the repair report stopped because the feature requires protected checkout/payment/tax/migration work.
- 14:34:01: feature-decision handling replaced the engineering escalation with customer waiting. No customer information had actually been requested. The message described accepted implementation as further consideration.
- 14:34, 14:36 and 14:38: identical stopped-repair notices were emailed. Additional start requests could not clear the fixed policy or exhausted budget.
- 14:40: staff manually took human ownership and supplied an implementation next action.

At audit time engineering was still escalated with no PR recorded, while ticket status was working/human. The active checkout work is CMS [#4335](https://github.com/Brands-In-Blooms/cms-brandsinblooms/pull/4335), linked to [#4331](https://github.com/Brands-In-Blooms/cms-brandsinblooms/issues/4331). That draft explicitly forbids merge, deployment and activation pending its release gates. This change does not alter it.

The delivered-message evidence is from Bloom Support's ticket and engineering APIs. It does not establish that Kate received these notices: the ticket's email ledger lists the staff requester. `notified_at = null` on an escalation also does not prove a person received no in-app notification; customer wording must not claim confirmed staff receipt.

## Implemented workflow

Today cards show a short explanation, one concrete recommendation and exactly three primary choices: **Do It**, **Reject it**, **Something else**. Evidence is inside a native disclosure. Stopped-repair recommendations assign a human review; they never approve a release. Rejection records the exact rejected recommendation, holds automatic follow-up and keeps the underlying ticket open. Alternatives are recorded for human review, not executed as arbitrary instructions. Ownership and a next-day follow-up are persisted; errors remain visible. Existing feature-plan choices still use the permission-checked feature decision endpoint and disclose customer notification.

Investigation uses an optimistic database version claim before any GitHub mutation. Duplicate jobs observe the existing run. Human-required reports and exhausted budgets reject Start repair before new jobs are queued. Feature decisions preserve linked engineering status and concurrent human ownership. Stopped engineering work receives an explicit next action, owner where configured and deadline; late reports do not overwrite human workflow. The worker ignores stale progress and deduplicates the same engineering-status message within a ticket's reopen cycle. Accepted/planned features stay with the team, not customer waiting. Pre-release worker steps respect human takeover; monitoring an already-started release continues.

## Release and rollback

Apply `20261106192402_bloom_support_engineering_handoff.sql` with the worker/frontend change after staging validation and independent review. The migration replaces two existing functions, preserves their permission checks and grants, and changes no table schema or existing customer rows. Its transaction has bounded lock/statement timeouts. Main pushes automatically deploy code, so release ordering must be reviewed before merge. Repository database guidance requires staging and a maintenance window. Main branch protection requires one approving review.

For rollback restore the worker/frontend revision, then restore `decide_feature_request` from migration `20261106110933` and `update_engineering_issue` from `20261105230000`. Do not remove feature shipment history or undo recorded human decisions. No customer reply or resolution should be sent until the actual affected workflow is verified.

## Limits and remaining operations

This change does not backfill ticket #1019, claim the checkout is complete, link its active PR into release automation, or contact Kate. Human multi-step decisions use existing endpoints; failures hold automation first and show an error, but the overall sequence is not one database transaction. Staging/browser acceptance and hosted checks are release gates. The Today view is the simplified entry point; advanced engineering and escalation panels remain available in the full desk. Cross-channel staff conversations and the original Kate email were outside this delegated code audit.
