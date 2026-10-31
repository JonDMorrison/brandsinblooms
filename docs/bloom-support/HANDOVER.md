# Bloom Support & Operations — handover

Updated 2026-10-31. Branch `claude/bloom-support-operations-5l5p10` in all three product repositories.
PRs: CRM JonDMorrison/brandsinblooms#284 (→ main), BloomSites Brands-In-Blooms/cms-brandsinblooms#4154 (→ dev),
POS Brands-In-Blooms/bloomtill#628 (→ main).

## 0. Status in one table

| Level | Meaning | Where Bloom is |
| --- | --- | --- |
| Implemented | Code exists on the branch | Everything in §3, except the gaps in §9 |
| Tested | Automated tests pass (locally and in CI on the PR) | SQL contract, 12 unit tests, 13-step end-to-end run against both the source and the exact deploy bundles |
| Deployed | Running in production | **Nothing yet.** Production deploys from `main`. The CRM PR is waiting for Jon's merge |
| Configured | Secrets and settings present | Partly automatic on merge (§5). The rest are listed by name in §6 |
| Enabled | Switches on | Automation on by default. Client email off. Automatic release off |
| Live | Seen working in production | Nothing yet. The **Readiness** tab shows the last real success time per capability |

**Why it is not deployed.** Production for the CRM backend moves only through `main`. Deploying by another
route would bypass review of a change that adds migrations and auth surfaces — the same rule Bloom's own
release policy enforces.

The one remaining step is **merging PR #284**. The merge does the rest:
- Vercel deploys the dashboard and the ChatGPT approval page.
- `deploy-edge-functions.yml` deploys the five functions.
- The new `bloom-support-release.yml` applies the five Bloom migrations exactly once, creates the Vault
  worker token and the two pg_cron schedules, and then checks for worker heartbeats.

The function code that will deploy is the code tested here: the end-to-end suite passed against the
single-file bundles too.

## 1. ChatGPT is not the automation

Two separate things, and both are needed:

1. **The background worker** (`bloom-support-worker`) processes every request on its own, every minute,
   whether or not anyone has a chat open. pg_cron triggers it with a token that is generated inside the
   database and lives only in Vault (`bloom_support_worker_token`). Every run writes a heartbeat to
   `bloom_support.worker_runs`.
2. **ChatGPT connections** let Jon and Jeff *operate* Bloom as themselves. Connecting ChatGPT starts no
   background work, and Bloom never relies on it.

Model use:
- The worker calls the **OpenAI API** using the CRM project's `OPENAI_API_KEY` (already used by
  `bloom-assist`). This is billed to that **OpenAI API account. A ChatGPT subscription does not pay for it.**
- Model: `settings.ai.model` (default `gpt-4o-mini`). Change it at runtime in Readiness → "Change model", or
  set `BLOOM_AI_MODEL` as the default.
- To point at another OpenAI-compatible provider, set `BLOOM_AI_BASE_URL`. `BLOOM_AI_PROVIDER=none` forces
  rules-only.
- Budgets: `limits.ai_calls_per_day_total` (1000) and `ai.max_calls_per_account_per_day` (200). Every call is
  logged as `ai.call` with token usage.
- With no key, every model step falls back to deterministic rules, and nothing is sent that a person has not
  approved.

## 2. Connecting Jon and Jeff (separately, permissions enforced server-side)

MCP URL (live after the merge): **`https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/bloom-support-mcp`**

Each person connects with their own identity. The backend checks that person's role on every call: Jeff's
connection cannot approve fixes, decide features, change roles or change policy, and Jon's can.

**Preferred: OAuth.** Do this once per person, on that person's own ChatGPT account:
1. ChatGPT → Settings → Connectors → Advanced → Developer mode → Create connector.
2. URL: the MCP URL above. Authentication: **OAuth**. ChatGPT discovers everything itself:
   - protected-resource metadata at `…/bloom-support-mcp/.well-known/oauth-protected-resource`
   - the authorization server at `…/bloom-support-api/oauth`, with dynamic client registration and PKCE S256
