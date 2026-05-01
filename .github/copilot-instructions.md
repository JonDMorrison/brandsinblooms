## BloomSuite Copilot Instructions

These instructions are authoritative for this repository. Follow them exactly.
Do not import habits from other BloomSuite apps when the live code here says otherwise.

## 0. Investigation-First Protocol

NEVER guess. NEVER assume. ALWAYS investigate before editing.

Before any code change:

1. Start from a concrete anchor: the target file, failing route, failing test, failing command, failing component, or failing hook.
2. Read the entire file you plan to edit, not just the visible error region.
3. Read at least one owning contract file before editing:
   - a related hook, utility, or context for UI/data-flow work
   - `src/integrations/supabase/types.ts` and the relevant migration for schema work
   - `src/App.tsx` and the relevant layout or boundary file for routing work
4. Trace the real data flow end to end before changing names, props, payloads, or query behavior.
5. Search all usages before changing any exported type, prop, route path, query key, table name, or helper signature.
6. State the root cause and change set to yourself before writing code.
7. Fix the root cause, not the symptom. Do not paper over broken state with fallback values, `as any`, or `@ts-ignore`.

Minimum investigation rules:

- Bug fix: read the broken file, the file providing the data, and the contract being violated.
- UI redesign: read the page/component being changed, a live reference component that already matches the target surface, and the hook/context feeding the UI.
- Database change: read the generated types, the relevant migration, and every caller that reads or writes the affected field.
- Route change: read `src/App.tsx`, the target page module, and the owning shell or boundary component.

Never do these:

- “Let me try this and see.”
- Copy a pattern from another repo without verifying it exists here.
- Use `site_id` because another app did. This repo is tenant-first.
- Add a new abstraction before checking whether the repo already has one.
- Change one consumer and leave the rest for later when the contract is shared.

## 1. Current App Mental Model

This repository is a Vite + React + TypeScript application with React Router, Supabase, TanStack Query, Joy UI, and a Tailwind bridge layer.

Critical facts:

- This is not a Next.js App Router repository.
- There are no React Server Components or Next.js Server Actions here.
- Route ownership and suspense boundaries live in `src/App.tsx`.
- The dashboard shell is built around `DashboardShell` plus route-specific lazy boundaries.
- Multi-tenant scoping uses `tenant_id`, with some user-scoped fallback flows when `tenant_id` is absent.
- Joy is the current design-system source of truth for dashboard/admin surfaces.

Do not introduce guidance, code, or abstractions that assume Next.js, `site_id`, server actions, or a shadcn-first dashboard architecture.

## 2. Tooling Order

Prefer MCP tools first whenever they can complete the task safely and directly.

Rules:

- For database inspection, queries, migrations, advisors, and Edge Function management, use Supabase MCP before terminal commands or manual code inspection when the MCP tool supports the task.
- For git, PR, issue, and review operations, use GitKraken/GitLens MCP before raw git CLI when the MCP tool supports the task.
- Use terminal or other tools only when MCP does not support the task, fails, or would be less safe.
- If falling back from MCP, state briefly why MCP was not used.
- Do not use database dump commands unless explicitly requested.

## 3. Design System Source Of Truth

Treat these files as authoritative for dashboard/admin UI work:

- `src/components/joy/*`
- `src/providers/JoyThemeProvider.tsx`
- `src/config/joy-theme.ts`
- `src/styles/joy-tailwind-bridge.css`

Rules:

- Prefer Joy wrappers from `src/components/joy/*` or `@mui/joy` primitives for admin and dashboard work.
- Use `PageContainer` for page-level spacing. Default to contained width and switch to `fullWidth` only for data-dense admin or reporting screens.
- When composing Joy `sx` values, prefer existing helpers such as `mergeSx` instead of hand-rolled merge patterns.
- Use Joy loading primitives such as `Skeleton`, `CircularProgress`, and `LinearProgress` on Joy-based pages instead of legacy skeletons or custom spinners.
- `src/components/ui-legacy/*` is legacy-only. Use it only when touching an existing legacy surface that has not yet been migrated.
- Do not introduce new `ui-legacy` imports on pages already living inside the current dashboard shell unless there is no Joy equivalent and the usage is temporary.
- Do not reintroduce references to deleted `src/components/ui/*` imports or `src/styles/design-system.css`.

Styling rules:

- Prefer Joy tokens, theme values, and the existing Tailwind bridge variables over hard-coded colors.
- Keep floating surfaces visually solid and readable; do not rely on transparent overlays as the main surface treatment.
- Reuse existing BloomSuite visual language before inventing new primitives or token systems.

## 4. Routing, Shells, And Lazy Loading

Routing in this repository is strict. Follow the existing ownership model in `src/App.tsx`.

Rules:

- All page components must remain lazy-loaded. Do not add static page imports in `src/App.tsx`.
- Prefer default exports for new page modules under `src/pages/` so they can use `lazyRetry`.
- Use `lazyNamed` only when the module already exports a named page component.
- Prefer direct file imports over barrel imports for lazy page modules.

Boundary and shell rules:

- Protected tenant routes that belong in the classic tenant shell should use `renderProtectedSidebarLazyPage(...)`.
- `/admin/*` children belong under the admin shell and `AdminLazyBoundary`.
- Shell-managed `/integrations/*` pages already render inside `DashboardShell`. Do not wrap them in `SidebarLayout` and do not add nested shells.
- Public routes belong under `PublicLazyBoundary` where applicable.
- OAuth and provider callback routes belong under `CallbackLazyBoundary` where applicable.
- Keep layout shells, route guards, and provider wrappers static. They own the suspense boundaries.

