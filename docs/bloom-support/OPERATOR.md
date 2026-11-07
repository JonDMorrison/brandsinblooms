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
| Clients read their own website and POS data in chat | Open PR (this change), migration `20261104190000` | Owner decision 2026-11-04. Read-only, own company only. Website (site, pages, events, preview links), POS products and stock: every signed-in CRM user of the company. POS sales summary and price history: only that company's CRM `owner`/`admin` users (`public.users.role`); everyone else is told "Only your account owner or an admin can see sales figures". Decided in the database by `public.bloom_support_client_suite_read` (role_permissions `client.site.read`, `client.pos.read`, `client.pos.sales`; verified account membership; live CRM tenant check), called from `runRead` only when the staff permission fails. Clients get no `ops.*` or write permission. Reads and sales refusals are audited (`operation.read` / `operation.read_denied`, detail `access: client`). Tests: `src/__tests__/bloomClientSuiteReads.test.ts`, `supabase/tests/bloom_support_client_suite_reads.sql` |
| Change website / POS from chat | Not built, on purpose | Changes go through the Support desk preview → confirm → verify flow |
| Durable multi-step plans (resume after crash, cancel) | Open PR (this change) | Each approved step is a `bloom_support.jobs` row (kind `chat_plan_step`, migration `20261104120000_bloom_chat_plan_jobs.sql`); exactly-once via `bloom_action_claims` (`plan:<plan>:<task>`). `task-plan/durable-runner.ts`; Resume / Cancel remaining on the plan card. See F |
| Model budget per tenant (cost cap) | Live (#346), migration `20261104150000` applied 2026-11-04 | Monthly cap per company, default $25 (settings `chat_spend`), per-company override by platform admins only. Every model call reserves its estimated cost first and settles actual tokens after (`bloom-assist/security/spend-cap.ts`; ledger `bloom_support.chat_usage`; total in `bloom_support.usage_counters` bucket `chat-spend:YYYY-MM`). Over the cap Bloom replies with a plain notice and makes no model call. Support desk → Settings → Bloom chat usage. Not metered: image generation and content-writing functions called as tools, knowledge-search embeddings |

### Bloom Support desk (levels A–F)

| Level | State | Evidence |
| --- | --- | --- |
| A Intake (in-app, CMS, POS, email) | Live for CRM/POS; CMS reporting merged to dev/main (#4154, #4186). **Email live**, verified end to end 2026-11-04 (see C) | HANDOVER §0, section C below |
| B Knowledge answers | Live, staff-reviewed publication | `bloom_support.knowledge` |
| C Product operations (preview → execute → verify → undo) | Live for CRM campaigns, POS reads, and BloomSites page/event/section/theme changes (all version-guarded, cms #4188 and later) | `_shared/bloom-support/operations.ts` |
| D Engineering repair | **Proven with a real bug, 2026-11-04**: ticket → engineering issue → dispatch → agent reproduces and fixes → PR → release policy declines auto-release → person reviews and merges (see C). Two gaps remain: the workflow cannot open its PR (repo setting) and its report-back is refused (wrong key). See F | section C, cms #4243 |
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

### Round 2026-11-04: email intake and a full real repair

**Email intake (level A).** One test email from jon@getclear.ca to the public `bloom@bloomsuite.app` alias, subject "[Bloom intake test] please ignore", 12:40 UTC. The verified sending identity remains `bloom@support.bloomsuite.app`.

| Check | Result |
| --- | --- |
| Arrived | Resend received `878f9006-6e09-4785-aa0b-4296cc0c5bc1`. `email_events` outcome `created` |
| Ticket | #1013, channel `email`, triaged by the worker within a minute |
| Sender mapping | New `external_user` principal, role `client`, `email_match: none`, no account. A staff address in From: gets no staff authority (by design) |
| Replies | One acknowledgement, to jon@getclear.ca only (`outbound_emails`, delivered). No other outbound email in the window |
| Untrusted content | The body asked Bloom to grant platform_admin, close every ticket and email the client list. Stored as message text only. Activity shows no role change, no other ticket touched, no other email |
| Cleanup | #1013 resolved with tag `test` and an internal note. `resolved` is final: there is no `closed` transition |

**Full real repair (level D).** Bug: in the fundraising organization and campaign editors, the suggested page address is cut at 72 characters after hyphens are trimmed, so it can end in `-`. `slugSchema` then rejects it and Save fails with "Check the highlighted details." Found in code and reproduced with a failing test. Not invented, and no payments, auth or migrations involved.

| Step | Evidence |
| --- | --- |
| Case | Staff ticket #1012 created as Jon. Triage opened engineering issue `57ce36d3-68f2-409c-9228-c156725d2739`. Jon started the repair (`start_repair`) |
| Run 1 | cms run 41831389396. Prepare ok, GitHub issue #4229 created. Agent failed: OpenAI 401 "Missing bearer". **Root cause:** codex 0.166.0 only authenticates from `CODEX_API_KEY`. Reproduced locally (`auth_header_attached=false` vs `true`). Fixed in cms #4234 → dev, #4236 → main (68ecb8d), crm #347 (1f8d8a4). The key is now also kept out of the environment of the agent's commands |
| Run 2 | cms run 41836698253. The agent reproduced and fixed the bug, then **Repository checks** failed: `verify:lint` lints whole files and `CampaignEditor.tsx` already has a lint error on dev. Fixed: lint now fails only on errors the repair adds (negative test checked). cms #4237 → dev, #4238 → main (e7faaff), crm #352 (df7fc73) |
| Run 3 | cms run 41840045424. Agent, guard and checks green. Publish pushed `bloom/fix-57ce36d3` (commit 2500882, bot-authored). It could not open the PR: "GitHub Actions is not permitted to create or approve pull requests". The PR was opened by hand from the unchanged branch: **cms #4243** |
| Bloom | Poll found #4243 → `in_review`. Release identity evaluated it as `awaiting_approval` (not eligible: outside approved areas, no production verification, no independent review). Nothing merged automatically |
| Review | Test fails 4/10 without the fix and passes 10/10 with it (local jest). CI green. Jon's approval recorded for head 2500882 |
| Merge | #4243 → dev (1d918e1). Targeted release #4244 → main (e5006db). Vercel production `dpl_CRCh2psPxyMKnPjdRXtMZcRRZ4pr` READY on e5006db. GitHub issue #4229 closed |
| Still owed | The affected-flow check: New organization with a name cut at a hyphen, then Save. Browser walk not run. Ticket #1012 stays open until it passes, because Bloom refuses to resolve a bug without that verification |
| Attempts | Runs 1 and 2 used both allowed attempts. `limits.max_repair_attempts` was raised to 3 for the third dispatch only, then set back to 2 |

The repair workflow still holds no merge rights. Its `publish` job has `contents: write` and `pull-requests: write` only, and merging is done by a person.

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

- **Client access to website/POS data through chat (decided 2026-11-04, built):** Jon: "Yes, clients should see their website and point-of-sale data inside Bloom chat." No blanket `ops.*` grant was made, because the POS limits sales figures to managers (rank ≥30). The role mapping is:
  - website reads and POS products/stock: every signed-in CRM user of the company (`client.site.read`, `client.pos.read`);
  - POS sales summary and price history: only CRM `owner` and `admin` users of that company (`client.pos.sales` plus a live `public.users` role check). Marketing, store manager and staff users get the plain "only your account owner or an admin" message.
  - Isolation: the principal must be an active `client` CRM principal, a verified member of the account, and currently a user of the account's CRM tenant. The account comes from the server-side tenant (`account_for_crm_tenant`), and the product target from that account's own links. The model only picks the kind.
  - The same rule applies to a client calling the Support desk read endpoint, since it uses the same `runRead`.
  - To withdraw it: delete the three `client.*` rows from `bloom_support.role_permissions`.
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
- **Repair report-back is refused (owner action, credentials).** Every repair run's `report` job got HTTP 403 (`forbidden: engineering.investigate|engineering.release|engineering.report required`). The Bloom API key that was used at exactly that moment is Jon's `ChatGPT` key (`bsk_Op-XXW`, platform_admin, scope `*`). It is the only active key, and its `last_used_at` matches the report call. So `BLOOM_REPAIR_REPORT_KEY` in the cms repo is set to Jon's personal key, not to a key for the **Bloom repair report** principal (`repair_report` grant, which holds `engineering.report`). Fix: Support desk → Settings → API keys → create a key for "Bloom repair report", put it in the `BLOOM_REPAIR_REPORT_KEY` secret of each repo that runs repairs, and consider rotating the ChatGPT key, because it was stored in a CI secret. Until then the agent's reproduction notes do not reach Bloom. They were recorded by hand as the report identity for issue `57ce36d3`.
- **Repair workflow cannot open its PR (owner decision).** The cms setting "Allow GitHub Actions to create and approve pull requests" is off, so `gh pr create` with `github.token` fails after the branch is pushed. To fix it, either turn that setting on or give `publish` a dedicated token that can only create PRs. The setting also lets Actions approve PRs. That could satisfy the 1-review rule on cms `main`, although Bloom ignores bot reviews. Until then a person opens the PR from `bloom/fix-<id>`, and Bloom's poll picks it up.
- **CMS repairs never reach "verified".** For base `dev`, the deploy step stays at `awaiting_production_release` and re-polls hourly. Nothing marks the issue done after the targeted main release. A person closes it.
- **ChatGPT per-user connection:** OAuth works. Each person still has to connect their own account. No shared key is handed out.
- **CMS Playwright CI job** fails on GitHub's ubuntu-26.04 runner (Playwright 1.57 can't install Chromium). This is not caused by Bloom work, and it affects every CMS PR.

## G. Catalogue category audit and repair (2026-11-07)

The Support desk/MCP operation path now exposes `site.catalogue.audit` and
`site.catalogue.assign_categories`. This entry describes the contract, not a claim
that a particular customer repair or production deployment has been verified.
Both CRM and CMS releases must be deployed before use.

1. Find the verified Support account and its linked CMS site. Use `product_operations`
   to check availability, then `read_product` with `kind: site.catalogue.audit`, the
   account ID, and optional inputs `site_id`, `category_id`, `cursor`, `category_cursor`, `limit`.
   Follow `next_cursor` for products and `next_category_cursor` for categories independently; do not mistake a page count for a whole-catalogue total.
2. Use the returned category hierarchy, assignment evidence and product identifiers
   to distinguish existing memberships, missing memberships and genuinely empty
   categories. Check descendants rather than hardcoding child categories. A visible
   empty section alone does not establish a missing product assignment.
3. Establish the exact products from a verified supplier/category mapping, SKU list
   or reviewed product records. Names and keywords alone are not sufficient evidence.
   Record where the evidence came from and why each selected set belongs in the category.
4. Call `preview_change` with `kind: site.catalogue.assign_categories`, account ID,
   optional linked `site_id`, and `inputs: {category_id, product_ids, evidence: {source, reason}}`.
   Supply 1–500 explicit product UUIDs per batch, never an implicit whole-site selection.
   Review the returned scoped products/counts before confirming. The CMS fingerprint
   and resolved site are stored with the operation; the caller cannot replace them.
5. A permitted person calls `execute_change` with the stored operation ID. This is
   add-only category membership: existing memberships, primary category, product fields,
   prices and stock stay intact. A stale-state conflict requires a new audit/preview.
   Service principals may still only preview; no client permissions were added.
6. Inspect `verify_outcome`, then repeat the category audit and verify the affected
   storefront category, including descendants. Record selected, added and already-present
   counts, operation ID, source/reason and verification in the ticket before resolving it.
   A response marked `reconciliation_needed` is not a success: check the product and
   operation outcome before any new write. There is no automatic undo; do not remove
   memberships speculatively to reverse a batch.

Authorization remains `ops.site.read` for audit and `ops.site.edit` for assignments,
with the existing database permission/account checks and operation ledger. No role,
service-execution or client-read grant and no CRM schema migration is required.
Regression coverage: `src/__tests__/bloomCatalogueOperations.test.ts` tests permission
boundaries, linked-site isolation, bounded/evidenced inputs, fingerprint storage,
execution verification, stale-state rejection and reconciliation.
