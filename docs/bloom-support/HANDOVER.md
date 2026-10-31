# Bloom Support & Operations — handover

Status date: 2026-10-31. Branch `claude/bloom-support-operations-5l5p10` in all three product repositories.
**Nothing here is deployed or applied to any live database yet.** Everything below was built and verified
locally (disposable Postgres + the real Edge Function code), and is waiting for review, migration rollout
and configuration. Do not describe any part as "live" until the rollout checklist (§6) is done and the
staging walk (§9) has passed.

## 1. What Bloom is

One shared support system for BloomSites (CMS), BloomSuite CRM and BloomSuite POS:

- **Backend:** the BloomSuite CRM Supabase project (`udldmkqwnxhdeztyqcau`), non-exposed schema
  `bloom_support`. All reads and writes go through SECURITY DEFINER functions that take the
  authenticated principal and re-check authority. EXECUTE belongs to `service_role` only. The single
  PostgREST entry point is `public.bloom_support_rpc(fn, args)` (an allow-list), plus `public.bloom_support_ops_rpc`
  for campaign operations.
- **Edge Functions (CRM repo):**
  | Function | Purpose | Auth |
  | --- | --- | --- |
  | `bloom-support-intake` | `/report` (CRM session or signed BloomSites/POS server), `/public` (people who cannot sign in) | JWT / HMAC / rate limit + honeypot |
  | `bloom-support-api` | REST API for the dashboard, ChatGPT Actions and scripts | CRM JWT or `bsk_` API key |
  | `bloom-support-mcp` | MCP server (Streamable HTTP, JSON) for ChatGPT / MCP clients | `bsk_` key in header, or `/k/<key>` path |
  | `bloom-support-email` | Resend `email.received` webhook | Svix signature |
  | `bloom-support-worker` | Background jobs (pg_cron every minute) | internal key (`apikey`) |
- **Dashboard:** CRM `/admin/bloom-support` (queue, escalations, engineering, features, clients,
  operations, settings). Clients see their own requests at `/support`. Public pages: `/support/contact`
  (cannot sign in) and `/support/track/:token` (per-ticket link from emails).
- **Product hooks:** BloomSites `/api/support/report` + `/api/internal/bloom/ops`; POS Edge Functions
  `bloom-support-report` + `bloom-support-ops`; till "Report a problem" with an offline queue.
- **Engineering:** `.github/workflows/bloom-repair.yml` in each repo (coding agent on an isolated branch,
  no merge rights) + the release pipeline in the worker (`_shared/bloom-support/engineering.ts`).

Bloom does not depend on Claude or on any chat being open. Model calls go to an OpenAI-compatible
endpoint (`OPENAI_API_KEY`, `BLOOM_AI_MODEL`, `BLOOM_AI_BASE_URL`); every model feature has a
deterministic fallback, and model output is only ever a recommendation.

## 2. Decisions and assumptions (with evidence)

- **New `bloom_support` schema instead of extending `public.support_tickets`.** That helpdesk is per-tenant
  (`tenant_id NOT NULL`, ticket numbers per tenant, `20251116103908_*.sql`) and has no live entry point:
  `/helpdesk/*` routes have no navigation link, and the live Support page only emailed `send-support-ticket`.
  It is left untouched (no data migrated; it had 2 rows). The alternative not taken was widening it, which
  would have changed live RLS semantics.
- **Backend in the CRM project.** The CRM already hosts Resend, OpenAI, pg_cron/pg_net and the admin
  allowlist. BloomSites and POS are separate Supabase projects, so they reach Bloom with signed
  server-to-server calls. Identity and site/tenant are always derived by the product's server, never by the
  browser.
- **Roles.** Jon becomes `platform_admin` automatically on first CRM sign-in if his address is in
  `app_admin_emails` (`bloom_support_bootstrap_admin` re-checks `is_master_admin`). Every other staff role is
  set explicitly by an administrator.
