# Conversational Bloom operations

Date: 2026-11-17. Tracking: #550. This document describes the implemented release surface. Deployment, activation and production checks must be recorded separately; code presence is not proof of live operation.

## Product objective

Bloom is a capable, human-first garden-centre assistant. Slack is the internal conversation interface; the existing OpenAI API account supplies intelligence. It retrieves authorized, current records rather than pretending to know everything. Missing integrations, incomplete history and unknown consent remain explicit. Customers can request a person; human stops and ownership must survive automation.

## Architecture and rollout

The existing signed Slack event endpoint, staff mappings, thread bindings, durable notify jobs, progress messages and final-reply receipts remain in use. `slack-conversation.ts` invokes the new native tool-calling agent only when `bloom_support.settings.slack_agent.enabled` is true. The existing responder remains the rollback path.

The live private/unshared-channel boundary also applies to that rollback responder and the deterministic ticket shortcuts. Staff identity and thread binding are rechecked after the channel lookup, before work, and before disclosure. Public requests exclude prior conversation history and private ticket identifiers, since a channel may have changed visibility since those earlier turns.

Both responders restrict model requests to the official OpenAI API endpoint. If a configured destination is rejected, the legacy responder returns sanitized deterministic evidence; it cannot forward those records to the rejected provider.

`slack-agent-core.ts` owns finite tool schemas, current-message intent checks, redaction, bounded planning and receipts. `slack-agent.ts` binds every operation to the authenticated staff principal and conversation. New SQL functions derive the actor/ticket from the durable job rather than trusting model arguments. Nothing grants arbitrary SQL, shell, email-send, credential, payment or production-deployment access.

Enable only after required CI, merge and the production worker deployment are verified. An authorized admin uses `bloom_support.set_setting(actor, 'slack_agent', '{"enabled":true}')`. Disable the same setting to return to the previous responder. Keep the database fixes in place; reverting the missing-principals fix would break approvals again. No new recurring job or paid service is introduced.

## Available work

There are 19 finite tools. Public or unverified channels receive approved product-help search only, plus clearly labelled general advice or draft copy. Private, non-shared channels may use authorized support totals, ticket search/evidence, client lookup/context, recorded feature/release status, held replies and existing read-only CRM/CMS/POS adapters. Major Projects and personal-customer intelligence are owner/operator-only.

A client is selected from a live account lookup. Ambiguous names require clarification. A ticket thread cannot enumerate other clients or the global inbox. Customer lookup stays within one verified CRM tenant, returns at most five name matches, and requires selection before a profile read. Profiles omit email, phone and address; they expose recorded preferences and purchase metrics, including freshness/coverage warnings. A recorded opt-in is not permission to bypass campaign suppression or sending rules. Null purchase history is unknown, not zero.

Marketing help can combine recorded client context, campaign/product information and customer-data coverage with explicitly labelled recommendations. It must not invent stock, offers, prices, service availability, seasonal claims, financial results or complete lifetime histories. The model is not an unrestricted internet browser.

Default suggestions use verified existing capabilities and need no new discount or loyalty program. Incentives require merchant approval, margin/stock checks and product support before implementation or customer-facing offer copy. Campaign eligibility requires current consent and suppression checks; aggregate opt-in counts are insufficient.

## Natural-language actions

In a bound private ticket thread:

- `Draft a reply explaining what we know. Do not send it.` reads current ticket evidence, then stores a private proposal in Reply approvals. It creates neither a public message nor a delivery job before human review.
- `Get a human to help with this.` records the existing escalation and preserves context. A queue receipt is not proof a person read it.
- `Fix this and deploy it.` requests the existing engineering pipeline under the staff member's real permissions. Human stops, maximum attempts, authorization, review, merge, deployment and verification gates remain intact. Read-only investigation questions do not start coding.
- `Resume this release.` can resume deployment/verification tracking only for a recorded merged release. It does not approve or merge arbitrary work.

In an unbound private support channel, an owner can say `Answer our support emails`. The atomic batch examines at most 25 new requests and queues eligible routine questions into the existing triage/answer pipeline. It skips human-owned, urgent, sensitive, already-active and otherwise ineligible work. It reports examined/queued/skipped/remaining rather than claiming the entire inbox was answered. This concerns ingested Bloom Support emails, not a staff member's whole Gmail mailbox.

