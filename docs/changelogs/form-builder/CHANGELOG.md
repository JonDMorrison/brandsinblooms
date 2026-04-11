# Form Builder Changelog Audit

This folder documents the BloomSuite Form Builder as it exists in the repository on 2026-04-11.

It combines two kinds of evidence:

1. Explicit milestone evidence, where the repository contains `FB-00x` migration headers or milestone-specific comments.
2. Code archaeology, where important Form Builder features are clearly shipped but are not tied to a matching `FB-00x` identifier anywhere in the repo.

This is intentionally not written as a fake git-tag history. The repository contains real Form Builder evolution that predates the visible `FB-001` through `FB-010` tags, and several advanced features are shipped without a matching milestone label.

## Evidence Base

- Frontend pages and hooks under `src/pages/crm/`, `src/components/forms/`, `src/hooks/`, and `src/lib/forms/`
- Public runtime and embed assets under `public/forms/`
- Public and worker edge functions under `supabase/functions/`
- Database changes under `supabase/migrations/`
- Existing technical docs under `docs/`
- Tests under `src/__tests__/`

## Document Map

- `v1.0.0-schema.md`: schema, contracts, security, and foundational database work
- `v1.1.0-editor.md`: authoring UI, templates, autosave, preview, and builder ergonomics
- `v1.2.0-submissions.md`: submission ingestion, sanitization, review tooling, export, realtime, and delete flows
- `v1.3.0-publishing.md`: publish validation, share code generation, public route, and embed runtime history
- `v1.4.0-notifications.md`: consent handling, form notifications, and automation bridge behavior
- `v1.5.0-analytics.md`: form list stats, analytics RPCs, dashboard UI, and reporting limits
- `v1.6.0-advanced.md`: multi-step forms, conditional logic, uploads, audience enrichment, and diagnostic tooling
- `FEATURES.md`: complete feature inventory with status and primary evidence

## Milestone Status Matrix

| Milestone | Status | Evidence | Notes |
| --- | --- | --- | --- |
| `FB-001` | Implemented | `supabase/migrations/20260403120000_fb001_form_builder_contract_hardening.sql` | Contract hardening, retry RPC, and realtime publication |
| `FB-002` | Implemented | `supabase/migrations/20260403170000_fb002_form_builder_server_aggregation.sql` | Server-side stats, paginated submissions, analytics RPC foundation |
| `FB-003` | No explicit repo marker | None found | Core editor/runtime work exists, but no honest mapping to `FB-003` is visible in repo code |
| `FB-004` | No explicit repo marker | None found | Same as above |
| `FB-005` | No explicit repo marker | None found | Same as above |
| `FB-006` | No explicit repo marker | None found | Same as above |
| `FB-007` | No explicit repo marker | None found | Same as above |
| `FB-008` | Implemented in code, not tagged cleanly | `src/components/forms/FormDesignTab.tsx`, `supabase/functions/process-form-submitted/index.ts` | A stale UI note says routing is future work, but notification queueing exists in worker code |
| `FB-009` | Implemented | `supabase/migrations/20260405120000_fb009_submissions_admin_redesign.sql` | Search, sort, filter, summary, and batch delete support |
| `FB-010` | Implemented | `supabase/migrations/20260405133000_fb010_analytics_dashboard.sql` | Dashboard expansion and richer aggregate contract |
| `FB-011` | No explicit repo marker | None found | Advanced features exist, but cannot be tied to this ID from repository evidence alone |
| `FB-012` | No explicit repo marker | None found | Same as above |

## Untagged but Clearly Shipped Work

These pieces are real and important, but they are not labeled with matching `FB-00x` IDs in the repository:

- Core schema creation in `supabase/migrations/20260128180610_a29e7ba7-f8ee-43ed-9996-771417fff8fd.sql`
- Atomic rate-limit upsert in `supabase/migrations/20260128184042_6d9f682b-b6d9-4440-9dee-e6720a4357bf.sql`
- Form-submitted automation trigger bridge in `supabase/migrations/20260128195905_f704b93c-a51d-4615-af1f-56c725658a44.sql`
- Worker claim/idempotency improvements in `supabase/migrations/20260129155218_5c689100-4821-43e8-bf26-a236a71a0b15.sql`
- Private file upload storage in `supabase/migrations/20260405113000_form_uploads_bucket.sql`
- Public embed runtime versions in `public/forms/embed.v1.0.0.js`, `public/forms/embed.v1.0.1.js`, `public/forms/embed.v1.3.0.js`, `public/forms/embed.v1.4.0.js`, and `public/forms/embed.v1.5.0.js`

## Key Routes And Endpoints

| Surface | Contract |
| --- | --- |
| Internal forms index | `/crm/forms` |
| Internal form editor | `/crm/forms/:formId` |
| Public form route | `/f/:embedKey` |
| Public config endpoint | `GET /functions/v1/get-form-config?embed_key=...` |
| Public submission endpoint | `POST /functions/v1/submit-form` |
| Form automation worker | `supabase/functions/process-form-submitted/index.ts` |
| Legacy embed runtime endpoint | `supabase/functions/serve-embed-js/index.ts` |

## Important Honesty Notes

- The January migrations and the public embed runtime files prove the Form Builder shipped meaningful functionality before the later `FB-001`, `FB-002`, `FB-009`, and `FB-010` tags appeared.
- `src/components/forms/FormDesignTab.tsx` still contains the message `FB-008 handles notification routing. This milestone stores the list only.` The worker code now queues notification emails from `settings_json.notification_emails`, so that UI note is stale.
- Existing docs are helpful but not always canonical. For example, `docs/phase-3-schema-changes.md` describes the architecture, but its migration filenames and some contract details do not exactly match the current live code.
- The publish/share code in `src/lib/forms/share.ts` now points at current app origin and storage-hosted runtime assets, while older user-facing docs still reference `forms.bloomsuite.com` and `api.bloomsuite.com`.