When changing routes:

- Keep dashboard route titles and content-width rules in `src/components/navigation/sidebarNavigation.ts` aligned with the route change.
- Do not move a page out of its current shell model unless you have verified all affected routes, titles, navigation, and boundaries.

## 5. Tenant And Auth Boundaries

This application is tenant-first. The primary scope is `tenant_id`, not `site_id`.

Rules:

- Default to `tenant_id` for app data scoping unless the table or external payload is explicitly user-scoped or uses another documented key.
- For tenant-aware UI, prefer existing sources of truth such as `useTenant`, `useAdmin`, `getUserAssignedTenantId`, and `resolveTenantMutationContext`.
- For queries that support tenant-or-user scope fallback, use existing helpers in `src/utils/tenantScope.ts` instead of inventing new filter logic.
- Treat RLS as a backstop, not a substitute for explicit query scoping.
- Before any write, verify required columns, defaults, constraints, and enum/check behavior in `src/integrations/supabase/types.ts` and the relevant migration.
- Do not hardcode anon or publishable keys. Use `src/integrations/supabase/config.ts`.
- Do not put service-role behavior in browser code.

Auth flow rules:

- Preserve the callback behavior in `src/integrations/supabase/client.ts`. Provider-managed callback routes under `/auth/callback` and `/integrations/*` must not be treated as generic Supabase auth callback routes.
- When changing Playwright auth flows, use the live selectors `#signin-email` and `#signin-password`.
- Prefer deterministic onboarding completion for test users by updating profile state instead of driving brittle onboarding UI, unless the onboarding UI itself is the subject under test.

## 6. Data Fetching And Mutation Rules

Follow the existing data-flow patterns already present in the app.

Rules:

- Prefer extending an existing hook, query, or utility before creating a new fetch abstraction.
- Keep fetch logic in the owning hook, context, or page-level container. Do not hide new Supabase access deep inside presentational leaf components.
- Reuse existing TanStack Query cache patterns when a surface already uses React Query.
- Preserve query scoping and cache identity when modifying hooks.
- Do not bypass an existing React Query flow with ad hoc local fetch state unless the surrounding surface already follows that pattern.
- For mutation flows, update local state or query cache deliberately instead of forcing full page refreshes.
- Preserve or extend the surrounding surface's user-visible success/error feedback instead of silently mutating state.

Never do these for normal save flows:

- `window.location.reload()`
- “refresh by navigation” as a substitute for fixing state or cache updates
- ad hoc payload shapes that were not validated against the generated Supabase types and callers

Exception:

- Existing auth reset and logout flows may intentionally redirect with `window.location.href`. Do not generalize that auth-specific pattern to normal CRUD behavior.

## 7. UI Composition Rules

Before creating a new wrapper, check whether the repo already has one.

Prefer the existing surfaces and helpers first:

- `src/components/joy/*` for dashboard/admin UI primitives
- `PageContainer` for page width and spacing
- `DashboardShell` and `SidebarLayout` for shell ownership
- `ChunkErrorBoundary`, `PageSkeleton`, and `PublicPageFallback` for route-level loading and error handling

Rules:

- Keep page-level spacing and structure consistent with the current dashboard shell.
- Do not add nested shells or duplicate page chrome.
- Keep admin/integrations pages inside the shell that already owns them.
- When redesigning a surface, follow a live BloomSuite reference component from the same shell or feature area before inventing a new layout language.

## 8. TypeScript And Safety Rules

Rules:

- Do not use `any`.
- Do not use `@ts-ignore` to force a change through.
- Prefer generated Supabase types and existing domain types over hand-written approximations.
- If a type seems wrong, investigate the caller, schema, and transformation path before widening it.
- Keep public contracts precise. If you change a shared type or helper, update every affected consumer in the same change.

## 9. Testing And Verification Expectations

Verification is part of the work, not optional cleanup.

Rules:

- After editing, run the narrowest validation that can falsify the change: targeted test, typecheck, lint, or other focused verification.
- Prefer route-, hook-, or feature-scoped checks over broad full-repo runs when a narrow check exists.
- If a behavior already has a nearby test, update or run it before widening scope.
- Do not claim a fix is complete without at least one post-edit validation step when the environment supports it.

Generation rules:

- Do not generate documentation unless explicitly requested.
- Do not generate new test files unless explicitly requested.

## 10. Absolute Prohibitions

Do not do any of the following:

- Guess at schema, route ownership, tenant scope, or auth behavior.
- Import Next.js patterns into this Vite/React Router repository.
- Use `site_id` for core application scoping unless the existing code or external contract explicitly requires it.
- Add static page imports in `src/App.tsx`.
- Add nested `SidebarLayout` or `DashboardShell` wrappers on routes that already live inside a shell.
- Introduce new `ui-legacy` usage on Joy-based dashboard/admin pages without a verified temporary need.
- Hardcode Supabase keys or fallback anon keys.
- Bypass tenant scoping because “RLS will handle it.”
- Reintroduce deleted design-system imports or files.
- Use `as any`, `@ts-ignore`, or trial-and-error edits in place of investigation.

## 11. Pre-Submit Checklist

Before finishing, verify:

- The root cause was identified from real code, not inferred from another app.
- The change matches this repo's actual shell, route, and lazy-loading model.
- Tenant scoping is explicit and correct.
- Design-system choices follow Joy-first rules for current dashboard/admin surfaces.
- Existing helpers and hooks were reused where appropriate instead of duplicated.
- Validation was run for the touched slice.
