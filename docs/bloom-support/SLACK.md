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

- The Slack event receiver verifies `X-Slack-Signature` against the raw request body using a five-minute timestamp window. Only matching workspace, known channel and exact allowlisted Slack user IDs may enqueue a question. A signed `app_mention` can start a conversation; a normal `message` can only continue a durable known thread. Ordinary channel conversation must not be ingested.
- The bot never authorizes changes to funds, accounts, roles, access, mailings, customer records or deployments from a Slack message.
- Github and CMS webhooks use separate signed receivers. Only three company GitHub repositories are accepted. Never include raw PR bodies, email addresses, private customer records, payment information, or proposals in Slack.
- Feature answers use the service-role-only bounded SQL summary function; acceptance or planning does not mean the feature shipped. Project answers use a signed, read-only CMS operations bridge and a narrow field allowlist.
- The Stripe report makes only Account and Payout GET calls, verifies platform account `acct_1QFLpBDmtxsdhOlW`, and keeps CAD and USD separate. Only a Stripe restricted read-only credential may be used in production; account-level provider scopes require a separate provider-side verification.
- The project and feature summary formatter must fail closed when free-text fields contain contact data, external links or credential-shaped strings. The linked authorized product screen remains the detailed source of truth.

## Release-notification policy

Only announce GitHub pull requests in #bloom-releases when they actually **merge into `main`** and Bloom can select a vetted, relevant category. Do **not** post about dev-branch merges, closed proposals, unclassified PRs, or changes with no safe nontechnical summary. A missing description is grounds for silence, not a generic “update behind the scenes” message. Never copy untrusted titles or descriptions into public Slack. Existing unclassified jobs are also skipped by the Slack sender to avoid delayed filler messages.

A qualifying merge announcement says **code merged, not yet proven live** in a few lines. Production deployment remains **deployed, not customer verified**. GitHub PR check failures remain visible in GitHub Actions; only failed `main` branch checks and production deployment failures generate actionable Slack alerts. Repeat webhook deliveries must not repeat the message. Use Bloom Support ticket evidence to report actual customer verification, and do not imply a fix is working from GitHub alone.

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


## Major Project welcome invitations from Slack

In the existing private `#bloom-projects` channel, staff may mention Bloom:

> @Bloom send the welcome invitation for Triple Tree

The signed Slack event ingress verifies the workspace, channel and allowlisted staff user ID. The existing Bloom Support worker re-verifies that person's platform-staff identity and calls the signed, **read-only** BloomSites Major Projects lookup. It accepts only one valid project name or code; missing, ambiguous and bulk requests cannot select a recipient. No new Slack app, bot permissions, background agent or scheduler is needed.

Bloom replies in the original thread with a **Review & send invitation** link to the authenticated BloomSites route. The link is not a bearer token or authorization: the CMS must verify the current staff login, exact project, recipient and authorized account-creator role before the separate email-send action. Nothing is emailed merely by mentioning Bloom or opening the link. The invitation uses the standard BloomSuite-branded welcome email and its existing delivery records.

Do not paste recipient emails, API keys or banking information into Slack. If the client has no verified owner address or linked website, correct the Major Project first. A successful Slack reply is evidence of a read-only handoff, **not** email delivery or client activation.

## Staff conversations and visible progress (November 12 change)

The eight existing Bloom channels accept signed staff mentions. Alerts, finance,
releases and new-client channels no longer silently discard them; an unbound
question in tickets receives guidance instead of guessing a customer ticket.
A user can continue their own known Bloom thread without another mention when
Slack delivers `message.channels` (public) or `message.groups` (private) events.
**These subscriptions and their history scopes require explicit workspace-owner
approval and app reinstallation. Deploying code alone does not enable them.**
Unrelated messages, edits/deletes, bot messages, unknown channels and unknown
threads remain ignored. No arbitrary channel history is fetched. Each answer
uses at most six previous turns from the same staff user and exact thread.

The signed receiver wakes the existing worker after durable enqueue. The worker
posts “I’m checking this now…” and updates that one message to its answer. The
one-minute cron remains a recovery fallback, not a second polling system. A
lost Slack post receipt is marked uncertain and is not blindly posted again.
Queue retries reuse saved message receipts. A failed evidence lookup produces a
plain explanation, never a claim of a fix or a forever-running animation.

Chat is read-only: it cannot close tickets, approve features, email customers,
change access, publish or transfer money. Existing authorized product controls
remain the action boundary. A Stripe bank payout is not a commission payment.
Public answers use only approved public help or bounded feature summaries;
private ticket data requires the exact durable ticket thread and a freshly
verified staff principal. Answers use the existing bounded model budget, with
a deterministic fallback on timeout, insufficient evidence or unsafe output.

Verification must include a real mention and unmentioned follow-up in a
clearly marked staff test thread, plus negative tests for other users, unknown
threads, duplicate delivery and stale access. Never call a deployment alone a
verified conversation test.
