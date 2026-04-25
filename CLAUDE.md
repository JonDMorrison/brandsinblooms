Prefer MCP tools first whenever they can complete the task safely and directly.

Rules:

- For database inspection, queries, migrations, advisors, and Edge Function management, use Supabase MCP before terminal commands or manual code inspection when the MCP tool supports the task.
- For git, PR, issue, and review operations, use GitKraken/GitLens MCP before raw git CLI when the MCP tool supports the task.
- Use terminal or other tools only when MCP does not support the task, fails, or would be less safe.
- If falling back from MCP, state briefly why MCP was not used.
- Do not use database dump commands unless explicitly requested.

UI and dashboard rules:

- Treat `src/components/joy/*`, `src/providers/JoyThemeProvider.tsx`, `src/config/joy-theme.ts`, and `src/styles/joy-tailwind-bridge.css` as the current design-system source of truth.
- Prefer Joy wrappers or `@mui/joy` primitives for admin and dashboard work. Use `src/components/ui-legacy/*` only when touching an existing legacy surface that has not been migrated yet.
- Do not introduce new `ui-legacy` imports on pages already living inside the current dashboard shell unless there is no Joy equivalent and the usage is temporary.
- Admin routes under `/admin/*` and shell-managed tenant routes under `/integrations/*` already render inside `DashboardShell`. Do not wrap those pages in `SidebarLayout` and do not add nested shells.
- Use `PageContainer` for page-level spacing. Default to contained width and switch to `fullWidth` only for data-dense admin or reporting screens.
- Keep dashboard route titles and content-width rules in `src/components/navigation/sidebarNavigation.ts` aligned with any shell-managed route changes.
- Prefer Joy loading primitives such as `@mui/joy/Skeleton`, `CircularProgress`, and `LinearProgress` on Joy-based pages instead of legacy skeletons or custom spinners.
- Do not reintroduce references to deleted `src/components/ui/*` imports or `src/styles/design-system.css`.

Auth and browser-test rules:

- When updating Playwright auth flows, use the live auth selectors `#signin-email` and `#signin-password`.
- Prefer deterministic onboarding completion for test users by updating profile state instead of driving the brittle browser onboarding flow unless the onboarding UI itself is under test.
- If a change depends on Supabase browser auth or direct REST or Edge Function calls, prefer the publishable key constant from `src/integrations/supabase/config.ts` instead of hardcoded anon fallbacks.

## Lazy Loading Rules

All page components must be lazy-loaded. Do not add static page imports in `src/App.tsx`.

### Adding a new page

1. Prefer a default export for new page components under `src/pages/`.
2. Add the lazy import in the matching section of `src/App.tsx`:

```tsx
const MyNewPage = lazyRetry(() => import("@/pages/MyNewPage"));
```

3. For named exports, use `lazyNamed`:

```tsx
const MyNewPage = lazyNamed(() => import("@/pages/MyNewPage"), "MyNewPage");
```

4. Mount the route inside the existing boundary pattern for that surface:
   - Protected tenant routes that render inside `SidebarLayout` should use `renderProtectedSidebarLazyPage(...)`.
   - `/admin/*` children stay under `AdminLazyBoundary`.
   - `/integrations/*` children stay under `IntegrationsLazyBoundary`.
   - Public and callback routes stay under `PublicLazyBoundary` or `CallbackLazyBoundary`.

### Rules

- Never add `import PageComponent from '@/pages/...';` or `import { PageComponent } from '@/pages/...';` as a static page import in `src/App.tsx`.
- Always use `lazyRetry` for default exports or direct-file route modules.
- Always use `lazyNamed` for named exports.
- Prefer direct file imports over barrel imports when splitting related pages; for example, product pages should import `@/pages/products/ProductsPage` and `@/pages/products/ProductDetailPage` separately.
- Keep layout shells, route guards, and provider wrappers static. `DashboardShell`, `SidebarLayout`, `ProtectedRoute`, `PublicRoute`, and data providers are not lazy-loaded because they own the suspense boundaries.
- Do not move page components back into the main bundle by reintroducing static imports in route files.
