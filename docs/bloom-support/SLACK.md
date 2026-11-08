# Bloom Support Slack operations

## Verified production snapshot (November 8, 2026)

Bloom uses the **existing** Brands in Blooms workspace, app, Bloom Support queue and BloomSites Major Projects records. Do not create another Slack app, duplicate a ticket desk, or add a polling agent.

A read-only audit on November 8 confirmed live Bloom bot posts across all eight channels, including threaded approved-help, safe unknown-answer, active-project and feature-summary replies. The CRM settings were `slack.enabled=true` and `slack.finance_enabled=true`. The finance cron was active at `0 16 * * *` UTC. The Slack queue showed 89 successful jobs and one historical dead feature-summary job in the preceding day. A successful post is not evidence that every negative-security test has passed.

These are **historical observations**, not an instruction to activate credentials or enable flags in a fresh environment.

| Channel | Visibility | Purpose | Conversational mention support |
| --- | --- | --- | --- |
| `#ask-bloom` | Public | Approved product help and safe unknown answers | Yes, allowlisted staff only |
| `#bloom-features` | Public | Recorded product decisions, not promises of release | Yes, bounded summary |
| `#bloom-projects` | Private | Active Major Projects from existing CMS | Yes, signed read-only summary |
| `#bloom-tickets` | Private | Support triage and ownership | Notifications only |
| `#bloom-alerts` | Private | Urgent incidents and escalations | Notifications only |
| `#bloom-releases` | Public | GitHub milestones in simple language | Notifications only |
| `#bloom-finance` | Private | Platform payout reporting, not client finances | Notifications only |
| `#bloom-new-clients` | Private | Accepted and onboarding Major Projects | Notifications only |

## Security and authorization

- The Slack event receiver verifies `X-Slack-Signature` against the raw request body using a five-minute timestamp window. Only matching workspace, known channel, `app_mention` event and exact allowlisted Slack user IDs may enqueue a question. Ordinary channel conversation must not be ingested.
- The bot never authorizes changes to funds, accounts, roles, access, mailings, customer records or deployments from a Slack message.
- Github and CMS webhooks use separate signed receivers. Only three company GitHub repositories are accepted. Never include raw PR bodies, email addresses, private customer records, payment information, or proposals in Slack.
- Feature answers use the service-role-only bounded SQL summary function; acceptance or planning does not mean the feature shipped. Project answers use a signed, read-only CMS operations bridge and a narrow field allowlist.
- The Stripe report makes only Account and Payout GET calls, verifies platform account `acct_1QFLpBDmtxsdhOlW`, and keeps CAD and USD separate. Only a Stripe restricted read-only credential may be used in production; account-level provider scopes require a separate provider-side verification.
- The project and feature summary formatter must fail closed when free-text fields contain contact data, external links or credential-shaped strings. The linked authorized product screen remains the detailed source of truth.

## Release-notification policy

Report PR merges as *code merged*, and production deployments as *deployed, not customer verified*. GitHub PR check failures remain visible in GitHub Actions; Slack should alert on failure of a `main` branch check suite with a safe commit-specific link and a stable per-suite event key. Repeat webhook deliveries must not repeat the message. This noise-control policy is delivered by the focused follow-up PR and takes effect only when its production Edge Function is deployed and verified.

Notify humans on production release failures; do not silently hide these events. Include actionable links and avoid technical wording where possible.

## Configuration and verification

Secrets live in provider-side secret storage, never in source, issues, chats, logs or Slack. Relevant CRM Edge secret **names** include:

- `BLOOM_SUPPORT_SLACK_BOT_TOKEN`
- `BLOOM_SUPPORT_SLACK_SIGNING_SECRET`
- `BLOOM_SUPPORT_SLACK_TEAM_ID`
- `BLOOM_SUPPORT_SLACK_STAFF_IDS`
- `BLOOM_SUPPORT_SLACK_CHANNEL_ASK/TICKETS/FEATURES/ALERTS/RELEASES/PROJECTS/CLIENTS/FINANCE`
- `BLOOM_SUPPORT_GITHUB_WEBHOOK_SECRET`
- `BLOOM_SUPPORT_CMS_EVENTS_SECRET`
- `BLOOM_SUPPORT_STRIPE_READONLY_KEY`

CMS production must have the matching CMS signing secret in its server-only environment. Never send staging project updates to production Slack.

For a future production change: obtain independent review, pass the relevant test and security checks, merge normally, deploy only changed Edge Functions, then confirm the **deployed version** and an explicitly marked safe integration-test thread. Check the queue job's final status and Slack message ID; no customer-facing actions or real financial test events.

Outstanding provider-side audits: review the Slack app's actual installed OAuth scopes and event subscriptions, verify Stripe restricted key grants directly, and complete live negative-signature/replay/access tests without customer impact. A historical dead feature-summary job predating the bounded RPC fix must not be blindly retried, because a duplicate Slack answer could result.

## Operating agreements

Bloom Support is the source of truth for tickets and feature decisions. BloomSites Major Projects is the source of truth for projects. Stripe is the source of truth for payouts. A READY deployment or GitHub merge is not proof that a customer's original workflow works.

Slack messages should be short, actionable and nontechnical. Do not post customer contacts in public channels or sensitive records in private channels. Do not upgrade Slack, create recurring Work agents, or use GitHub administrator merge overrides to operate this integration.

Tracking: [CRM issue #415](https://github.com/JonDMorrison/brandsinblooms/issues/415).
