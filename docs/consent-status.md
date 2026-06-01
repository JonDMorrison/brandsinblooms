# Email consent in BloomSuite

BloomSuite enforces email consent on every marketing campaign send to comply
with anti-spam regulations (CASL in Canada, CAN-SPAM in the US, GDPR in the
EU) and to protect your sender reputation. This page explains what we
track, what each consent state means, and how to get help if you believe
your list has been incorrectly classified.

## Consent states

Every customer record in BloomSuite carries a consent state in two
columns:

- `email_opt_in` (boolean) — the gate. `true` means we will send marketing
  email to this address. `false` means we will not.
- `email_consent_method` (text) — how that gate was set. Common values:
  - `confirmed_opt_in` — explicit double opt-in via a form on your site.
  - `implied_consent` — inferred from a purchase or other commercial
    relationship at the time we imported the customer.
  - `pending_confirmation` — we know about the email but we do not yet
    have evidence of consent. These contacts are **not** eligible for
    marketing email.
  - `manual_opt_out` / `unsubscribed` / `bounced` / `complained` — the
    contact left, the address bounced, or the recipient reported your
    message as spam.

You will see these states surfaced in three places:

1. The **Audience step** of the campaign editor, in the "Consent status
   across your contacts" panel.
2. The **Audience health** card on the main dashboard.
3. The **send-time confirmation modal**, which warns if your audience for
   this send is materially smaller than your last campaign.

## What "pending confirmation" means

A `pending_confirmation` contact is one we imported into BloomSuite
without a recorded opt-in event. They are not currently eligible to
receive marketing email. The most common reasons a contact ends up in
this state:

- **Legacy import without purchase history** — when we migrated the
  contact in, there was no commercial relationship we could rely on to
  infer consent.
- **Manual contact add without a consent record** — a contact added via
  the form or import without the consent checkbox ticked.
- **Re-consent campaign was opened but not confirmed** — the recipient
  opened your re-consent email but never clicked the confirmation link.

These contacts are intentionally held back until either you collect
explicit consent (through a form, a re-consent campaign, or a verified
purchase) or you provide attestation through support.

## What happens at send time

When you click Send on a campaign, the BloomSuite resolver counts only
contacts whose `email_opt_in = true` (and who are not on the suppression
list). This is the count that appears on:

- The Approved / Protected / Blocked stat cards in the send confirmation
  modal.
- The recipient count column on the campaign list view.
- `crm_campaigns.projected_recipient_count` and `total_recipients`.

If that number is materially smaller than your previous campaign's send
count (less than 50% with the previous send having been at least 100
recipients), the send modal will warn you before you proceed. This is
the signal we added in response to the Erin Minter incident
(2026-05-30) where a tenant's resolved audience dropped from 4,346 to
1 between consecutive sends because consent enforcement tightened
underneath them with no UI surface.

The send is not blocked — you can always proceed — but the warning is
hard to miss.

## What to do if a tenant's list looks wrong

If you believe contacts have been incorrectly classified as
`pending_confirmation` and you have evidence of consent (CRM exports,
loyalty signup records, prior purchase receipts):

1. Open the campaign editor or the dashboard's Audience health card to
   confirm the breakdown.
2. **Do not bulk-flip `email_opt_in` to true directly.** That is a
   compliance event and needs an attestation trail.
3. Contact BloomSuite support with the tenant ID, an export of the
   affected contacts, and the consent evidence. Support can run a
   guarded restore that records the consent source, IP (where
   available), and timestamp on each row — preserving the audit trail
   you need for a CASL or GDPR inquiry.

## See also

- [Email relay policies](./email-relay-policies.md)
- [Email UX policies](./email-ux-policies.md)
- [Email governance Resend e2e testing](./email-governance-resend-e2e-testing.md)
