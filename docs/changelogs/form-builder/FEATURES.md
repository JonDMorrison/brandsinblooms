# Form Builder Feature Inventory

This inventory groups the full Form Builder surface by capability and calls out the primary evidence for each feature.

## Builder UI

| Feature | Status | Primary Evidence | Notes |
| --- | --- | --- | --- |
| Forms index | Implemented | `src/pages/crm/FormsPage.tsx` | Create, duplicate, archive, delete, copy public link |
| Start from scratch | Implemented | `src/lib/formTemplates.ts`, `src/pages/crm/FormsPage.tsx` | Starter form begins with one required email field |
| Template picker | Implemented | `src/components/forms/FormTemplatesDialog.tsx`, `src/lib/formTemplates.ts` | Includes Newsletter Signup, VIP Waitlist, Event Signup |
| Multi-tab editor shell | Implemented | `src/pages/crm/FormEditorPage.tsx` | Build, Design, Audience, Compliance, Submissions, Analytics |
| Autosave and unsaved-change protection | Implemented | `src/hooks/useFormEditor.ts`, `src/pages/crm/FormEditorPage.tsx` | Includes navigation guarding and save-now flow |
| Inline form-name editing | Implemented | `src/pages/crm/FormEditorPage.tsx` | Header edit mode with explicit save behavior |
| Drag-and-drop field order | Implemented | `src/components/forms/DraggableFieldList.tsx` | Uses `@hello-pangea/dnd` |
| Field palette | Implemented | `src/lib/forms/fieldRegistry.ts`, `src/components/forms/DraggableFieldList.tsx` | Includes basic and compliance field types |
| Mapping-key authoring | Implemented | `src/components/forms/DraggableFieldList.tsx`, `docs/form-builder-crm-mapping-key.md` | Canonical downstream field naming |
| Hidden field defaults | Implemented | `src/components/forms/DraggableFieldList.tsx` | Hidden values are injected into payloads |
| Regex validation authoring | Implemented | `src/components/forms/DraggableFieldList.tsx` | Supports `pattern` and `pattern_message` |

## Advanced Authoring

| Feature | Status | Primary Evidence | Notes |
| --- | --- | --- | --- |
| Multi-step authoring | Implemented | `src/components/forms/FormBuildTab.tsx`, `src/lib/forms/formFlow.ts` | Steps, step focus, and empty-step publish validation |
| Conditional visibility rule builder | Implemented | `src/components/forms/DraggableFieldList.tsx` | Rule UI is present, not just types |
| File upload constraints | Implemented | `src/components/forms/DraggableFieldList.tsx`, `src/lib/forms/fileUploads.ts` | Max files, max size, MIME type rules |
| Consent field single-instance control | Implemented | `src/lib/forms/fieldRegistry.ts` | Prevents duplicate consent field types |
| Audience persona assignment | Implemented | `src/components/forms/FormAudienceTab.tsx`, `supabase/functions/submit-form/index.ts` | Post-submit enrichment |
| Audience tag assignment | Implemented | `src/components/forms/FormAudienceTab.tsx`, `supabase/functions/submit-form/index.ts` | Post-submit enrichment |
| Double opt-in toggle | Partial | `src/components/forms/FormComplianceTab.tsx` | Present in UI, disabled as Coming Soon |
| GDPR toggle | Implemented | `src/components/forms/FormComplianceTab.tsx` | Stored in contract and editable in UI |

## Preview And Publish

| Feature | Status | Primary Evidence | Notes |
| --- | --- | --- | --- |
| Live preview panel | Implemented | `src/components/forms/preview/PreviewPanel.tsx` | Debounced updates, device modes, reset |
| Preview dialog | Implemented | `src/components/forms/preview/FormPreviewDialog.tsx`, `src/pages/crm/FormEditorPage.tsx` | Mobile-friendly preview access |
| Publish validation | Implemented | `src/lib/forms/publish.ts`, `src/pages/crm/FormEditorPage.tsx` | Blocks missing name, missing email, invalid SMS pairing, empty steps |
| Direct link sharing | Implemented | `src/components/forms/FormPublishTab.tsx`, `src/lib/forms/share.ts` | Uses `/f/:embedKey` |
| Iframe embed code | Implemented | `src/components/forms/FormPublishTab.tsx`, `src/lib/forms/share.ts` | Generated in app |
| JavaScript embed code | Implemented | `src/components/forms/FormPublishTab.tsx`, `src/lib/forms/share.ts` | Uses static runtime |
| React embed snippet | Implemented | `src/components/forms/FormPublishTab.tsx`, `src/lib/forms/share.ts` | Loads runtime once and mounts by data attributes |
| Modal and slide-in display modes | Implemented | `src/components/forms/FormPublishTab.tsx`, `public/forms/embed.v1.3.0.js` | Supported in UI and runtime |
| Trigger attributes for delay/scroll/click | Partial | `public/forms/embed.v1.3.0.js`, `public/forms/embed.v1.4.0.js`, `public/forms/embed.v1.5.0.js` | Runtime supports them, builder UI does not generate them |

## Public Runtime And Submission Pipeline

