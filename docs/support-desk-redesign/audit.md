# Support Desk redesign: audit

Audit date: 2026-11-08. Production data read from Supabase project `udldmkqwnxhdeztyqcau`.
Later redesign steps read this file before changing anything.

## Route and shell

- Route: `/admin/bloom-support`, lazy page `src/pages/admin/BloomSupportPage.tsx`, inside the admin shell (`AdminLazyBoundary`).
- Sidebar entry `admin-bloom-support` ("Support desk") in `src/components/navigation/sidebarNavigation.ts`.
- View state lives in the URL: `?view=<view>&ticket=<id>`. Default view is `today`.
- Views: `today`, `queue`, `escalations`, `features`, `clients`, `knowledge`, `reports`, `problems`, `engineering`, `operations`, `readiness`, `settings`.
- Staff check: `bloomSupport.me()`. Roles `client` and `service` see an empty state that points to `/support`.

## Components

| File | Role |
| --- | --- |
| `TodayView.tsx` | Today: headline, search, decision cards, open requests, done today |
| `todayActions.ts` | Pure helpers: `isBloomHandlingTicket`, `groupOpenEscalations`, `recordReviewDecision` |
| `QueueList.tsx`, `TicketDetailPane.tsx`, `TicketConversation.tsx` | Requests list, detail and conversation |
| `BloomRecommends.tsx` | Per-ticket "Bloom recommends" card driven by `liveNextStep` |
| `AdminPanels.tsx` | Escalations, Engineering, Features, Clients, Operations, Settings, Readiness, Problems, Reports |
| `KnowledgePanel.tsx` | Saved answers |

## API actions (edge function `bloom-support-api`)

Every write goes through a `SECURITY DEFINER` SQL function that calls `bloom_support.require_permission`. The browser never decides permission; it only hides buttons.

| Client call | Endpoint | Permission (server) | Side effects |
| --- | --- | --- | --- |
| `summary()` | `GET /summary` -> `queue_summary` | staff read | none |
| `pageTickets(f)` | `GET /tickets?envelope=true` | staff read | none |
| `getTicket(id)` | `GET /tickets/:id` | staff read | none |
| `updateTicket(id, patch)` | `PATCH /tickets/:id` | `tickets.write` | optimistic `version` check; resolving needs `resolution_evidence` |
| `setAutomation(id, mode)` | `POST /tickets/:id/automation` | `tickets.write` | `auto` enqueues a `triage` job (reason `handed_back`); `human`/`paused` cancels queued jobs. Rejects resolved or merged tickets. |
| `addMessage(id, {visibility})` | `POST /tickets/:id/messages` | `tickets.write` | `public` emails the client; `internal` is a staff note. Idempotent by `idempotency_key`. |
| `resolveEscalation(id, decision)` | `POST /escalations/:id/resolve` | `escalations.resolve` | ticket `needs_owner` -> `working` |
| `updateEngineering(id, {status:"approved"})` | `PATCH /engineering/:id` | `engineering.approve` | starts release |
| `updateEngineering(id, {start_repair})` | `PATCH /engineering/:id` | `engineering.dispatch` | starts automatic repair |
| `executeOperation(id)` | `POST /operations/:id/execute` | `tickets.write` + operation permission | changes a client account |
| `decideFeature(id, decision)` | `POST /features/:id/decision` | `features.decide` | client is told |
| `bulk(ids, patch)` | `POST /tickets/bulk` | `tickets.write` | returns `{updated, failed}` |
| `readiness()` | `GET /readiness` | staff read | none |

## Bloom's recommendation engine

`supabase/functions/_shared/bloom-support/next-step.ts` exports `liveNextStep(ticket)`. It is pure and already used by the staff emails and `BloomRecommends`. Actions and who should do them:

| Action | Meaning | Safe for a batch handoff? |
| --- | --- | --- |
| `send-and-solve` | Stored evidence settles the request (fix verified live, or not reproduced). Sends a fixed-template reply and resolves with `resolution_evidence`. | Yes, after review. Real evidence exists. |
| `approve-fix` | Approve a release | No. Release safeguard. Held for a person. |
| `start-repair` | Start automatic repair | No. Needs a person to read the evidence. |
| `confirm-change` | Execute a prepared account change | No. Changes client data. |
| `decide-feature` | Accept, plan or decline | No. Product judgment. |
| `review-reply` | Client wrote after resolution | No. Judgment. |
| `take-over` / `reply` | Person work | Not Bloom work. |

A second safe handoff exists without a recommendation: a person-owned ticket (`automation` = `human` or `paused`) can be returned to Bloom with `setAutomation(id, "auto")`. The server re-runs triage. It is safe only when nothing person-only is pending, so it must be opt-in per ticket.

### Batch decision (for step 4)

No new server endpoint. The batch runs the existing per-ticket endpoints one at a time:

- Every write is already permission-checked and versioned server side.
- `addMessage` is idempotent by key, so a retried send cannot email twice.
- `updateTicket` rejects a stale `version`, so a changed ticket fails instead of being overwritten.
- Each item re-reads the live ticket and re-runs `liveNextStep` just before acting. An item that is no longer eligible is skipped and reported.

### Instructions

- For `send-and-solve`, instructions change the drafted reply. This has real effect.
- For a handback, instructions are saved as an internal note on the ticket. Bloom's triage worker does **not** read internal notes today (`bloom-support-worker/index.ts`, `triage()` reads only the subject and summary or the last client message). The UI must say this plainly.

## Metrics: data sources

| Metric | Source | Real? |
| --- | --- | --- |
| Decisions needing a person | Today's decision list (engineering awaiting approval, features awaiting decision, open escalations, `needs_owner` tickets) | Yes |
| Requests Bloom is handling | `pageTickets({view:"open", automation:"auto"})` filtered by `isBloomHandlingTicket` | Yes |
| Completed today | `pageTickets({view:"recently_resolved", limit:50})` filtered to `resolved_at` today | Yes, client side. Capped at 50 resolved rows; volume is far below that. |
| Bloom running / paused | `summary.automation_enabled`, `readiness.summary.continuous_automation` | Yes |
| Failed automatic steps | `summary.dead_jobs` | Yes |

## Production state at audit time

- Open tickets: 9 (`working` human 4, `working` paused 1, `working` auto 1, `waiting` auto 2, `needs_owner` auto 1).
- Open escalations: 3 (`engineering_escalated` 2, `engineering_start_requested` 1). Acknowledged: 6.
- Engineering issues: `escalated` 3, `open` 2, `closed` 2. None awaiting approval.
- Feature requests: 2 accepted. None awaiting a decision.

## Root causes of the current problems

- Small type: the global Joy theme sets `body-md` and `body-lg` to 14px and `h2` to 18px. Fix inside the Support Desk only, with a scoped type scale on the page root. No global theme change.
- Flat page: every section uses the same outlined `Sheet` with no depth or colour role.
- Tiny counters: the header renders five status chips for every visit.
- Setup table: `ReadinessPanel` renders a six-column table of raw evidence.
- Vague labels: `DecisionCard` buttons read "Do It", "Reject it", "Something else".

## Constraints from the repo

- Joy-first. `PageContainer` for spacing. No new `ui-legacy` imports.
- No user-visible copy may name Jon or Jeff (`bloomSupportAdminWording.test.tsx` scans every file).
- Tests that pin current labels: `bloomSupportAdminWording.test.tsx` (DecisionCard buttons, Today column layout, "Something else" flow).
