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