| Feature | Status | Primary Evidence | Notes |
| --- | --- | --- | --- |
| Public form route | Implemented | `src/App.tsx`, `src/pages/PublicFormPage.tsx` | Route is `/f/:embedKey` |
| Public config endpoint | Implemented | `supabase/functions/get-form-config/index.ts` | Strict settings allowlist |
| Public submission endpoint | Implemented | `supabase/functions/submit-form/index.ts` | Validation, rate limiting, spam protection, customer upsert |
| Mapping-key normalization | Implemented | `src/pages/PublicFormPage.tsx` | Hidden fields and consent values normalized into canonical keys |
| Conditional sanitization | Implemented | `supabase/functions/_shared/formVisibility.ts`, `src/__tests__/formVisibility.test.ts` | Hidden defaults preserved, inactive fields stripped |
| Rate limiting | Implemented | `supabase/migrations/20260128184042_6d9f682b-b6d9-4440-9dee-e6720a4357bf.sql`, `supabase/functions/submit-form/index.ts` | Atomic database-backed counter |
| Honeypot spam detection | Implemented | `supabase/functions/submit-form/index.ts` | Rejects honeypot-filled submissions |
| Consent-safe customer upsert | Implemented | `supabase/functions/submit-form/index.ts`, `docs/release-decision-form-builder-v1.md` | Never downgrades consent or touches `opt_out` |
| File upload finalization | Implemented | `supabase/functions/submit-form/index.ts`, `supabase/migrations/20260405113000_form_uploads_bucket.sql` | Temp uploads copied into permanent paths on accepted submission |
| Temp upload cleanup | Implemented | `supabase/functions/form-data-cleanup/index.ts` | Removes stale temp objects |

## Submissions Operations

| Feature | Status | Primary Evidence | Notes |
| --- | --- | --- | --- |
| Paginated submissions tab | Implemented | `src/components/forms/FormSubmissionsTab.tsx`, `src/hooks/useForms.ts` | Uses server-side RPC paging |
| Search/filter/sort | Implemented | `supabase/migrations/20260405120000_fb009_submissions_admin_redesign.sql` | Search, result filter, date filter, sortable columns |
| CSV export | Implemented | `src/components/forms/submissions/SubmissionExport.tsx`, `src/hooks/useForms.ts` | Export fetches filtered pages from RPC |
| Submission detail modal | Implemented | `src/components/forms/submissions/SubmissionDetailModal.tsx` | Shows submission data and metadata |
| Batch delete | Implemented | `supabase/migrations/20260405120000_fb009_submissions_admin_redesign.sql`, `src/hooks/useForms.ts` | Uses `delete_form_submissions(...)` |
| Realtime updates | Implemented | `src/hooks/useFormSubmissionsRealtime.ts`, `supabase/migrations/20260403120000_fb001_form_builder_contract_hardening.sql` | `form_submissions` publication enabled for insert events |
| Developer test matrix | Implemented | `src/components/forms/FormTestMatrix.tsx`, `src/components/forms/FormSubmissionsTab.tsx` | Manual runtime diagnostics embedded behind collapsible tools |

## Analytics And Reporting

| Feature | Status | Primary Evidence | Notes |
| --- | --- | --- | --- |
| Form list stats | Implemented | `supabase/migrations/20260403170000_fb002_form_builder_server_aggregation.sql`, `src/hooks/useForms.ts` | `get_forms_with_stats(...)` |
| Analytics dashboard | Implemented | `src/components/forms/FormAnalyticsTab.tsx`, `src/hooks/useForms.ts` | Summary, charts, referrers, fill rates |
| Analytics expansion | Implemented | `supabase/migrations/20260405133000_fb010_analytics_dashboard.sql` | All-time support and richer aggregate payload |
| Analytics test coverage | Implemented | `src/__tests__/FormAnalyticsTab.test.tsx` | Verifies range-selection and empty-state consumption |
| Conversion analytics | Partial | `src/types/formBuilder.ts`, `src/components/forms/FormAnalyticsTab.tsx` | Explicit unavailable state until form-view tracking exists |

## Notifications And Automations

| Feature | Status | Primary Evidence | Notes |
| --- | --- | --- | --- |
| Notification recipient list in builder | Implemented | `src/components/forms/FormDesignTab.tsx` | Stores `notification_emails` |
| Form-settings notification queueing | Implemented | `supabase/functions/process-form-submitted/index.ts` | Queues email work into `crm_outbox` |
| Form-submitted automation event | Implemented | `supabase/migrations/20260128195905_f704b93c-a51d-4615-af1f-56c725658a44.sql` | Trigger emits `form_submitted` after accepted submissions |
| Atomic worker claiming | Implemented | `supabase/migrations/20260129155218_5c689100-4821-43e8-bf26-a236a71a0b15.sql` | `claim_trigger_events(...)` |
| Retry bookkeeping | Implemented | `supabase/migrations/20260403120000_fb001_form_builder_contract_hardening.sql` | `increment_trigger_event_retry(...)` |
| End-to-end delivery verification in Form Builder module | Partial | `supabase/functions/process-form-submitted/index.ts` | Queueing is confirmed; final delivery depends on shared outbox processors |

## Known Gaps

| Capability | Status | Primary Evidence | Notes |
| --- | --- | --- | --- |
| Clean repo mapping for `FB-003` to `FB-007` | Missing | repo audit | Core functionality exists, but those IDs are not attributable from current code |
| Clean repo mapping for `FB-011` and `FB-012` | Missing | repo audit | Advanced features exist without matching milestone tags |
| Builder UI for embed trigger attributes | Missing | `src/components/forms/FormPublishTab.tsx`, `public/forms/embed.v1.5.0.js` | Runtime supports it, UI does not |
| Double opt-in pipeline | Missing | `src/components/forms/FormComplianceTab.tsx`, `supabase/functions/submit-form/index.ts` | Still marked Coming Soon |
| Notification recipient verification | Missing | `src/components/forms/FormDesignTab.tsx` | No validation beyond email format normalization |
| Form version history / rollback | Missing | editor audit | No built-in revision browser |
| Partial submission / drop-off analytics | Missing | analytics audit | No partial events stored |
| Audience as access control | Missing | `src/components/forms/FormAudienceTab.tsx`, `src/pages/PublicFormPage.tsx` | Audience is enrichment, not public gating |
