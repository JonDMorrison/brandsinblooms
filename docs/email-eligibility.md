# Email eligibility: who a campaign actually reaches

The send worker decides who receives a campaign email. Everything the campaign
editor shows about the audience is counted on the server with the same rule, by
one SQL function, and read through one React Query hook.

| Piece | Where |
| --- | --- |
| Enforcement (authority) | `supabase/functions/send-email-campaign/index.ts`, `supabase/functions/_shared/canSendEmail.ts`, `supabase/functions/_shared/recipientEmailDedup.ts`, re-checked in `supabase/functions/process-email-send-queue/index.ts` |
| Counting (mirror) | `public.email_campaign_eligibility` in `supabase/migrations/20261127120000_email_campaign_eligibility.sql` |
| Client | `src/hooks/useCampaignEmailEligibility.ts` |

Line numbers are for the commit that added this document.

## The rule, step by step

### 1. Audience

`send-email-campaign/index.ts`

1. Segments: `campaign.segment_id` is used if set (L1036). Only when it is null
   are the `campaign_segments` rows read (L1038-1061). The editor saves
   `segment_id` as the **first** selected segment
   (`src/lib/crm/campaignDraftPersistence.ts` L787), so a campaign with several
   segments is sent to the first one only. Members come from
   `customer_segments` joined to a live `crm_segments` row in the campaign's
   tenant (L1206-1242).
2. Personas: `crm_campaigns.persona_ids` plus `campaign_personas` (L1065-1091).
   UUID ids match `customer_personas.persona_id` and `crm_customers.persona_id`;
   other ids match `customer_personas.predefined_persona_id` (L1244-1356).
3. Segments and personas together intersect (L1358-1366). Direct customers
   (`additional_customer_ids`) are then added (L1369-1380).
4. "All customers" replaces all of the above with the whole tenant
   (L1118, L1172-1204).
5. No audience at all: the send is refused, "Choose an audience before sending
   this campaign." (L1106-1117).

### 2. Live customers with consent

`buildCustomersQuery`, L1155-1171:

- `tenant_id` = the campaign's tenant, `deleted_at` null,
  `merged_into_customer_id` null, `email` not null;
- `email_opt_in IS NOT false` (L1166-1168). So **`email_opt_in` true or null
  passes**; only an explicit `false` is excluded.
- **`email_consent` is not read anywhere on the send path** (not in
  `send-email-campaign`, `process-email-send-queue` or `_shared/`).

### 3. Placeholder addresses

Blank addresses and `@noemail.local` placeholders are dropped (L1593-1598).

### 4. One copy per address

`dedupeRecipientsByEmail` (L1601-1619; `_shared/recipientEmailDedup.ts`
L52-98). Addresses are compared trimmed and lower-cased. When several records
share an address and any of them has `email_opt_in = false` or
`crm_customers.suppressed = true`, the address is dropped (L84-90). Otherwise
the oldest record is kept (L91-93).

### 5. canSendEmailBatch

`_shared/canSendEmail.ts` L237-365, called at `send-email-campaign` L1653-1680:

1. Invalid address: fails `^[^\s@]+@[^\s@]+\.[^\s@]+$` (L30), or is on an
   RFC 2606 / 6761 reserved domain: `example.com`, `example.net`,
   `example.org` and their subdomains, or a `.invalid`, `.test`,
   `.localhost` or `.example` TLD (L32-50, L322).
2. Role-based local part (`info@`, `admin@` ...) only when the
   `BLOCK_ROLE_BASED_EMAILS` environment flag is on (L248, L327-334).
3. Global suppression list: not lifted, not expired (L261-282, L336-343).
4. Tenant `suppression_list`: channel `email` or `all`, not lifted, not
   expired, type one of `unsubscribed`, `bounced`, `complaint`, `blocked`,
   `global_block`, `complained`, `hard_bounce` (L52-61, L284-311, L345-358).
