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
| Approval runs the stored change exactly once | Open PR #324 | `bloom-assist/action-claims.ts`, table `bloom_action_claims` (applied 2026-11-02 as `20261102172227`) |
| Report a problem / check a request / self-diagnostics | Live (#316, #319) | `tools/implementations/support-tools.ts` |
| Read BloomSites site, pages, events | Open PR #324 | `read_suite_data` → Support `runRead` → CMS ops endpoint |
| Read POS products, stock, sales summary | Open PR #324 | same path. CRM→POS reads verified live 2026-11-01 (3 audited `operation.read` rows) |
| Read POS price history | Open PRs #324 + bloomtill #640 | needs the POS migration and function rollout (see E) |
| Change website / POS from chat | Not built, on purpose | Changes go through the Support desk preview → confirm → verify flow |
| Durable multi-step plans (resume after crash, cancel) | Not built | Plans live in `bloom_messages.block_data`. No resume worker. See F |
| Model budget per tenant (cost cap) | Not built for chat | Rate limits only (`security/rate-limiter.ts`). Support has a daily call budget (`_shared/bloom-support/ai.ts`) |

### Bloom Support desk (levels A–F)

| Level | State | Evidence |
| --- | --- | --- |
| A Intake (in-app, CMS, POS, email) | Live for CRM/POS; CMS reporting merged to dev/main (#4154, #4186); email inbox not verified | HANDOVER §0 |
| B Knowledge answers | Live, staff-reviewed publication | `bloom_support.knowledge` |
| C Product operations (preview → execute → verify → undo) | Live for CRM campaigns and POS reads. CMS page/event writes get version guards in cms #4188 | `_shared/bloom-support/operations.ts` |
| D Engineering repair | Pipeline proven through dispatch, prepare and report-back (#1007 test). A full real repair is not yet proven | HANDOVER, #310/#317 |
| E Escalation | Live | `escalations`, `resolve_escalation` |
| F Verify and follow up | Live jobs; client email disabled | worker `verify_resolution` |

### Products

| Product | Bloom can read | Bloom can change (with approval) | Not available |
| --- | --- | --- | --- |
| CRM | everything above | CRM tools above; campaign drafts and scheduling via Support | campaign **send** from a support message (blocked on purpose) |
| BloomSites | site, pages, events | page title/excerpt, publish a page, event fields, new draft site (all with undo except draft creation) | sections, hero, images, theme, navigation, blog, SEO. No server-side writer exists. See F |
| POS | products, stock, sales summary, price history (pending rollout) | none from Bloom Support. The POS's own Bloom does reviewed price/details tasks in the back office | refunds, payments, stock adjustments, permissions (excluded by design) |

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
- **A chat read says "not connected":** the Support account has no linked site/POS business. Link it in Support → Clients.

## E. Runtime handoff (what still has to happen in production)

1. **CRM #324:** CI, then merge. bloom-assist and the Support functions deploy through `deploy-edge-functions.yml`. The table is already applied.
2. **cms #4188:** merge to `dev` (staging), then a targeted release PR to `main` per the standing rule. Previews made before the deploy have no guard and get "preview again". That is intended.
3. **bloomtill #640:** merge to `main`. Production is **not** deployed by merge. The production workflow runs `supabase db push --include-all`, which can apply unrelated migrations, so it must not be used for this. Targeted rollout instead: apply `20261102150000_bloom_support_price_history.sql` alone, then deploy `bloom-support-ops` alone.
4. **POS report CORS (bloomtill #640):** before deploying `bloom-support-report` to production, set `POS_BACKOFFICE_ORIGIN` (and `POS_TILL_ORIGIN` if the till is on a different origin) on project aimphmbjuawmxyvkwipf. Without them, browser reports get 403. Production has had no function traffic in the last 24 h (logs, 2026-11-02), and the endpoint requires a staff bearer token, so leaving the current version running is low risk.

## F. Blockers and decisions

- **Client access to website/POS data through chat:** clients hold no `ops.*` read permission. Granting it would let CRM staff see POS sales that the POS limits to managers (rank ≥30). That decision is the owner's. It needs a role mapping per product, not a blanket grant. Left closed.
- **Website design edits (hero, sections, images, theme, navigation):** BloomSites has no server-side writer. Every save is browser-side with RLS, theme changes go live with no draft, and there is no revision history (cms inventory, `useContentEditorData.ts`, `theme.ts:768`). A safe Bloom path needs a version-guarded server writer and a theme draft first. Not built.
- **Blog and SEO from Bloom:** the routes need a cookie session. The insert logic would have to be pulled out of `blog-posts/route.ts` first. Not built.
- **Durable chat plans:** no resume or cancel for multi-task plans. Recommended path: move chat plans onto `bloom_support.jobs` (leases, retries, dead letters) instead of a new runner.
- **ChatGPT per-user connection:** OAuth works. Each person still has to connect their own account. No shared key is handed out.
- **CMS Playwright CI job** fails on GitHub's ubuntu-26.04 runner (Playwright 1.57 can't install Chromium). This is not caused by Bloom work, and it affects every CMS PR.
