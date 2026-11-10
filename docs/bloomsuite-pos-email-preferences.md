# POS email preferences in BloomSuite CRM
The existing signed BloomSuite POS receiver now accepts MarketingConsentRequested
only from an explicitly mapped connection and customer identity. Recipient,
approved statement, policy version, observation time and evidence reference are
retained in a private review queue. Duplicate envelopes are idempotent; changed
retries, missing mappings and foreign customers are rejected.

Email Consent Management shows this queue to owners and marketing staff with
a current server-recorded session. Approval requires reviewing the statement
and withdrawals plus a recorded reason. A later withdrawal, complaint or bounce
blocks approval. The existing authorized atomic channel-consent writer records
the decision, audit proof, canonical consent row and suppression handling.
Rejecting a stale or declined request never changes promotional permission.
Replaying an approved request does not reapprove it after a later unsubscribe.

Receiving the request never sends an email or grants consent. Existing POS
sales/returns, identity resolution and purchase metrics remain on the original
bridge. Tests load the real role getter, authorization boundary and atomic
writer, and verify replay, customer/tenant/session boundaries and withdrawals.
The fixture excludes master-admin override paths and does not claim a legal
or live inbox certification.

Rollout requires the existing private connection mapping/secret, mapped currency
and active POS integration plus a reviewed POS consent-authority selection.
There are currently no configured private POS connections in this CRM backend.
No merchant connection, customer consent or campaign is enabled by this change.