3. ChatGPT opens `https://bloomsuite.app/bloom-support/connect`. Sign in to BloomSuite as yourself, check the
   role shown, choose "Read and act" or "Read only", and press Allow.
4. Access tokens last 1 hour. Refresh tokens rotate on every use and are revoked on reuse. Only staff can
   approve; a client account is refused.

**Fallback: personal key.** Use this if a client cannot do OAuth discovery on a `supabase.co` path.
- BloomSuite → `/admin/bloom-support` → Settings → API keys → New key. The key carries the same role.
- Header: `Authorization: Bearer bsk_…`.
- Or, for clients without header support, the URL `…/bloom-support-mcp/k/bsk_…` with "No authentication".
  That URL is then a password; revoke the key in Settings if it is exposed.

Before connecting:
- Jon becomes `platform_admin` automatically on his first sign-in (he is on `app_admin_emails`).
- Jeff signs in to BloomSuite once. Jon then sets him to `platform_operator` (Settings → People and roles →
  "Add staff by email").
- Jon sets both notification addresses (Settings → Jon/Jeff notification addresses). These drive escalation
  ownership and alerts.

Tools (33):
- Status and setup: readiness, health, whoami, queue_summary
- Tickets: list_tickets, get_ticket, create_ticket, reply_to_ticket, update_ticket, take_over_ticket,
  link_tickets, related_tickets
- Clients: find_client, client_history
- Engineering: start_investigation, engineering_status, approve_fix
- Escalations and decisions: list_escalations, acknowledge_escalation, record_decision, escalate_ticket,
  list_feature_requests, decide_feature_request, route_feature_request
- Product operations: product_operations, read_product, preview_change, execute_change, undo_change,
  verify_outcome
- Automation: automation_switch, list_jobs, retry_or_cancel_job

The REST API at `…/bloom-support-api` has the same capabilities, for Custom GPT Actions (Bearer key).

## 3. Operational requirements and how each is met

| Requirement | How |
| --- | --- |
| Evidence-based resolution | Bloom resolves only with `resolution_evidence`; the database rejects it otherwise. With a fix, the evidence must include a successful production deployment (GitHub Deployments for the merge SHA) and a passing user-flow check (the ordered production checks from the reproduction). Evidence is stored on the ticket. Merged ≠ resolved. BloomSites fixes stop at staging until Jon's dev → main release. A client reply such as "still broken" reopens the ticket |
| Human takeover | A person's public reply, or "Take over", sets `automation='human'`. Bloom's client messages, emails, triage, answers, verification messages and proposals are then blocked in SQL, and queued jobs are cancelled. Only a person can hand the ticket back |
| Restore, rollback, global pause | Operations record undo data. Supported: campaign schedule ↔ draft, BloomSites publish (previous published content and version), page title/excerpt, event text/status. Releases record the serving Vercel deployment before merging; a failed verification triggers Vercel instant rollback when `BLOOM_VERCEL_TOKEN` + `release_policy.vercel` are set, and otherwise escalates with exact instructions. Global pause: `automation_enabled` stops all claiming. `client_email_enabled` and `auto_release_enabled` are separate switches |
| One investigation per bug; private conversations | Duplicates link to the existing engineering issue (automatic on a strong match, or manual "Duplicate of"). Each client keeps their own ticket and conversation; nobody sees another client's. Engineering evidence on GitHub is sanitized, with no client contact data. Each linked ticket gets its own verified resolution message |
| Escalation ownership, deadlines, fallback | Every escalation gets an owner (Jon or Jeff) and a deadline from `settings.sla`. When it is missed, ownership moves to the other person, widens to both, and gets a new deadline; a second miss raises an independent alert. "Take it" acknowledges. Tickets have response deadlines by priority, and an overdue ticket escalates once |
| Budgets, attempts, concurrency | Model calls per day (total and per client). Tickets per client per day. Public form per email/day and per IP/hour. Inbound email per sender/hour. Repair: at most 2 attempts per bug (`max_repair_attempts`) and 2 concurrent repairs (`max_concurrent_repairs`). Jobs: one running per client lane, leases, bounded retries with backoff, dead → escalation |
| Durable intake, independent alerts | Intake writes straight to Postgres. Retries are idempotent (stable keys). The till saves locally and sends when online. BloomSites falls back to emailing the support inbox if Bloom is unreachable. Inbound email is retry-safe. The **watchdog** is pure SQL on pg_cron (every 5 minutes) and works even if every Edge Function is down: worker stopped, queue backlog, dead jobs, email failures and unanswered escalations raise alerts. Alerts are recorded and notified in-app; they are emailed directly through Resend once `bloom_support_alert_resend_key` is in Vault |
| Approved knowledge vs internal | Knowledge articles are `client` or `internal`. Only **approved client** articles are used for answers, and only Jon/Jeff can approve. Without a model, Bloom suggests the article to staff and sends nothing. Internal notes are never shown to clients, sent, or used for answers |
| Clear campaign actions | The preview states the client (account and CRM tenant), audience (segments, all-customers flag, extra customers, projected recipients), content (channel, subject, preheader, sender, excerpt) and timing (UTC, local time and timezone). Execution refuses if audience or content changed since the preview (fingerprint check in SQL), if there is no audience, subject or content, or if the time is under 1 minute away. Only a person can execute a schedule; Bloom only prepares the preview |
| Honest readiness | `GET /readiness`, the MCP `readiness` tool, and the dashboard Readiness tab: implemented / configured (missing items named) / tested (which test) / enabled / live (last real success) per capability, plus worker heartbeats and recent alerts |

