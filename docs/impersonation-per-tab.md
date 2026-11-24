# Impersonation and admin workspace: per-tab isolation

Newsletter QA pass 2, item #9. Decision: per-tab isolation, no subdomain.

## Findings (state of `origin/main` at f1c2f8d60, before this change)

All three mechanisms existed. Two of them leaked across tabs.

### (a) Session-level impersonation: yes, and it replaced the admin session in every tab

- `src/pages/admin/AdminTenants.tsx:144-213` (`handleImpersonate`) invoked the
  `admin-impersonate-user` edge function, copied the admin's full session JSON
  into `sessionStorage` (`ADMIN_SESSION_BACKUP_STORAGE_KEY`, lines 177-193;
  nothing ever read it back) and opened `/admin/impersonate/callback` with
  `window.open(url, "_blank")` (line 201).
- `supabase/functions/admin-impersonate-user/index.ts:156-169` checks the caller
  against `app_admin_emails`, `:218-225` mints a magic link with
  `auth.admin.generateLink({ type: "magiclink" })`, `:248-258` writes
  `admin_audit_log`, and returns the `hashed_token`.
- `src/pages/admin/ImpersonateCallbackPage.tsx:46-49` redeemed it with
  `supabase.auth.verifyOtp({ token_hash, type: "magiclink" })` on the one
  shared client.
- `src/integrations/supabase/client.ts:131` configured that client with
  `auth.storage: localStorage` and the default key
  `sb-udldmkqwnxhdeztyqcau-auth-token`. So the customer session overwrote the
  admin session for the whole origin. supabase-js also broadcasts auth events
  on a `BroadcastChannel` named after that key, so other open tabs switched
  identity without a reload, and reloading them made it permanent.
- `src/hooks/useImpersonation.ts:52` ended impersonation with
  `supabase.auth.signOut()`. That is global scope, so it revoked every session
  the customer had, including their own devices. It then closed the tab or sent
  it to `/auth` (lines 61-66). The admin was signed out everywhere and had to
  sign in again.
- The impersonation flags (`bloomsuite_impersonation_active`, `_target_email`,
  `_started_at`) were already in `sessionStorage`
  (`ImpersonateCallbackPage.tsx:61-69`), so only the banner was per tab. The
  session itself was not.

### (b) Server-side master-admin active tenant: yes, one row per admin

- `public.admin_session_context (admin_user_id PK, active_tenant_id)`. The RLS
  policy "Admins can manage their own session context" (`auth.uid() =
  admin_user_id`) lets an admin point their own row at any tenant.
- It was read for master admins by `has_tenant_permission` (74 policies),
  `bloom_can_access_tenant` (30 policies), `get_current_crm_access`,
  `get_customer_catalog_stats`, `get_crm_dashboard_snapshot`, and the
  `protect_user_crm_role` trigger. It was also read directly by three policies:
  `crm_customers_select_by_scope`, `crm_segments_select_by_scope` and
  `customer_segments_select_by_scope`.
- It was written by `src/contexts/AdminContext.tsx:212-221`
  (`setActiveTenantId`) and by `src/pages/admin/AdminDashboard.tsx:56`.
- It is also read by the `bloom-assist` edge function
  (`supabase/functions/bloom-assist/admin-workspace.ts:24-28`).
- Effect: if two tabs of the same admin chose different companies, the last
  choice won on the server for both tabs. A tab still showing company A in
  React state could therefore get company B's data, or be denied access.

### (c) Client-side storage of the active tenant: React state only, hydrated from (b)

- `src/contexts/AdminContext.tsx:40` keeps `activeTenantId` in React state and
  loads it from `admin_session_context` on mount (`:137-142`). No
  `localStorage` or `sessionStorage` key held the active tenant. So a reload, or
  a new tab, took whichever company another tab last switched to.

## What changed

### (a) Impersonated session lives only in the impersonating tab

- `src/integrations/supabase/tabAuthSession.ts` holds `resolveTabAuthConfig`.
  The client calls it once, when its module loads:
  - `/admin/impersonate/callback` creates a new tab id in `sessionStorage`. The
    client then uses `auth.storage = sessionStorage` with
    `storageKey = sb-<ref>-impersonation-<tabId>-auth-token`.
  - Any later page load in that tab, where the tab id is present, uses the same
    slot.
  - `/admin/impersonate/start` always runs as the admin. It clears impersonation
    keys that the browser may have copied from an opener tab.
  - All other tabs use `localStorage` with the default key, as before.
- `BroadcastChannel` isolation: supabase-js names its channel after
  `storageKey`. Each impersonating tab has its own key, so its events never
  reach admin tabs or other impersonating tabs. `sessionStorage` does not fire
  cross-tab `storage` events.
