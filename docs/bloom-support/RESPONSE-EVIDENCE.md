# External response and overdue escalation evidence

An email sent outside Bloom Support is not automatically known to the support
clock. A private operator maintenance function can record a verified sent reply:
`bloom_support.record_external_response(actor, ticket, responded_at, source_ref)`.

Before using it, verify the actual sent message, sender, recipient, matching
customer request and sent time. Use a stable message permalink/ID. Never infer
response delivery from a draft, acknowledgement, internal note or client claim.
Only active platform administrators/operators with ticket access may attest;
there is no public RPC, automatic Gmail ingestion or new client permission.
A reply predating a forwarded handoff keeps its actual sent time in the audit;
the first-response metric is clamped to ticket creation to avoid negative time.
Repeated identical evidence is harmless, changed timestamps conflict. This
records response timing and an audit entry without sending mail, changing ticket
status, taking ownership or resuming paused automation. A next-action deadline
still applies. It does not prove a fix or permit customer work to be closed.

The deadline sweep reconciles only `ticket_overdue` escalations whose underlying
deadline no longer applies. Engineering/approval decisions are unaffected.
Unanswered paused/human-owned tickets still escalate. After two missed fallback
steps, generic overdue alerts remain open but repeat daily instead of four-hourly.
Actual email delivery remains subject to the existing per-escalation email ledger.
A new overdue episode can escalate after a wait ends, even at the same deadline.

Internal delivery tests are not inferred from email words such as “test”. An
operator must verify test purpose and completion before resolving the test.
Ordinary ticket resolution can email the requester; use the established reviewed
closure workflow and respect the communication permissions for each task.

## Internal test reporting and unchanged engineering blockers

Internal test classification is a private staff attestation, not a tag or a
subject-text heuristic. After the reporting release is verified, an authorized
maintenance operator may call
`bloom_support.set_internal_test(actor, ticket, current_version, is_internal_test, source_ref)`.
The actor must be an active platform administrator/operator user with ticket
access. Supply a reference to the verified staff test request. The function is
not exposed through the public gateway or granted to the service role. It locks
the ticket, rejects stale versions and records an immutable audit entry. Use a
new attestation with `false` to correct a classification. Do not classify an
ordinary customer report just because it mentions a test.

Classification changes reporting only. It never closes, pauses, takes over,
changes response timing or queues a message. Customer digest sections and totals
exclude attested tests. The separate internal-test section retains their current
status, stage, engineering blocker, verification evidence summary and a review
link. A passing check is reported as recorded evidence, not proof of release
acceptance. Shared engineering issues still count as customer repairs when any
linked ticket is not an internal test.

The report distinguishes sent/delivered acknowledgements and progress emails
from a substantive response. The delivery counts come from the outbound ledger;
queued, failed, uncertain, bounced and suppressed messages do not count as sent.
The existing substantive-response clock is unchanged. The digest quotes only
sent/delivered Bloom messages and labels progress as non-substantive when the
message contract says so.

For `engineering_escalated`, each existing escalation episode keeps its open
blocker but caps fallback at two, then schedules at most one reminder a day.
The queue key deduplicates reminder replay, and row locks protect concurrent
sweeps. New escalation episodes have independent keys. Failure and approval
escalations retain their existing behavior and authorization requirements.
Acknowledged blockers remain visible in the digest. Existing email-ledger
idempotency and delivery cooldown still apply; a daily queue entry does not
promise a fresh email.

Release sequence: verify all required checks and independent review for the exact
head; allow the migration and compatible `bloom-support-worker` renderer to
deploy, then verify both the report and staff-only boundaries before any
separately authorized classification. The migration defaults every ticket to
unclassified, so classification must wait for the compatible renderer. An older renderer ignores the new internal
section, so do not classify tests until both components are verified. This change
contains no production backfill, including for ticket #1026. Classification is not
a substitute for proving the rollback point and affected-flow verification.
Classification and customer communication require their own authorization;
merging this reporting change does not authorize either action.
