# BloomSuite CRM — Milestone Generation Prompt

You are generating milestone documents for the **BloomSuite CRM** codebase. The audit context above is your sole source of truth. Do not infer, assume, or supplement with outside knowledge. Every milestone you produce must trace directly to evidence in the audit.

---

## Codebase Identity (CRM)

- **Framework:** React + Vite + React Router (NOT Next.js — no Server Components, no Server Actions)
- **Component Library:** Joy UI exclusively (`@mui/joy`, `src/components/joy/*`) — NEVER shadcn/ui
- **Styling:** Joy tokens + theme values + Tailwind bridge variables — no hardcoded colors
- **Scope Key:** `tenant_id` (NOT `site_id` for app-level scoping)
- **State/Fetching:** TanStack Query + Supabase client
- **Auth:** Supabase Auth with tenant-first scoping (`useTenant`, `useAdmin`, `getUserAssignedTenantId`)
- **Routing:** `src/App.tsx` owns all routes. All pages lazy-loaded. Shells: `DashboardShell`, `SidebarLayout`, `AdminLazyBoundary`
- **Design System Source of Truth:** `src/components/joy/*`, `src/providers/JoyThemeProvider.tsx`, `src/config/joy-theme.ts`, `src/styles/joy-tailwind-bridge.css`
- **Legacy:** `src/components/ui-legacy/*` is legacy-only — never introduce new imports on Joy-based pages

---

## Output Rules

1. **Format:** Each milestone is a separate Markdown document with sections: Objective, Scope, Security Guarantees, Acceptance Criteria
2. **No code snippets** — milestones are behavioral contracts, not implementation guides
3. **No database schema suggestions** — describe what tables/columns/policies must exist, not CREATE TABLE statements
4. **No test file milestones** unless explicitly requested
5. **No documentation milestones** unless explicitly requested
6. **Raw Markdown only** — never rendered, each milestone separately copyable
7. **Milestone count:** Prefer 3 (max 5 for complex features)

---

## Contract-First, Data-Then-UI Structure

### Step 1: Analyze Scope Size

Count the total milestones needed based on the audit. Then decide:

| Total Milestones | Strategy |
|---|---|
| 2–5 | **Linear:** All data milestones first → all UI milestones second |
| 6+ | **Vertical Slices:** Group by feature area, each slice = 1 data milestone + 1 UI milestone |

State your chosen strategy and reasoning before generating milestones.

### Step 2: Generate the Contract Definition

Before any milestones, produce **Section A — Contract Definition** containing:

- **TypeScript interfaces** for all data entities this feature introduces or modifies (written as prose descriptions, not code)
- **Hook signatures** — name, parameters, return shape (data, isLoading, error pattern)
- **Component prop shapes** — what each major component receives and from where
- **Data flow map** — which hook feeds which component, which mutation updates which cache
- **Page structure** — section breakdown of the UI (header, filters, content area, etc.)

This contract is the handshake between Bloom Wonder and Bloom Designer. Both agents reference it. Neither deviates.

### Step 3: Generate Data Milestones — Tagged [BLOOM WONDER]

These milestones cover:
- Database tables, columns, indexes, constraints
- RLS policies (tenant-scoped, with defense-in-depth resolver filtering)
- API routes, Edge Functions, server-side logic
- Hooks, contexts, utility functions, TanStack Query setup
- Mutation flows with explicit cache update strategy (no `window.location.reload()`)
- Integration points (Stripe Connect, Cloudflare R2, Resend, etc.)

Each data milestone's Acceptance Criteria must include: "Hook/route returns data matching the contract interfaces defined in Section A."

### Step 4: Generate UI Milestones — Tagged [BLOOM DESIGNER]

These milestones cover:
- Page layouts using `PageContainer` and Joy shell conventions
- Component implementations consuming the hooks from data milestones
- Skeleton-first loading (immediate skeleton → fetch → fade-in 200-300ms → empty state/error with retry)
- Responsive behavior (mobile-first, breakpoints specified)
- Design system compliance (Joy tokens, no hardcoded colors, `bg-card` on overlays)
- Gradient overlays on text-over-image surfaces
- Loading, empty, and error states

Each UI milestone's Acceptance Criteria must include: "Component consumes hooks defined in Section A — no mock data, no placeholder fetches, no new data abstractions."

---

## Architectural Invariants (Encode In Every Milestone)

### Security — Include in Security Guarantees section of relevant milestones:
- `tenant_id` scoping explicit in every query (RLS is backstop, not substitute)
- `user_id` from `auth.uid()` only, never client input
- Financial records immutable and append-only
- Ownership failures return 403, never 404
- No `example.com` in any generated value
- No service-role behavior in browser code
- No hardcoded Supabase keys

### UI — Include in Acceptance Criteria of UI milestones:
- All overlay surfaces use `bg-card` token
- Gradient overlays (`from-black/80 via-black/50 to-transparent`) on text-over-image
- No `router.refresh()` or `window.location.reload()` after mutations — local state/cache patching only
- Color only for status communication, not decoration
- No colored icon containers, no tinted backgrounds
- Joy loading primitives: `Skeleton`, `CircularProgress`, `LinearProgress`
- No `ui-legacy` imports on Joy-based pages
- Tailwind bridge variables for supplementary styling, Joy tokens as primary

### Routing — Include when milestones add/change pages:
- All pages lazy-loaded (no static imports in `src/App.tsx`)
- Protected tenant routes use `renderProtectedSidebarLazyPage(...)`
- No nested shells (no `SidebarLayout` inside `DashboardShell`)
- Page modules use default exports for `lazyRetry`

### Data — Include in data milestone Acceptance Criteria:
- Extend existing hooks before creating new abstractions
- Keep fetch logic in owning hook/context, not in leaf components
- Preserve TanStack Query cache identity when modifying hooks
- After mutations: invalidate specific query or patch cache — never full page refresh
- Verify columns, defaults, constraints against `src/integrations/supabase/types.ts`

---

## What NOT To Generate

- No code blocks or implementation snippets
- No CREATE TABLE / ALTER TABLE statements
- No component JSX
- No hook implementations
- No test milestones (unless asked)
- No documentation milestones (unless asked)
- No "nice to have" milestones — only what the audit scope requires

---

## Output Structure

```
## Section A — Contract Definition
[Interfaces, hook signatures, prop shapes, data flow map, page structure]

## Milestone 1 — [Title] [BLOOM WONDER]
### Objective
### Scope
### Security Guarantees
### Acceptance Criteria

## Milestone 2 — [Title] [BLOOM WONDER]
...

## Milestone N — [Title] [BLOOM DESIGNER]
### Objective
### Scope
### Security Guarantees
### Acceptance Criteria
...
```

Generate the milestones now based on the audit context above.