- **Campaign scheduling across tenants.** `set_campaign_schedule` authorizes by the caller's own tenant, so
  platform staff cannot use it for clients. `bloom_support.campaign_schedule` applies the same state change and
  lock rule, authorized by Bloom (`ops.campaign.send` + the account linked to that tenant). Actual sending
  still goes through `claim_scheduled_campaigns` → `auto-send-campaigns` with all of its gates. Draft
  create/update reuse the `bloom-assist` campaign implementations, with the tenant's owner as campaign owner.
  Bloom's audit records the real actor.
- **BloomSites publish.** `published_promote_v1` needs the user's site membership. The ops endpoint applies
  the same version-guarded update (`content_draft → content`, `published_version = version`). It is called
  only with Bloom's HMAC after Bloom has authorized the person.
- **BloomSites branch.** The designated branch pointed at `main`. CMS Tier A rules require cutting it from
  `dev`, so it was recut from `origin/dev` under the same name (it had no unique commits).
- **Client email is off by default** (`client_email_enabled=false`). Mail is recorded as `suppressed` until an
  administrator turns it on. `BLOOM_SUPPORT_EMAIL_ALLOWLIST` limits delivery to test addresses.
- **Automatic release is off by default** (`auto_release_enabled=false`), and no repository has approved
  paths until Jon sets `release_policy`.

## 3. Statuses and permissions

Client-facing statuses: **New, Working, Waiting, Needs Jon/Jeff (`needs_owner`), Resolved.** The internal
`stage` keeps the detail (triage, needs_info, answering, operating, investigating, fixing, releasing,
verifying, awaiting_client, awaiting_decision, escalated). Automation mode per ticket: `auto` (Bloom acts),
`paused`, `human` (a person took over; Bloom may not message the client — enforced in SQL).

| Role | Who | Highlights |
| --- | --- | --- |
| platform_admin | Jon | everything, including roles, policy (`admin.*`), feature decisions, approving fixes |
| platform_operator | Jeff | every client and product; publish, campaign send, site create, events, POS read; kill switch. No roles/policy/release/repository access |
| support | staff | all tickets/clients, routine edits, POS read. Publish / campaign_send / sensitive / event_manage only as per-person grants |
| client | customers | their own tickets and their verified account's tickets only |
| service | Bloom identities | one scope each: `intake`, `automation`, `operations`, `investigation` (repair), `release` |

The repair identity cannot write release eligibility or merge. Only the release identity can move a fix to
merging/merged/deployed/verified, and only with recorded eligibility or Jon's approval. The SQL contract
test proves each of these.

## 4. What is implemented

