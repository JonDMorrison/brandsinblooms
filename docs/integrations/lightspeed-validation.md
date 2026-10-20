# Local validation — 2026-10-20

Base: CMS `682f828db`; CRM `2d8d32e`. Work is isolated on `feat/lightspeed-both-editions` in each checkout. The original CMS working copy was not edited. No customer account, production data or external configuration was accessed or changed.

- CMS `pnpm test:lightspeed`: **129 passed**. Both editions' provider contracts, state binding, callback replay, encrypted-token boundary, refresh/revocation, safe errors, tenant/site isolation, pagination, normalization, adapter and import behavior.
- CMS Jest owner screen/readiness routes: **9 passed**. Edition selection, prefix requirements, missing configuration, unsure help, cancellation, unavailable authority with disconnect, and cross-site status rejection.
- CMS `pnpm verify:types`: **passed**, including changed API routes, screen and core code. Separate strict portable-core TypeScript check also passed.
- CMS scoped ESLint: **passed**, no code warnings; ESLint emitted its repository-wide legacy-config deprecation notice.
- CMS production webpack build: **passed** after enabling network for public Google Fonts. The repository build skips TypeScript validation; the independent scoped checks above provide that evidence. The final build on the completed source also passed.
- CRM `pnpm test:lightspeed`: **94 passed**, running the actual Edge Function shared modules. This found and fixed the previously missing X-Series `payment_types:read` scope.
- CRM existing `IntegrationDetailPage.lightspeed` Vitest suite: **8 passed**.
- CRM Edge Function `deno check` (temporary Deno 2.5.4): **passed**. Generated dependency-lock changes were discarded; no dependency upgrade is included.
- Shared CMS/CRM authority, repository and provider implementation parity: **passed** (allowing Deno import suffixes only).
- CRM production Vite build: **passed**, with existing chunk-size warnings.
- PostgreSQL 18 disposable local databases: applied both October 9 baseline schemas and both new migrations. CMS X/R contracts, POS view contracts and CRM authority contracts **passed**. These cover service-only permissions/RLS, CAS, replay, owner/tenant mismatch, complete snapshot promotion, repeated start/callback, lease/retry behavior, outlet mapping and disconnect. The CI workflow retains PostgreSQL 17; CI itself was not run locally.
- `git diff --check`: **passed** in both repositories.

The full CMS-wide `tsc --noEmit` did **not** pass: its first run exceeded the default heap; a larger-heap retry was stopped after several minutes without a result. The repository's scoped check passed. No full-repository typecheck success is claimed.

These are synthetic fixtures and local builds, not live Lightspeed authorization. The release prerequisites, R-Series price hold and sandbox permission-validation requirement are in `lightspeed-editions.md`. No production migration, credential creation, customer authorization, merge or deployment was performed.