- Ending impersonation (`endImpersonationTab` in `client.ts`) calls
  `signOut({ scope: "local" })` (only this tab's customer session is revoked),
  clears the tab's slot, and loads `/admin/tenants` as the admin. The admin
  session was never touched. The impersonating tab's sign-out paths
  (`AuthContext.signOut`, `signOutCompletely`, `forceLogout`, `cleanupAuthState`)
  do the same thing and never clear the admin's `localStorage` session.
- The callback refuses to redeem the link if the tab could not get its own slot,
  for example when storage is blocked. That stops it from overwriting the admin
  session.
- The unused admin-session backup in `sessionStorage` is removed.
- `shouldDetectSupabaseSessionInUrl` and the `/auth/callback` and
  `/integrations/*` callback handling are unchanged.

### (b) Admin active tenant is per tab on the server

- New `public.admin_active_tenant_id()` (migration
  `20261124154724_admin_tab_scoped_active_tenant.sql`):
  - Returns NULL for anyone who is not a master admin.
  - For a master admin, it reads the `x-bloom-admin-tenant` request header:
    - `none` → NULL.
    - An existing `tenants.id` → that tenant.
    - Anything else → NULL (fails closed).
  - With no header (edge functions, older clients, SQL) it falls back to the
    `admin_session_context` row, as before.
- All six functions and the three policies above now call the helper. The
  rewrite changes only the fragment that read the row, and the migration
  asserts that. A NULL active tenant never grants access.
- Why it is no more permissive than before: only master admins can use the
  header, and they could already point their row at any tenant. Non-admins
  carrying a forged header get NULL. `assert_tenant_access` and
  `assert_user_access` were not changed; they already let master admins through
  regardless of active tenant.
- The client sends the header on PostgREST requests only
  (`src/integrations/supabase/adminTenantScope.ts`, wired into the client's
  `global.fetch`). Edge-function CORS allow-lists would reject an unknown
  header.

### (c) Tab selection lives in sessionStorage

- `AdminContext` stores `{ adminUserId, tenantId }` in
  `sessionStorage["bloomsuite_admin_tab_tenant"]` and sets the request header.
- On load, a tab with its own selection keeps it. A new tab starts from the
  server row.
- A switch still saves the row first, so it stays the default for new tabs and
  for edge functions. Only after that does it update this tab's storage, header
  and state.
- `AdminDashboard`'s "View Tenant Data" now also updates the tab's context.

### Open as customer in a new tab

- The impersonation banner has an **Open as customer in new tab** button. A
  plain link or a copied URL cannot carry the session, so the button opens
  `/admin/impersonate/start?target_email=…&target_tenant_id=…` in a new tab
  (`noopener`). That tab calls the edge function as the admin, which keeps the
  same master-admin check and audit log. It then redeems its own link, so each
  tab has its own customer session.
- The admin tenants table opens the same start route synchronously, which also
  avoids the popup blocker.

## Known limits and follow-ups

- Edge functions still read `admin_session_context` directly. They receive no
  tab header, so they follow the admin's most recent switch. `bloom-assist`
  (`resolveAdminWorkspaceTenant`) is the main case: Bloom in an older tab
  answers for the company most recently selected in any tab. To fix this, the
  client would pass the tab company in the request body or an allowed header,
  and the function would call `admin_active_tenant_id()` or validate the value
  itself.
- If an impersonating tab is duplicated with the browser's "Duplicate tab", the
  copy gets that tab's `sessionStorage` and shares its refresh token. Rotation
  will sign one of the two out after the next refresh. Use the banner button
  instead.
- Still owed: a live check with Jon's real admin session. Two tabs: switch
  companies independently, impersonate in one, confirm the other stays admin,
  then end impersonation. Also confirm the Supabase API gateway accepts the
  `x-bloom-admin-tenant` header on CORS preflight from the production origin.
  The sandbox cannot reach the project over HTTPS, so this was not verified
  against the live gateway.

## Evidence

- SQL check on production, inside a transaction that was rolled back (a
  `DO` block ending in `RAISE`). Same master admin; `request.jwt.claims` and
  `request.headers` were set per simulated request:
  - Tab A, header = tenant A: active = A. `has_tenant_permission`: A true, B
    false. `get_current_crm_access` = A. Visible `crm_customers`: A 3, B 0.
  - Tab B, header = tenant B: active = B. `has_tenant_permission`: A false, B
    true. `get_current_crm_access` = B. Visible `crm_customers`: A 0, B 2274.
  - No header: the row's tenant, as before.
  - `none`, malformed, or unknown uuid: NULL, no access.
  - Non-admin with a forged header for A: NULL, no access to A, own tenant
    unaffected.
- Local Vite plus Playwright harness: two pages in one browser context, with
  Supabase mocked at the network layer. 22 of 22 checks passed. They cover:
  - Per-tab company: A switches and B does not follow. B switches and A, after a
    reload, keeps its own company. A new tab starts from the latest switch.
  - Impersonation: it starts in A. B stays admin after a `storage` event and
    after a reload. The admin `localStorage` session is untouched. "Open as
    customer in new tab" gives a separate slot. Ending revokes only A's customer
    session (`scope=local`) and A returns to admin. B is still admin.
- Unit tests:
  - `src/integrations/supabase/__tests__/tabAuthSession.test.ts`: client config
    per mode and header scoping.
  - `src/contexts/__tests__/AdminContext.test.tsx`: tab scoping.
  - `src/__tests__/bloomAdminWorkspace.test.ts`: static checks on the migration.