## 4. Architecture (unchanged in shape)

- Backend: the CRM Supabase project, schema `bloom_support`. Service-role-only definer functions; gateways
  `public.bloom_support_rpc` and `public.bloom_support_ops_rpc`.
- Functions:
  - `bloom-support-intake`, `bloom-support-api` (includes OAuth), `bloom-support-mcp`
  - `bloom-support-email` (Resend inbound)
  - `bloom-support-worker` (pg_cron)
- Bloom's own service identities (intake, automation, operations, investigation, release) are resolved inside
  the database: one principal per scope, no shared admin credential, and no key to configure for server code.
  External callers, such as the GitHub repair workflow, use an API key for the investigation identity.
- Product hooks: BloomSites `/api/support/report` (with email fallback) and `/api/internal/bloom/ops`; POS
  `bloom-support-report` and `bloom-support-ops`; the till offline queue.

## 5. What happens automatically on merge (CRM PR #284)

1. Vercel deploys the dashboard (`/admin/bloom-support`), `/support`, `/support/contact`,
   `/support/track/:token` and `/bloom-support/connect`.
2. `deploy-edge-functions.yml` deploys the 5 functions (`verify_jwt=false` in `config.toml`; each function
   authenticates its own callers).
3. `bloom-support-release.yml` applies, in order and once each:
   `20261031120000_bloom_support_core`, `…120100_functions`, `…120200_gateway`, `…120300_campaign_ops`,
   `…140000_operations_hardening`.
   It records them under their file versions in migration history, creates the Vault worker token, schedules
   `bloom-support-worker` (every minute) and `bloom-support-watchdog` (every 5 minutes), and waits for a
   worker heartbeat. If any of that fails it opens an issue.
   *This workflow has not run yet. It depends on the existing `SUPABASE_ACCESS_TOKEN` being allowed to use the
   Management API query endpoint.*

## 6. Exact configuration still needed (by name)

CRM Edge Function secrets (`supabase secrets set …`, or Dashboard → Edge Functions → Secrets):