- Tickets, threaded conversations (several requests in one conversation are linked automatically),
  accounts with product links (CRM tenant, BloomSites site, POS tenant), attachments (private bucket
  `bloom-support`, signed URLs), categories/priority/impact/owner/next action, public replies and internal
  notes, full-text search and filters, client history, an append-only activity log, links and duplicates
  (a duplicate follows the original's fix), notifications, escalations, and feature requests with
  customer evidence. Clients track tickets in-product or via a signed tracking link.
- Intake everywhere:
  - CRM top-bar help button, `/support` (replaces the Jira collector and the email-only form).
  - BloomSites top-bar button and "Report a Problem" menu (replaces the Jira collector; shadcn dialog).
  - POS back-office support cases (also forwarded) and the till Help → "Report a problem" with an offline
    queue ("Saved on this register" → "Received by Bloom #N", idempotent resend).
  - The public form at `/support/contact`.
  - Email.

  Context is captured automatically and sanitized server-side: URL secrets, tokens, card numbers and
  non-allow-listed fields are removed.
- Email: inbound webhook with Svix verification, dedupe by event, retry-safe failure, autoresponder,
  mailing-list and own-domain loop guards, a per-sender burst limit, threading by
  In-Reply-To/References/`[Bloom #N]`, forwarded-thread handling (the forwarder is never trusted as staff),
  reopening on a reply to a resolved ticket, and attachments. Outbound mail carries Message-ID/In-Reply-To,
  an idempotency key and a tracking link, and is suppressed after human takeover.
- Automation worker: leased jobs, `SKIP LOCKED`, one running job per lane (per account / per engineering
  issue), bounded retries with backoff, dead jobs escalated, lease recovery after crashes, timeouts, a kill
  switch, and per-account usage limits (tickets/day, model calls/day). It handles:
  - triage (rules, plus a model when configured)
  - asking for missing details
  - duplicate detection
  - answers from approved knowledge only (without a model it suggests the article to staff and never sends
    unreviewed text)
  - operation proposals (preview only — a person executes)
  - routing feature requests to Jon
  - escalations to Jon/Jeff
  - verified resolution messages.
- Product operations (preview → execute exactly once → verify → undo where possible):
  - Campaigns: list/read/create draft/update draft/schedule/unschedule.
  - BloomSites: site read, pages, events, page publish, page title/excerpt, event text/status — with undo.
  - POS: audited product lookup.
- Automatic engineering:
  - Repository map by product and sanitized evidence on a GitHub issue.
  - A dispatched repair workflow that reproduces with a new failing test and refuses to touch
    workflows/migrations/auth/payments/policy/existing tests.
  - The workflow reports back with the investigation key.
  - The deterministic release policy (`policy.ts` `evaluateRelease`) checks, among other things:
    - bug only, reproduced, established intended behaviour, single product
    - approved paths, sensitive paths, size limits
    - all required checks green, an independent approving review, no open threads, mergeable
    - production verification and rollback defined
  - Merge pinned to the evaluated SHA, production deployment tracking via GitHub Deployments, HTTPS
    production verification, and escalation on any failure.
  - A ticket resolves only after verification.
  - BloomSites fixes stop at `dev` (staging); production remains Jon's dev → main release.
- MCP server with 31 tools, and a REST API for everything (see §7).

## 5. What is not done or not verified

- **Not deployed anywhere.** No migration has been applied to any live database. No function is deployed.
  No PR is merged.
- **No browser walk was run** (repo rules: browser tests run only on request). The UI is verified by
  type-check, lint and a production `vite build` only.
- **Unverified against live providers:**
  - Resend inbound. Built against the documented `email.received` + Receiving API shape; exercised with
    payloads that include the text inline. The fetch-by-id path has not been called against Resend.
  - GitHub dispatch/merge/deployments: stubbed in tests.
  - The OpenAI model path: not configured in tests, so the rules fallback ran.
  - The repair workflow itself (`codex exec`): never run.
- **BloomSites ops endpoint:** type-checked only. It was not executed against a database.
- **POS:**
  - The migration was not applied locally: it depends on POS schema not reproduced here.
  - The functions were type-checked only.
  - `pos.inventory` and `pos.sales_summary` return 501. Their tables are tenant-JWT-scoped by design, and an
    audited Bloom read for them was not built.
- **Site creation** through Bloom returns 501: the provisioning pipeline is not exposed. Create sites in
  BloomSites admin and link the site on the Bloom account.
- **Fundraising:** no operations beyond what event/page tools cover.
- **Campaign "send now":** use schedule (≥1 minute ahead), which goes through the normal send pipeline.
- **ChatGPT OAuth:** not implemented. Connect with a per-person key in the URL (§7) or via Actions with a
  bearer key.
- **Rollback:** Bloom detects a failed deployment or verification and escalates. It does not call the
  hosting provider's rollback API (no Vercel credential is used).
- **Release policy is self-reported in two places:**
  - The repair workflow writes `intended_behaviour_established` and the production verification URLs. The
    independent review is the guard against a weak report.
  - The repair workflow's guard and the policy both treat any `package.json`/lockfile change as
    review-only.

## 6. Rollout checklist (exact configuration)

### CRM (`udldmkqwnxhdeztyqcau`)

1. Merge the CRM PR after review. Apply, in order, from the merged `main`:
   - `20261031120000_bloom_support_core.sql`
   - `20261031120100_bloom_support_functions.sql`
   - `20261031120200_bloom_support_gateway.sql`
   - `20261031120300_bloom_support_campaign_ops.sql`
2. Edge Function secrets (`supabase secrets set …`):
   - `BLOOM_SUPPORT_INBOX` (the Bloom support address, e.g. `support@bloomsuite.app`), `BLOOM_SUPPORT_FROM` (optional)
   - `BLOOM_SUPPORT_PUBLIC_URL=https://bloomsuite.app`
   - `RESEND_API_KEY` (existing), `RESEND_INBOUND_WEBHOOK_SECRET` (from the Resend webhook)
   - `BLOOM_INTAKE_SECRET_CMS`, `BLOOM_INTAKE_SECRET_POS` (random 32+ bytes each)
   - `BLOOM_OPS_URL_CMS=https://<BloomSites production host>/api/internal/bloom/ops`, `BLOOM_OPS_SECRET_CMS`
   - `BLOOM_OPS_URL_POS=https://aimphmbjuawmxyvkwipf.supabase.co/functions/v1/bloom-support-ops`, `BLOOM_OPS_SECRET_POS`
   - `BLOOM_SERVICE_KEY_INTAKE`, `BLOOM_SERVICE_KEY_AUTOMATION`, `BLOOM_SERVICE_KEY_OPERATIONS`,
     `BLOOM_SERVICE_KEY_INVESTIGATION`, `BLOOM_SERVICE_KEY_RELEASE` (see step 4)
   - `BLOOM_GITHUB_REPAIR_TOKEN`: fine-grained, the three repos; Issues RW, Actions RW, Contents R, Pull requests R
   - `BLOOM_GITHUB_RELEASE_TOKEN`: fine-grained, the three repos; Contents RW, Pull requests RW, Deployments R, Checks R
   - `BLOOM_GITHUB_REPAIR_LOGINS=github-actions[bot]` (authors whose reviews do not count as independent)
   - `OPENAI_API_KEY` (existing), optionally `BLOOM_AI_MODEL`, `BLOOM_AI_BASE_URL`
   - Test mode: `BLOOM_SUPPORT_EMAIL_ALLOWLIST=jon@…,jeff@…`
3. Deploy the functions:
   `supabase functions deploy bloom-support-api bloom-support-intake bloom-support-email bloom-support-worker bloom-support-mcp`
   (the existing deploy workflow does this on merge to `main`).
4. Jon signs in to BloomSuite, then opens `/admin/bloom-support` → Settings: set Jon/Jeff notification
   addresses and roles (Jeff → `platform_operator`; Jeff must sign in once first). Create the five service
   identities and their keys (signed-in session required):
   ```bash
   API=https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/bloom-support-api
   for s in intake automation operations investigation release; do
     ID=$(curl -s -X POST $API/service-identities -H "Authorization: Bearer $JON_JWT" -H 'Content-Type: application/json' -d "{\"name\":\"Bloom $s\",\"scope\":\"$s\"}" | tr -d '"')
     curl -s -X POST $API/keys -H "Authorization: Bearer $JON_JWT" -H 'Content-Type: application/json' -d "{\"principal_id\":\"$ID\",\"label\":\"$s\"}"
   done   # store each returned token as BLOOM_SERVICE_KEY_<SCOPE>
   ```
5. Worker schedule: store the project's secret/service key in Vault, then schedule the worker:
   ```sql
   SELECT vault.create_secret('<sb_secret_… or service role key>', 'bloom_support_worker_key');
   SELECT cron.schedule('bloom-support-worker', '* * * * *', $$
     SELECT net.http_post(url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/bloom-support-worker',
       headers := jsonb_build_object('Content-Type','application/json','apikey',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='bloom_support_worker_key')),
       body := '{"source":"cron"}'::jsonb, timeout_milliseconds := 55000) $$);
   ```
6. Email (no MX changes on existing domains):
   - Enable Resend Receiving on a Resend-provided receiving address or a new dedicated subdomain.
   - Point a forwarding rule from the existing support mailbox (e.g. `support@brandsinblooms.com`) to it.
   - Add the webhook `email.received` → `…/functions/v1/bloom-support-email` and copy its signing secret to
     `RESEND_INBOUND_WEBHOOK_SECRET`.
   - Set `BLOOM_SUPPORT_INBOX` to the address clients should reply to.
7. Turn on `client_email_enabled` only after a test with the allowlist.

### BloomSites (Vercel env)

- `BLOOM_SUPPORT_INTAKE_URL=https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/bloom-support-intake`
- `BLOOM_INTAKE_SECRET_CMS`, `BLOOM_OPS_SECRET_CMS` (same values as the CRM secrets)

### POS (`aimphmbjuawmxyvkwipf`, and `bujqjlcqqpprlolarmjr` for dev)

- Apply `20261031130000_bloom_support_reporter.sql`.
- Deploy `bloom-support-report` and `bloom-support-ops`.
- Secrets: `BLOOM_SUPPORT_INTAKE_URL`, `BLOOM_INTAKE_SECRET_POS`, `BLOOM_OPS_SECRET_POS`.

### GitHub (each of the three repos)

- Secrets:
  - `BLOOM_REPAIR_OPENAI_API_KEY` (the coding agent)
  - `BLOOM_REPAIR_REPORT_KEY` (the *investigation* service key)
- Variable: `BLOOM_SUPPORT_API_URL=https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/bloom-support-api`
- Label `bloom-repair`.
- Branch protection on the base branch: required status checks + 1 required review.
- Never give the repair workflow the release token.

### Release policy (Jon)

Example `PUT /settings/release_policy`:
```json
{"approvedPaths":{"JonDMorrison/brandsinblooms":["src/components/**","src/pages/**"]},
 "requiredChecks":{"JonDMorrison/brandsinblooms":["<exact CI check names>"]}}
```
Then `PUT /settings/auto_release_enabled {"value":true}` when you want it. Sensitive paths are built in and
can only be added to, never removed.

## 7. ChatGPT connection

Each person uses their **own** key. It carries their own role.

1. In BloomSuite: `/admin/bloom-support` → Settings → API keys → "New full key" (or read-only). Copy it once.
2. **ChatGPT MCP connector** (Settings → Connectors → Advanced → Developer mode → Create):
   - URL: `https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/bloom-support-mcp/k/<your bsk_ key>`
   - Authentication: none (the key is in the URL). Treat the URL as a password; revoke the key in Settings if
     it is ever exposed. Clients that support headers should use the base URL with
     `Authorization: Bearer bsk_…`.
3. Or a **Custom GPT Action**: base URL `…/functions/v1/bloom-support-api`, auth "API Key — Bearer".
   Endpoints: `GET /tickets`, `GET /tickets/{id}`, `POST /tickets`, `POST /tickets/{id}/messages`,
   `PATCH /tickets/{id}`, `POST /tickets/{id}/automation`, `POST /tickets/{id}/investigate`,
   `GET /accounts?q=`, `GET /accounts/{id}`, `GET /engineering`, `PATCH /engineering/{id}`,
   `GET /escalations`, `POST /escalations/{id}/resolve`, `GET /features`,
   `POST /features/{id}/decision`, `POST /operations/read`, `POST /operations/preview`,
   `POST /operations/{id}/execute`, `POST /operations/{id}/undo`, `GET /summary`, `GET /health`.

MCP tools:
- Status and setup: whoami, queue_summary, health
- Tickets: list_tickets, get_ticket, create_ticket, reply_to_ticket, update_ticket, take_over_ticket,
  link_tickets, related_tickets
- Clients: find_client, client_history
- Engineering: start_investigation, engineering_status, approve_fix
- Decisions: list_escalations, record_decision, list_feature_requests, decide_feature_request,
  route_feature_request, escalate_ticket
- Product operations: product_operations, read_product, preview_change, execute_change, undo_change,
  verify_outcome
- Automation: automation_switch, list_jobs, retry_or_cancel_job

Background work never depends on ChatGPT: intake, email and the worker run on their own.

## 8. Operating and recovery

- **Pause everything:** Settings → "Bloom automation" off (or MCP `automation_switch false`). Running jobs
  finish; nothing new is claimed. Resume by switching it on.
- **Take over a ticket:** "Take over from Bloom" or a public reply. Bloom then sends nothing to that client.
  "Hand back" re-triages.
- **Failed work:** Settings → Failed automation (or `list_jobs status=failed,dead`) → Retry/Cancel. Dead jobs
  are also escalated.
- **Worker crash or restart:** nothing to do. Expired leases are re-queued on the next minute.
- **Email loop or flood:** inbound is capped at 30 per sender per hour. Turn `client_email_enabled` off to
  stop all client mail immediately.
- **Bad release:**
  1. Bloom marks the issue `failed` and escalates.
  2. Roll back with the hosting provider's instant rollback (Vercel → previous production deployment).
  3. Turn `auto_release_enabled` off.
  4. Decide in Escalations.
- **Revoke access:** Settings → API keys → Revoke, or set the person's role to `client` / inactive.
- **Inspect anything:** every action is in `bloom_support.activity` (append-only), visible in each ticket.

## 9. Validation

Run everything locally (needs a disposable Postgres and Deno):
`PGHOST=… PGPORT=… PGUSER=… scripts/tests/run-bloom-support-tests.sh`. CI runs the same script in
`.github/workflows/bloom-support.yml`.

Results on 2026-10-31 (local, Postgres 16, Deno 2):

1. **SQL contract** (`scripts/tests/bloom-support-db.sql`): **passed**. It covers:
   - privilege boundaries
   - reports from 3 products
   - duplicate delivery
   - cross-client 403s
   - internal-note isolation
   - Jeff's universal authority, and Support opt-ins
   - operations claim-once
   - conversations
   - human takeover
   - lease recovery, bounded retries, lane isolation, the kill switch
   - repair vs release separation, and merged≠resolved
   - verification-required resolution
   - sensitive → Jon, and deployment failure
   - reopening, feature decisions
   - email identity
   - append-only audit
   - tracking links
   - cross-tenant campaign scheduling
2. **Unit tests** (`policy_test.ts`): **12 passed**.
3. **End-to-end** (`e2e_test.ts`, 11 steps): **all passed**. It covers:
   - all-product intake + duplicate delivery
   - cross-client + Support restrictions
   - Jeff via MCP preview/execute/verify/undo
   - worker triage + acknowledgement with threading
   - email reply/duplicate/autoresponder/new sender/takeover
   - interrupted job recovery
   - eligible repair through merge/deploy/verify/resolve/email
   - reopen on "still broken"
   - sensitive repair → Jon → approval → failed deployment escalated
   - kill switch + honest missing-config reporting

   Two real defects were found and fixed by this run:
   - the release identity could not move a fix to awaiting_approval/failed
   - approved fixes were blocked by a missing check list
4. **POS till queue** (vitest): 4 passed. **POS back office** support tests: 62 passed.
5. **CRM UI:** scoped `tsc` clean for changed files, eslint clean, `vite build` passed, CRM vitest 499/501.
   The 2 failures:
   - `campaignSendingDesignRefresh` — pre-existing; fails on the base without these changes
   - the security gate flagged a test fixture — fixed, now passing
6. **BloomSites:** `verify:lint` clean. `verify:types` shows no errors in the new files; one error at
   `DashboardTopBar.tsx:183` is on an unchanged line (`resolveUserDisplayName`).

Staging walk still owed (person-run): CRM `/support` → Get help → ticket appears in `/admin/bloom-support`;
BloomSites dashboard → Get help; till Help → Report a problem offline then online; reply by email to the
acknowledgement; Jeff preview/execute a campaign schedule on a test tenant.
