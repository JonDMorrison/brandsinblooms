# Bloom as the suite operator: record

Started 2026-11-02. This file is the running record for turning Bloom into one AI operator across the
CRM (this repo), BloomSites (`Brands-In-Blooms/cms-brandsinblooms`) and the POS
(`Brands-In-Blooms/bloomtill`). [HANDOVER.md](HANDOVER.md) remains the Bloom Support deployment
record. Every "live" claim below names its evidence. Anything without evidence is listed as not done.

## A. Capability matrix

Legend: **Live** = in production with evidence. **Merged** = on the default branch, not yet proven in
production. **Open PR** = written and tested, waiting on CI. **Not built** = nothing exists yet.

### Chat (Ask Bloom, in the CRM)

| Capability | State | Evidence / where |
| --- | --- | --- |
| CRM reads (customers, products, campaigns, segments, orders, analytics, knowledge) | Live | `bloom-assist/tools/registry.ts`, 54 tools |
| CRM changes with approval (customers, products, campaigns, segments, tags, consent) | Live | executor confirmation gate, `tools/executor.ts` |
| Approval runs the stored change exactly once | Live (#324) | `bloom-assist/action-claims.ts`, table `bloom_action_claims` (applied 2026-11-02 as `20261102172227`) |
| Report a problem / check a request / self-diagnostics | Live (#316, #319) | `tools/implementations/support-tools.ts` |
| Read BloomSites site, pages, events, preview links | Live (#324) | `read_suite_data` → Support `runRead` → CMS ops endpoint |
| Read POS products, stock, sales summary | Live (#324) | same path. CRM→POS reads verified live 2026-11-01 (3 audited `operation.read` rows) |
| Read POS price history | Live (#324, bloomtill #640) | migration `20261102150000` applied alone to POS production; `bloom-support-ops` deployed alone |
| Change website / POS from chat | Not built, on purpose | Changes go through the Support desk preview → confirm → verify flow |
| Durable multi-step plans (resume after crash, cancel) | Open PR (this change) | Each approved step is a `bloom_support.jobs` row (kind `chat_plan_step`, migration `20261104120000_bloom_chat_plan_jobs.sql`); exactly-once via `bloom_action_claims` (`plan:<plan>:<task>`). `task-plan/durable-runner.ts`; Resume / Cancel remaining on the plan card. See F |
| Model budget per tenant (cost cap) | Live (#346), migration `20261104150000` applied 2026-11-04 | Monthly cap per company, default $25 (settings `chat_spend`), per-company override by platform admins only. Every model call reserves its estimated cost first and settles actual tokens after (`bloom-assist/security/spend-cap.ts`; ledger `bloom_support.chat_usage`; total in `bloom_support.usage_counters` bucket `chat-spend:YYYY-MM`). Over the cap Bloom replies with a plain notice and makes no model call. Support desk → Settings → Bloom chat usage. Not metered: image generation and content-writing functions called as tools, knowledge-search embeddings |

### Bloom Support desk (levels A–F)

| Level | State | Evidence |
| --- | --- | --- |
| A Intake (in-app, CMS, POS, email) | Live for CRM/POS; CMS reporting merged to dev/main (#4154, #4186); email inbox not verified | HANDOVER §0 |
| B Knowledge answers | Live, staff-reviewed publication | `bloom_support.knowledge` |
| C Product operations (preview → execute → verify → undo) | Live for CRM campaigns, POS reads, and BloomSites page/event/section/theme changes (all version-guarded, cms #4188 and later) | `_shared/bloom-support/operations.ts` |
| D Engineering repair | Pipeline proven through dispatch, prepare and report-back (#1007 test). A full real repair is not yet proven | HANDOVER, #310/#317 |
| E Escalation | Live | `escalations`, `resolve_escalation` |
| F Verify and follow up | Live jobs; client email disabled | worker `verify_resolution` |

### Products

| Product | Bloom can read | Bloom can change (with approval) | Not available |
| --- | --- | --- | --- |
| CRM | everything above | CRM tools above; campaign drafts and scheduling via Support | campaign **send** from a support message (blocked on purpose) |
| BloomSites | site, pages, events, private preview links | page title/excerpt, publish a page, event fields, new draft site; section content/order/visibility as drafts (`site.section.*`); theme drafts with publish/discard (`site.theme.*`, publish needs ops.site.publish); blog posts as unpublished drafts with a preview link, draft edits and publish (`site.blog.*`, publish needs ops.site.publish); page/post SEO title, description and share image (`site.seo.update`, live on save, needs ops.site.publish) (cms #4230). All with undo except draft-site creation. The Design page tells owners when a theme draft is waiting (cms #4227) Menu drafts with publish/discard (`site.navigation.*`, publish needs ops.site.publish; links only to the site's own published pages or https) and image swaps from the site's own media into the page draft (`site.image.replace`), all with undo (cms #4231) | editing a live post's title/address/image (done in BloomSites) |
| POS | products, stock, sales summary, price history | none from Bloom Support. The POS's own Bloom does reviewed price/details tasks in the back office | refunds, payments, stock adjustments, permissions (excluded by design) |

## B. Architecture

One command contract: the **Bloom Support operations layer** (`_shared/bloom-support/operations.ts` +
`bloom_support.operations`). It already has a stored server-side payload, a person confirming,
exactly-once claim under a row lock with expiry, verification, undo records and an audit trail, and it
reaches CMS and POS through HMAC-signed adapters. Chat calls it instead of building a second path:

```
Ask Bloom (bloom-assist) ──read_suite_data──► runRead ──signed──► CMS /api/internal/bloom/ops
                                                     └─signed──► POS bloom-support-ops
Support desk / MCP / REST ──preview/execute/undo──► same operations layer
```

Identity: the person's CRM session resolves to a Bloom Support principal (`resolve_crm_user`), and the
company Bloom works in resolves to a Support account (`account_for_crm_tenant`). Permissions are checked
in the database (`has_permission`, `get_account`) for every call. The model never supplies the actor,
tenant, account, site or POS business. It can only pick a kind of read and allow-listed filters.

Roles (from `bloom_support.role_permissions`, read 2026-11-02):

| Role | Who | Can | Cannot |
| --- | --- | --- | --- |
| platform_admin | Jon | everything, including approving code and changing roles/policy | |
| platform_operator | Jeff | all client accounts, tickets, site/campaign/event operations, POS reads, start investigations | approve code, release, change roles or policy, sensitive operations |
| support | future support staff | tickets, site edits, campaign drafts, POS reads | publish, send, roles, policy |
| client | client staff | create and read their own tickets | product operations (so chat reads of website/POS are refused with a plain message) |
| service | automation | previews only | executing a change |

## C. Evidence for this round (2026-11-02)

| Change | Repo / PR | Checks run |
| --- | --- | --- |
| Exactly-once chat approvals, stored args only | CRM #324 | vitest `bloomActionClaims` 7/7. `deno check` adds no new errors |
| `read_suite_data` | CRM #324 | vitest `bloomSuiteTools` 7/7 |
| Read-only keys: MCP `tools/call`, views. Remove the undo that could never run | CRM #324 | vitest `bloomSupportScopes` 3/3. `deno check` mcp/api clean |
| `pos.price_history` in CRM | CRM #324 | vitest |
| CMS page/event optimistic guards, delete dead mock design assistant | cms #4188 → dev | 49/49 node tests, verify:types, verify:lint |
| POS report CORS allowlist, `pos.price_history` op + migration | bloomtill #640 | 18/18 security, 15/15 bootstrap, 25/25 vitest. Migration exercised on local Postgres 16 |

Browser walks: not run.

## D. Operations guide

- **Turn things off:** Support desk → Settings → automation switches (`set_setting`). `auto_release_enabled` is on (policy limits CRM-only, ≤6 files, ≤200 lines, Vercel rollback).
- **See what Bloom did:** Support desk → Reports / Activity (`bloom_support.activity`). Chat tool runs are in `bloom_tool_executions`. Approvals are in `bloom_action_claims`.
- **A chat approval says "no longer matches":** the card in the browser differs from what Bloom stored. Ask Bloom again. Nothing ran.
- **A chat read says "no access":** the person's Support role lacks `ops.site.read` / `ops.pos.read`. Clients don't have these.
- **A company says Bloom chat "reached this month's usage limit":** Support desk → Settings → Bloom chat usage shows its month-to-date spend vs limit. A platform admin can raise that company's limit there (or the default). The limit is an internal cost guard, not a charge to the customer, and resets on the 1st (UTC).
- **A chat read says "not connected":** the Support account has no linked site/POS business. Link it in Support → Clients.

## E. Runtime handoff (what still has to happen in production)

1. CRM #324, cms #4188, bloomtill #640 (price history) and the CMS section/theme releases are merged and deployed. Nothing outstanding from that round.
2. **POS report CORS (bloomtill #640):** before deploying `bloom-support-report` to production, set `POS_BACKOFFICE_ORIGIN` (and `POS_TILL_ORIGIN` if the till is on a different origin) on project aimphmbjuawmxyvkwipf. Without them, browser reports get 403. The POS production workflow runs `supabase db push --include-all`; never use it for Bloom rollouts. Deploy single functions and apply single migrations instead.

## F. Blockers and decisions

- **Client access to website/POS data through chat:** clients hold no `ops.*` read permission. Granting it would let CRM staff see POS sales that the POS limits to managers (rank ≥30). That decision is the owner's. It needs a role mapping per product, not a blanket grant. Left closed.
- **Website design edits:** sections and theme are built and live as version-guarded drafts with preview and undo (cms #4192, #4193, #4201, #4227; theme migrations `20261102203000`, `20261103053000` in CMS production). Blog, SEO, navigation and image swaps are the remaining gaps (in progress 2026-11-04).
- **Blog and SEO from Bloom:** the routes need a cookie session. The insert logic would have to be pulled out of `blog-posts/route.ts` first. Not built.
- **Durable chat plans (decided and built):** chat plans now use `bloom_support.jobs` instead of a new runner.
  - **Where state lives:** approving a plan saves it to the message first, then creates one `chat_plan_step` job per approved step holding the exact approved tool call. The plan on the message is saved again after every step, so a crash loses at most the step in flight.
  - **Who runs steps:** the person's own `bloom-assist` request, never the background worker. A step needs the person's session and permissions (several tools use the person's database client), and the worker has no session. `claim_jobs` therefore skips `chat_plan_step`; its lease-expiry sweep still covers them. Running steps in the worker would mean running them without the person's permissions, so it was not done.
  - **Exactly once:** each step takes the `bloom_action_claims` row `plan:<plan_id>:<task_id>` before it runs. On resume, a claim that is `completed` marks the step done without running it. A claim still `executing` means the request died mid-change: the step shows **Not confirmed** ("check the record before asking Bloom again"), its job is dead-lettered and it is never retried automatically. Steps that depend on it are blocked.
  - **Retries:** a tool timeout or execution error counts as transient and is retried in the same request after 2 s, up to 3 attempts (`max_attempts`), then dead-lettered (`fail_job`) and shown as failed ("Bloom tried 3 times"). Validation or permission failures are not retried. **Retry** on a failed step gives it a fresh attempt budget.
  - **Resume:** **Resume** on the plan card (`plan_action: "resume"`) continues the steps still marked approved or running. A step another request is still running returns "Bloom is already running this plan".
  - **Cancel:** **Cancel remaining** (`plan_action: "cancel"`) cancels steps that have not started. A step that is running finishes. A step whose request died is cancelled only if its claim shows it never started.
  - **Permissions:** resume and cancel go through the same checks as approving: signed-in session, tenant from the server, conversation owned by the same person (403 otherwise), and plan steps scoped to that tenant and user in SQL. The gateway `public.bloom_chat_plan_rpc` is service-role only.
  - **Operations:** dead or cancelled chat steps appear in the Support desk job list with scope `chat`. Staff "retry" there only re-queues the step; it still runs only when the person resumes.
  - **Not covered:** Resume and Cancel remaining are on the Bloom page plan card. The Ask Bloom side panel has no card for an approved plan (it has no Retry either), so it has no Resume or Cancel.
- **ChatGPT per-user connection:** OAuth works. Each person still has to connect their own account. No shared key is handed out.
- **CMS Playwright CI job** fails on GitHub's ubuntu-26.04 runner (Playwright 1.57 can't install Chromium). This is not caused by Bloom work, and it affects every CMS PR.