5. While the tenant's suppression bypass is active
   (`get_tenant_suppression_bypass_state`, `send-email-campaign` L197-230),
   `bounced`, `hard_bounce`, `complaint` and `complained` entries do not block
   (L1635-1638).

### 6. Send-time re-check

`process-email-send-queue/index.ts` runs `canSendEmailBatch` again on every
claimed message (L1654-1750), retires customers that have since been deleted
or merged (L1755-1770), and applies the care follow-up guard (L1771-1786).

### Send-time overrides (Ready to send dialog)

- "I confirm these contacts have opted in" sends `forceBypassConsent`: the
  `email_opt_in` filter is skipped (L1166) and dedup no longer drops
  restricted addresses (L1604). Unsubscribes and every other suppression
  still block.
- "Retry temporary delivery problems" sends `forceBypassSoftSuppression`: the
  `bounced` type stops blocking (L41, L1640-1646). `hard_bounce` still blocks.

### Not contact eligibility

- Reputation-tier recipient cap (L1762-1772): a volume limit on how many go
  out, not who may receive.
- Care follow-up guard (L1427-1434): only for care-guide follow-up campaigns;
  it can only narrow the list.

## How the SQL function mirrors it

`public.email_campaign_eligibility(p_tenant_id, p_include_all_customers,
p_segment_ids, p_persona_ids, p_customer_ids)` takes the editor's current
audience and applies steps 1-5 above, including the first-segment-only rule,
the address dedup and the tenant suppression bypass. It is `SECURITY DEFINER`
with the same tenant permission check as `email_reachability_summary`
(`customer.read`, `campaign.read` or `campaign.write`).

It returns one row:

| Column | Meaning |
| --- | --- |
| `audience_configured` | false when no audience is chosen (all counts 0) |
| `total` | audience contacts with an email address |
| `eligible` | unique addresses a default send reaches |
| `waiting` | `email_opt_in = false` with a pending confirmation |
| `asked_to_stop` | opted out, unsubscribed or complained |
| `never_opted_in` | `email_opt_in = false`, no opt-out on record |
| `unsendable` | invalid, placeholder or reserved address, suppressed, or dropped by dedup |
| `duplicates` | extra records sharing an eligible address |
| `blocked` | contacts that stay excluded even with both overrides |
| `eligible_with_consent_override` | unique addresses with the consent override |
| `eligible_with_soft_override` | unique addresses with the soft-bounce override |
| `eligible_with_both_overrides` | unique addresses with both |
| `single_eligible_email` | the address, when exactly one is eligible |

`total = eligible + waiting + asked_to_stop + never_opted_in + unsendable + duplicates`;
the client rejects a row that does not add up.

Not mirrored, so the worker can send to fewer than `eligible` when:

- `BLOCK_ROLE_BASED_EMAILS` is on;
- the campaign is a care follow-up and the guard narrows it;
- the reputation-tier cap applies;
- something changes between the count and the send (the worker re-checks).

The worker is always the authority. If the rule changes there, change this
function in the same pull request.

## Who reads it

Every one of these calls `useCampaignEmailEligibility`, with the same query key,
and nothing else:

- Audience panel buckets (`src/pages/crm/CRMCampaignEditorPage.tsx`)
- Audience step badge and collapsed summary
- Readiness bar, including the "No one in this audience can receive email"
  blocker with its link to the Audience step
- Schedule button
- Schedule drawer (`CampaignScheduleDrawer`, through `canConfirm` and `checking`)
- Ready to send dialog (`CampaignSendConfirmation`)

While the check is loading, Schedule and Send are disabled and say
"Checking audience". "Campaign is ready" appears only after the check returns
with at least one eligible address. Zero eligible keeps Schedule and Send
disabled and marks the Audience step amber.

The tenant-wide dashboard cards (Reachable customers, list health) still read
`public.email_reachability_summary`. It uses the same per-contact checks but
counts contacts, not unique addresses, and has no campaign audience.