| Secret | Needed for | Required? |
| --- | --- | --- |
| `OPENAI_API_KEY` | model (already set for `bloom-assist`; confirm in Readiness) | for model features |
| `RESEND_API_KEY` | email (already used by CRM functions) | for email |
| `BLOOM_SUPPORT_INBOX` | the address clients reply to | for email |
| `BLOOM_SUPPORT_FROM` | sender display (optional) | no |
| `BLOOM_SUPPORT_PUBLIC_URL` | links (default `https://bloomsuite.app`) | no |
| `RESEND_INBOUND_WEBHOOK_SECRET` | inbound email webhook | for email intake |
| `BLOOM_INTAKE_SECRET_CMS`, `BLOOM_INTAKE_SECRET_POS` | signed product intake | for BloomSites/POS intake |
| `BLOOM_OPS_URL_CMS`, `BLOOM_OPS_SECRET_CMS` | BloomSites operations | for site ops |
| `BLOOM_OPS_URL_POS`, `BLOOM_OPS_SECRET_POS` | POS reads | for POS ops |
| `BLOOM_GITHUB_REPAIR_TOKEN` | issues + dispatch (Issues RW, Actions RW, Contents R, PR R) | for repair |
| `BLOOM_GITHUB_RELEASE_TOKEN` | merge + deployments (Contents RW, PR RW, Deployments R, Checks R) | for release |
| `BLOOM_GITHUB_REPAIR_LOGINS` | bot logins whose reviews do not count as independent | for release |
| `BLOOM_VERCEL_TOKEN` | automatic rollback | for rollback |
| `BLOOM_AI_MODEL`, `BLOOM_AI_BASE_URL`, `BLOOM_AI_PROVIDER` | model defaults | no |
| `BLOOM_SUPPORT_EMAIL_ALLOWLIST` | test mode: only these addresses receive client email | testing only |

CRM Vault (SQL editor): `select vault.create_secret('<Resend API key>', 'bloom_support_alert_resend_key');`
lets the watchdog email alerts without any Edge Function.

Bloom settings (dashboard → Settings / Readiness, or `PUT /settings/:key`):
- `owners` (Jon's and Jeff's emails)
- `release_policy`, for example:
  `{"approvedPaths":{"JonDMorrison/brandsinblooms":["src/components/**"]},"requiredChecks":{"JonDMorrison/brandsinblooms":["<CI check names>"]},"vercel":{"JonDMorrison/brandsinblooms":{"projectId":"prj_…","teamId":"team_…"}}}`
- `auto_release_enabled`
- `client_email_enabled` (test with the allowlist first)
- approved client knowledge articles

BloomSites (Vercel env):
- `BLOOM_SUPPORT_INTAKE_URL=https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/bloom-support-intake`
- `BLOOM_INTAKE_SECRET_CMS`, `BLOOM_OPS_SECRET_CMS` (the same values as in the CRM)
- Existing `RESEND_API_KEY` and `RESEND_FROM_EMAIL` for the email fallback
- `BLOOM_SUPPORT_FALLBACK_EMAIL` (optional)

POS projects:
- Apply `20261031130000_bloom_support_reporter.sql`.
- Deploy `bloom-support-report` and `bloom-support-ops`.
- Secrets `BLOOM_SUPPORT_INTAKE_URL`, `BLOOM_INTAKE_SECRET_POS`, `BLOOM_OPS_SECRET_POS`.

Each GitHub repo:
- Secrets: `BLOOM_REPAIR_OPENAI_API_KEY` (OpenAI API billing) and `BLOOM_REPAIR_REPORT_KEY` (an API key for
  the investigation identity: Settings → API keys → principal "Bloom investigation").
- Variable: `BLOOM_SUPPORT_API_URL`.
- Label `bloom-repair`.
- Branch protection with required checks and 1 review.

Email: use a Resend receiving address on a new subdomain or a Resend-provided address (no MX changes on
existing domains). Forward the current support mailbox to it, and add the `email.received` webhook →
`…/functions/v1/bloom-support-email`.

## 7. Verification still owed after merge (person-run, ~10 minutes)

1. The `bloom-support-release` run is green, and Readiness shows "Continuous automation: running".
2. Jon: connect ChatGPT by OAuth, then call `readiness` and `whoami` (role `platform_admin`).
3. Jeff: connect ChatGPT by OAuth on his own account. `whoami` returns `platform_operator`, and
   `decide_feature_request` is refused.
4. CRM `/support` → Get help, then confirm the ticket appears in `/admin/bloom-support` and is triaged within
   a minute with no chat open.
5. With `BLOOM_SUPPORT_EMAIL_ALLOWLIST` set to your own address and client email on, reply to the
   acknowledgement and confirm it threads onto the ticket.
