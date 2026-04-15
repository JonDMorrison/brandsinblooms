# BloomSuite Design System

This document reflects the current UI system in the app after the Joy migration work. Older references to `src/components/ui/*` and `src/styles/design-system.css` are stale and should not be treated as the source of truth.

## Source of Truth

- Theme provider: `src/providers/JoyThemeProvider.tsx`
- Theme definition: `src/config/joy-theme.ts`
- Legacy token bridge: `src/styles/joy-tailwind-bridge.css`
- Dashboard shell: `src/components/layout/DashboardShell.tsx`
- Topbar and sidebar navigation: `src/components/navigation/DashboardTopBar.tsx`, `src/components/navigation/DashboardSidebar.tsx`, `src/components/navigation/sidebarNavigation.ts`
- Page-level layout primitive: `src/components/joy/PageContainer.tsx`
- Reusable Joy wrappers: `src/components/joy/*`

## System Overview

BloomSuite now uses Joy UI as the primary application design system for modernized admin and dashboard surfaces.

- `JoyThemeProvider` wraps the app with Joy `CssVarsProvider` and the Emotion cache.
- `joy-theme.ts` extends Joy with BloomSuite-specific palettes, radius, spacing, shadow, and z-index tokens.
- `joy-tailwind-bridge.css` maps older semantic CSS variables onto Joy CSS variables so legacy Tailwind-heavy screens can keep rendering while the migration continues.
- `src/components/ui-legacy/*` is a compatibility layer for untouched legacy surfaces. It is not the forward-looking component system.

## Theme Tokens

The current theme is defined in `src/config/joy-theme.ts`.

- Primary palette: the main BloomSuite accent for interactive controls and focus states.
- Neutral palette: default text, borders, muted surfaces, and shell structure.
- Success, warning, info, and danger palettes: status-driven feedback.
- `brandNavy`: dashboard shell and primary navigation surface color family.
- `sand`: light background and content canvas tones used throughout the shell.
- Bridge tokens: legacy semantic values that keep older variables aligned with Joy colors while migration is still in progress.

When styling new UI, prefer Joy palette tokens and `sx` values over ad hoc hardcoded colors.

## Preferred Primitives

Use the Joy wrappers in `src/components/joy/*` first.

- Actions: `JoyButton`
- Surfaces: `JoyCard`, `JoyCardHeader`, `JoyCardContent`
- Status: `JoyChip`, `JoyStatusChip`
- Dialogs and overlays: `JoyDialog`, `JoyDrawer`, `JoyAlertDialog`, `JoyDropdownMenu`
- Forms: `JoyInput`, `JoyTextarea`, `JoySelect`, `JoySearchInput`, `JoySwitch`
- Data display: `JoyTable`, `JoyTabs`, `JoyTooltip`, `JoyStatCard`
- Layout helpers: `PageContainer`, `JoyFormSection`

For loading states on Joy screens, prefer Joy-native feedback.

- Use `@mui/joy/Skeleton` for placeholder loading.
- Use `CircularProgress` or `LinearProgress` for active work indicators.
- Avoid introducing new `ui-legacy` skeletons or spinners on Joy-based pages.

## Dashboard Shell Rules

`DashboardShell` is the canonical shell for the current dashboard system.

- Admin routes under `/admin/*` render through `AdminRouteLayout` and `DashboardShell mode="admin"`.
- Shell-managed tenant routes under `/integrations/*` render through `TenantRouteLayout` and `DashboardShell mode="tenant"`.
- Do not wrap pages already rendered inside `DashboardShell` with `SidebarLayout`.
- Do not create nested shells or page-level sidebars inside shell-managed routes.

`PageContainer` is the page-level spacing primitive inside shell content.

- Default behavior is centered content with `maxWidth: "80rem"`.
- Use `fullWidth` for dense admin tables, analytics screens, and operational dashboards.

Topbar labels and width behavior are derived from `src/components/navigation/sidebarNavigation.ts`.

- Route titles come from `resolveDashboardNavigationTitle`.
- Content width comes from `resolveDashboardContentWidth` and `resolveAdminDashboardContentWidth`.
- If you add or move shell-managed routes, update `sidebarNavigation.ts` so the shell title and width remain correct.

## Current Navigation Selectors

These selectors are intentionally stable and are used by current browser coverage.

- Shell root: `data-testid="dashboard-shell-root"`
- Shell content: `data-testid="dashboard-shell-content"`
- Desktop sidebar: `data-testid="dashboard-shell-sidebar"`
- Mobile sidebar: `data-testid="dashboard-shell-sidebar-mobile"`
- Mobile backdrop: `data-testid="dashboard-shell-backdrop"`
- Topbar: `data-testid="dashboard-shell-topbar"`

Important topbar controls:

- `Open sidebar`
- `Close sidebar`
- `Open search`
- `Close search`
- `Open notifications`
- `Open user menu`

## Legacy Interop Rules

The codebase still contains non-shell routes and older UI surfaces. Use these rules to avoid backsliding.

- `src/components/ui-legacy/*` is acceptable when modifying an existing legacy screen that has not been migrated yet.
- Do not introduce new `ui-legacy` imports on admin pages or other Joy-based shell routes unless there is no Joy equivalent and the usage is temporary.
- Do not recreate imports from `src/components/ui/*`; that directory is no longer the active target for new work.
- Avoid adding new CSS token layers that bypass `joy-theme.ts` or `joy-tailwind-bridge.css`.

## Practical Guidance

When building or refactoring a modern screen:

1. Start with `PageContainer`.
2. Use Joy wrappers for cards, forms, status, and tables.
3. Prefer palette-driven `sx` styling over bespoke class stacks.
4. Keep shell-managed routes inside the existing `DashboardShell` flow.
5. Update `sidebarNavigation.ts` if the route needs a shell title or width change.

When working on a legacy screen:

1. Preserve existing behavior first.
2. Avoid mixing raw legacy and Joy primitives within the same small component unless the migration boundary is clear.
3. If you are migrating a page to Joy, finish the page-level loading, card, form, and layout primitives together so the result is internally consistent.