The existing claim/pause/resume ticket shortcuts remain available. Negated and hypothetical requests must not trigger those shortcuts.

## One approval queue

The live approval functions incorrectly referenced `public.principals`, a table absent from CRM production. This release repairs them to use active `bloom_support.principals`, actual role/permissions and per-ticket access.

All newly held automated replies now use the durable Bloom Reply approvals queue, even if Gmail credentials exist. The legacy explicit Gmail adapter is retained but is not an automatic mirror or a second send authority. Existing Gmail drafts are not deleted, sent or reconciled by this change.

Review validates the exact primary recipient, draft state, ticket version and last customer message. New Slack drafts supersede older pending drafts by the same preparer using a NEW approval ID; old buttons cannot approve replacement text. Approval and creation of the one outgoing job happen atomically. A private proposed message becomes public only on approval. The delivery boundary rechecks the approved record, active reviewer, ticket scope and customer-message freshness, then sends the saved subject/body/recipient. It does not append later content or new CC recipients. An approval becomes sent only with a matching provider-accepted ledger entry. AI-authored text retains its automated-message marker even when a person approves it.

## Cost, privacy and reliability

Reuse the configured OpenAI model and existing daily account/global quotas. Maximum five model rounds, four sequential tool calls, 1,100 output tokens per round, bounded tool results and a short processing window. No parallel tools, unbounded autonomous loop, new polling schedule or credit purchase. Each tool call is audited. Duplicate action jobs replay database receipts. Partial or failed work is reported without invented success. Recipient addresses, credentials and large raw records are removed before model input. Source links are application-generated, not model-generated. Staff and channel privacy are checked again before disclosure.

## Verification requirements

Pure tests cover role/channel scope, intent/negation, strict schemas, malformed calls, prompt-injection boundary, duplicate calls, changed authorization, model/tool failures and bounded work. Runtime tests cover official-provider restriction, rollout switch, private-channel verification, staff identity binding, budget use, source links and changed privacy. Approval delivery tests cover frozen content and rejection of invalid/stale approval bindings.

Database verification was performed in explicit rollback-only transactions: private drafts; idempotency; unauthorized/stale approval rejection; atomic one-job delivery; no optimistic sent flag; safe inbox queueing and replay; sensitive-message skipping; exact-client aggregate/customer isolation; explicit repair dispatch under the real actor; human-stop preservation; rejection of an unmerged release. No customer emails or coding jobs from those fixtures were committed.

After deployment, test a real authorized Slack mention, a follow-up without another mention, a live private support lookup, public-channel privacy refusal, marketing advice, a draft against an explicitly internal test ticket and its appearance in Reply approvals. Confirm tool audit rows and successful final Slack receipts. Do not use a real payment or customer email as a smoke test. Record the actual results, model, main commit and function version in the release report.

## Research basis and design decisions

External sources consulted 2026-11-17:

- OpenAI function calling: https://developers.openai.com/api/docs/guides/function-calling. Adopt strict schemas, native tool results and controlled sequential execution; application permissions remain authoritative.
- OpenAI agent safety: https://developers.openai.com/api/docs/guides/agent-builder-safety. Treat retrieved content and email as untrusted, minimize data, and retain approval boundaries.
- Intercom Fin Procedures: https://www.intercom.com/help/en/articles/12495167-fin-procedures-explained. Adopt a knowledge-plus-controlled-procedures model instead of an unrestricted agent.
- Front Copilot: https://help.front.com/en/articles/4848832. Use contextual assistance and drafts without pretending human review occurred.
- Resend idempotency: https://resend.com/changelog/idempotency-keys. Provider idempotency has a finite retention window; never interpret an ambiguous outcome as proof nothing was sent.

Internal basis: main Slack conversation/intake/action modules; existing support actions, product adapters, email ledger, approval functions, engineering/release controls; live CRM schema and actual migration history. This is an extension of those systems, not a replacement.

## Remaining boundaries, not hidden promises

Coverage depends on verified client links, product adapters and approved guidance. This release does not import every email/file into a universal memory, provide arbitrary customer exports, turn recommendations into approved campaigns, override payment/security decisions, or guarantee every requested code repair can be safely auto-released. A broader knowledge-refresh pipeline and quality-evaluation set should be built from observed gaps, with source dates and review ownership. Do not claim those future capabilities are complete merely because this tool layer exists.
