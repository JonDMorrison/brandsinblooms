# Bloom Support in Slack

## Workspace established November 7, 2026

The existing Brands in Blooms Slack workspace contains four new channels. Jon and Jeff are members and channel instructions have been posted.

| Channel | Slack ID | Visibility | Purpose |
| --- | --- | --- | --- |
| ask-bloom | C0CFUG4LFLJ | Public | General questions and approved knowledge; interactive bot not enabled |
| bloom-tickets | C0CFNEQBS2X | Private | Ticket ownership, triage, status and customer verification |
| bloom-features | C0CFWJDUQU9 | Public | Product proposals and decisions, with no client-private content |
| bloom-alerts | C0CFUG4STS6 | Private | Outages, critical incidents, and escalations |

The Slack account does not support Canvases on its current plan. The channel messages and this file serve as the handbook; do not upgrade for this feature.

## Already-live email intake

The Support email address is bloom@bloomsuite.app. Email delivery uses the signed Resend receiving webhook and creates a ticket in the [Support desk](https://bloomsuite.app/support). Production ticket #1021 was created through this flow; prior live checks #1016 and #1017 passed. No additional inbox or recurring polling agent is required.

## This PR: outbound Slack notifications

The optional notifier uses the **existing** staff notification function and leased Bloom Support job queue, which already runs once per minute. It does not add a bot process, cron, or model call.

- A new Slack job is enqueued only for selected internal staff notification events, and only after support settings slack.enabled is explicitly switched on.
- Ticket and engineering events go to bloom-tickets; feature events go to bloom-features; incidents, escalations and job failures go to bloom-alerts.
- Slack payloads have only generic event class and a ticket deep link. No names, requesters, ticket subjects, customer records, sensitive screenshots, or private email text.
- One event yields one Slack notification job no matter how many owners receive in-app notifications. Existing job retries and failure reporting apply.
- Existing support inbox and ticket creation do not depend on Slack delivery.

The SQL migration installs slack.enabled = false by default. **Do not turn it on without bot credentials and final tests.**

## Secure activation checklist

1. Configure an authorized Slack bot with chat:write scope in the existing workspace and join it to the three outbound channels. ChatGPT's Slack connector is not a production bot token.
2. Set these secrets on the CRM Supabase project using the provider's secure settings interface (never send them through Slack or commit them):
   - BLOOM_SUPPORT_SLACK_BOT_TOKEN (confidential token)
   - BLOOM_SUPPORT_SLACK_CHANNEL_TICKETS = C0CFNEQBS2X
   - BLOOM_SUPPORT_SLACK_CHANNEL_FEATURES = C0CFWJDUQU9
   - BLOOM_SUPPORT_SLACK_CHANNEL_ALERTS = C0CFUG4STS6
3. Obtain required code review, merge to main, deploy bloom-support-worker, and apply the database migration under normal database change controls.
4. Enable slack.enabled through an authorized admin/operator setting only after verifying bot membership and sender credentials.
5. Create one synthetic staff-only ticket and confirm exactly one safe message appears in the selected Slack channel with a working authenticated link. Verify retry, failure isolation, and no unsolicited client mail. Check the live logs.
6. If unsuccessful, set enabled back to false. Keep the original email/in-app notification flow running.

## Ask Bloom channel automation

The public channel is created and usable by the team. **Automatic AI replies are not delivered by this notifier.** Interactive Ask Bloom needs a Slack app Events subscription and signed webhook, staff identity mapping, privacy-preserving approved knowledge lookup, replay prevention and rate limits.

The first release should answer only from approved public product documentation, with a link to the support desk for unresolved questions. No ability to read private tenant data or execute changes should be added until the sender is identified with the same tenant and permissions as in BloomSuite. Never use an application-wide service account to perform the requester's actions.

## Operating policy

- Bloom Support remains the sole source of truth for customer tickets and feature requests.
- Post no customer-identifying data in public channels. Use private channels only for minimal internal summaries and authenticated links.
- A GitHub merge or a READY Vercel deployment is not a verified customer resolution. Test the original customer workflow.
- Slack messages cannot authorize payments, refunds, access changes, bulk sends or production deployments.
- Avoid recurring AI monitoring and excessive Actions. No new monthly fees or paid agent runs without approval.

Related: [Slack integration issue #415](https://github.com/JonDMorrison/brandsinblooms/issues/415), [email forwarding PR #414](https://github.com/JonDMorrison/brandsinblooms/pull/414).