6. Preview a campaign schedule on a test tenant. Check the client, audience, content and timing shown;
   execute; then undo.

## 8. Operating and recovery

- **Pause everything:** Settings → Bloom automation off, or MCP `automation_switch false`. The watchdog stops
  worker alerts while automation is paused.
- **Stop all client email:** turn `client_email_enabled` off.
- **Take over a ticket:** "Take over from Bloom" or reply publicly. To return it, use "Hand back".
- **Failed jobs:** Settings → Failed automation → Retry/Cancel. Dead jobs escalate automatically.
- **Worker down** (alert `worker_not_running`):
  - check `select * from cron.job where jobname like 'bloom-support-%'`
  - check `select status_code, content from net._http_response order by created desc limit 5`
  - redeploy `bloom-support-worker`
  - jobs resume from where they were, because leases expire and are re-queued
- **Bad release:**
  1. Bloom rolls back when Vercel is configured; otherwise use Vercel → Deployments → previous production →
     Instant Rollback.
  2. Turn `auto_release_enabled` off.
  3. Decide in Escalations.
- **Restore a product change:** Operations → open the operation → Undo, or MCP `undo_change`.
- **Revoke access:** Settings → API keys → Revoke (this also covers OAuth access tokens), or change the
  person's role.
- **Audit:** `bloom_support.activity` is append-only and shown on every ticket. `bloom_support.alerts` lists
  watchdog findings.

## 9. Gaps (honest list)

- Production deployment waits on the merge. Nothing is live today.
- `bloom-support-release.yml` has never run. If the access token cannot use the Management API query
  endpoint, apply the five files with the Supabase SQL editor or MCP, in order.
- OAuth discovery under a `supabase.co/functions/v1/…` path is implemented to the MCP spec and covered
  end-to-end in tests. It is **untested with ChatGPT itself**. If ChatGPT insists on root-level
  `/.well-known` discovery, put the functions behind a custom domain, or use the personal-key fallback.
- Checked only against stubs: Resend inbound, GitHub, the OpenAI model path, Vercel rollback.
- The repair workflow (`codex exec`) has never run.
- Vercel rollback is not covered by an automated test.
- BloomSites operations endpoint and POS functions/migration: type-checked only.
- Not available yet:
  - site creation
  - POS inventory and sales summaries
  - campaign "send now" (use schedule ≥1 minute ahead)
  - fundraising-specific operations
- The repair agent self-reports reproduction and verification URLs; the independent review is the check on
  that.
- No browser walk was run.
- BloomSites: one pre-existing type error on an unchanged line (`DashboardTopBar.tsx:183`).
- CRM: one pre-existing vitest failure (`campaignSendingDesignRefresh`).

## 10. Tests

Run them with `scripts/tests/run-bloom-support-tests.sh`; CI runs them on the PR
(`.github/workflows/bloom-support.yml`). Deploy bundles: `node scripts/bloom-support/bundle-functions.mjs`,
then `BLOOM_E2E_BUNDLE_DIR=… deno test -A …/e2e_test.ts`.

Results 2026-10-31 (local, Postgres 16, Deno 2):

- SQL contract: passed. On top of the earlier coverage, it adds:
  - evidence-required resolution
  - campaign fingerprint, no-audience refusal, preview contents
  - service identities
  - escalation owner, deadline, fallback, second-miss alert, acknowledge
  - overdue tickets
  - watchdog with and without a heartbeat
  - knowledge audience
  - OAuth staff-only, single-use codes, rotating refresh
  - readiness facts
- Unit: 12/12.
- End-to-end: 13/13 steps against source **and** against the deploy bundles. On top of the earlier flows, it
  adds:
  - the campaign preview showing client/audience/content/timing, and a stale preview refused
  - worker heartbeat; wrong or no worker token refused
  - readiness honesty
  - escalation acknowledgement and Support refused
  - full OAuth: register → BloomSuite approval (client refused) → PKCE → MCP as Jeff → Jon-only action
    refused → refresh rotation and reuse refused
- POS: till queue 4/4, back-office support 62/62. CRM `vite build` passes; scoped tsc and eslint clean.
  BloomSites `verify:lint` clean.
