# Mailchimp Import System Context

This document describes the current Mailchimp import system as it exists in the codebase today. It is written as rebuild-grade context for an agent or engineer who needs to understand the full frontend flow, Supabase edge-function behavior, schema contracts, status surfaces, route wiring, and known mismatches without reopening every file.

This is intentionally descriptive, not aspirational. If the code and an older comment disagree, the behavior described here follows the current code path.

## 1. File Inventory And System Map

The Mailchimp import system spans four layers: UI entry surfaces, the migration wizard, Supabase edge functions, and import/schema persistence.

Core frontend entry and detail files:

- `src/App.tsx`: registers `/integrations/migrations`, `/integrations/:slug`, and `/oauth/callback`.
- `src/components/integrations/integrationsHubConfig.ts`: defines the Mailchimp hub card metadata and its primary target path.
- `src/components/integrations/IntegrationHub.tsx`: legacy marketplace-style integrations page with a Mailchimp OAuth connect shortcut and a separate generic migration CTA.
- `src/pages/integrations/CRMIntegrationsPage.tsx`: legacy import chooser page that sends Mailchimp to `/integrations/mailchimp` and other providers directly to `/integrations/migrations?provider=...`.
- `src/hooks/useIntegrationDetailData.ts`: central data model builder for Mailchimp detail pages, import history, capabilities, disconnect actions, and route targets.
- `src/pages/integrations/IntegrationDetailPage.tsx`: renders Mailchimp detail metrics, actions, history, danger zone, and import navigation.

Wizard files:

- `src/pages/MigrationsPage.tsx`
- `src/components/migrations/ConnectStep.tsx`
- `src/components/migrations/ChooseStep.tsx`
- `src/components/migrations/PreviewStep.tsx`
- `src/components/migrations/AnalyzeStep.tsx`
- `src/components/migrations/ApplyStep.tsx`
- `src/components/migrations/ImportStep.tsx`
- `src/components/migrations/ReportStep.tsx`
- `src/components/migrations/OAuthCallbackHandler.tsx`

Progress/status files:

- `src/hooks/useImportProgress.ts`
- `src/hooks/useMigrationJobs.ts`
- `src/components/migrations/MigrationJobCard.tsx`
- `src/components/migrations/MigrationStatusIndicator.tsx`
- `src/components/integrations/ImportProgressDialog.tsx`
- `src/components/integrations/MailchimpStatusBadge.tsx`

Mailchimp backend functions:

- `supabase/functions/oauth-authorize/index.ts`
- `supabase/functions/migrations-oauth-callback/index.ts`
- `supabase/functions/mailchimp-fetch-lists/index.ts`
- `supabase/functions/mailchimp-fetch-preview/index.ts`
- `supabase/functions/mailchimp-validate/index.ts`
- `supabase/functions/mailchimp-import/index.ts`
- `supabase/functions/mailchimp-revoke-token/index.ts`
- `supabase/functions/_shared/mailchimp/MailchimpClient.ts`
- `supabase/functions/_shared/crypto/tokens.ts`

Schema and contract migrations most relevant to the current Mailchimp path:

- `supabase/migrations/20250716164133-34b384e9-570f-45c4-b43f-88fb3ba0491d.sql`
- `supabase/migrations/20250731031823_9ea1113d-6cdf-4e5e-b3f1-60f143dbf172.sql`
- `supabase/migrations/20251011201443_5f5027cf-b7e6-4dc1-ad49-a1608e9778c3.sql`
- `supabase/migrations/20251012003118_c27ba10b-37be-46db-b561-c9658a27eaec.sql`
- `supabase/migrations/20251012004307_11420691-7852-4969-a4f1-a883658b7e04.sql`
- `supabase/migrations/20251112233021_b175ad8f-8031-4cea-8f8d-f001ca3cc98f.sql`
- `supabase/migrations/20251113221203_edffcd0b-5aea-4d28-bac7-d55e8e5c9046.sql`
- `supabase/migrations/20251113222914_fc4a8952-dfe0-4b30-a38a-4983b5858f36.sql`
- `supabase/migrations/20251113232146_951c96d8-1c2f-4258-abd2-9b499e7e946f.sql`
- `supabase/migrations/20251211202948_5304447d-43c3-46a9-ad40-37fd4f058274.sql`
- `supabase/migrations/20251220203039_4197d35b-3ceb-4c25-a08a-5a1ff803d78a.sql`
- `supabase/migrations/20251221210720_82ae1873-4b14-4764-8540-4d2c1e61e7f8.sql`
- `supabase/migrations/20260110013542_5bacf841-6d0e-4577-b13c-fcc70d79cfbf.sql`
- `supabase/migrations/20260128180610_a29e7ba7-f8ee-43ed-9996-771417fff8fd.sql`
- `supabase/migrations/20260329120000_mc000_mailchimp_architecture_contracts.sql`
- `supabase/migrations/20260329143000_mc002_provider_artifacts_unique_constraint.sql`
- `supabase/migrations/20260330014500_mc006_provider_artifacts_constant_contact.sql`

High-level runtime shape:

- Connection state lives in `provider_connections`.
- Cached Mailchimp list and segment metadata lives in `provider_artifacts`.
- Import-run state and progress live in `import_jobs`.
- Separate global migration status surfaces still read from `migration_jobs`.
- Imported CRM data lands across `crm_customers`, `customer_consents`, `suppression_list`, `crm_tags`, `customer_tags`, `customer_sources`, `crm_segments`, and `customer_segments`.

## 2. Wizard Container: MigrationsPage.tsx

`MigrationsPage.tsx` is the shell for the multi-step import wizard. It owns provider selection, current step, selected import scope, AI suggestion state, the active `import_jobs` id, and the final report.

Current wizard step order:

1. `connect`
2. `choose`
3. `preview`
4. `analyze`
5. `apply`
6. `import`
7. `report`

Important behavior:

- The provider is derived from the query string and, in some cases, navigation state.
- The page only meaningfully honors `step=choose` when a provider is present. It does not behave like a general deep-linkable step router.
- The `import_jobs` row is first created in `handleChooseComplete(...)`, not at connect time.
- The selection the user makes in `ChooseStep` is stored into `import_jobs.config`.
- After job creation, downstream steps mostly work off `jobId` and data already stored server-side.

State held at the page level includes:

- `currentStep`
- `importSelection`
- `jobId`
- `aiSuggestions`
- `importReport`

Important implication:

- There is no orphan cleanup path for abandoned jobs after `ChooseStep` creates an `import_jobs` row. If the user leaves the wizard, that pending job can remain.

## 3. ConnectStep.tsx

`ConnectStep.tsx` is the provider authorization gate. It renders three cards: Mailchimp, Klaviyo, and Constant Contact.

Connection behavior:

- On mount it queries `provider_connections` to determine existing connected providers.
- Clicking connect opens a popup via `window.open(...)`.
- The popup is centered and uses a `520x720` style window with `noopener,noreferrer`.
- The parent page listens for `postMessage` responses.
- It validates `event.origin === window.location.origin` in the normal popup success path.
- It polls every 500 ms to detect silent popup closure and treats that as cancellation.

Mailchimp-specific disconnect behavior:

- Disconnect is routed through `mailchimp-revoke-token` for Mailchimp and Klaviyo.
- Constant Contact uses its own revoke function.

Important UX detail:

- The `Continue` button is enabled when any provider is connected, not only when the currently focused provider card is selected. That means an unrelated connected provider can unlock the next step.

## 4. ChooseStep.tsx

`ChooseStep.tsx` loads provider artifacts and lets the user select lists and segments.

Mailchimp-specific behavior:

- It calls `mailchimp-fetch-lists` on mount and when the provider changes.
- Lists and segments are treated as separate selectable scopes.
- Selected list ids are stored as plain `list.id` values.
- Selected segment ids are stored as composite strings in the format `listId:segmentId`.
- At least one list or segment must be selected to continue.

Important semantic detail:

- List selection and segment selection are independent. The wizard does not force segments to be chosen only inside a chosen list, even though the segment ids encode the parent list.
- The composite segment id format is a deliberate contract used throughout preview, import, and artifact caching to avoid collisions between segments from different Mailchimp audiences.

## 5. PreviewStep.tsx

`PreviewStep.tsx` is the first step that shows concrete data from the saved job configuration.

Behavior:

- It loads `job.provider` and `job.config` using the `jobId` generated after `ChooseStep`.
- It invokes a provider-specific preview function with `{ jobId }`.
- For Mailchimp, that provider-specific preview function is `mailchimp-fetch-preview`.

What it renders:

- list summary information
- selected segments
- sample contacts table
- `estimatedImportCount`
- `estimatedDuration`
- `alreadyInCRM`
- `newContacts`

Important preview semantics:

- If selected segments exist, the preview is segment-based.
- If no segments exist, the preview uses the first selected list.
- The sample currently shows the first 10 contacts from the previewed scope.

Important mismatch:

- `ChooseStep` allows multiple selected lists, but `mailchimp-fetch-preview` only previews the first selected list when no segments are selected. The import backend later supports multiple work items, so preview scope can underrepresent the actual import scope.

## 6. AnalyzeStep.tsx And ApplyStep.tsx

These two steps are still in the active wizard path, even though the Mailchimp import system is primarily about list/segment selection and CRM ingestion.

`AnalyzeStep.tsx`:

- calls `migration-ai-embed`
- then calls `migration-ai-suggest`
- is not Mailchimp-specific
- still sits in the flow before import

`ApplyStep.tsx`:

- shows and edits AI-generated mapping suggestions
- describes high-confidence mappings as auto-applied
- includes an internal comment indicating suggestions are actually applied in the Import step

Why this matters:

- The current Mailchimp path is not just connect -> choose -> preview -> import -> report. It still carries an AI analysis and apply layer that appears broader than what the current import backend actually uses.
- This is one of the clearest UX/architecture mismatches in the flow.

## 7. ImportStep.tsx

`ImportStep.tsx` validates the connection and then starts the actual import.

Behavior:

- It first calls the provider-specific validate function.
- For Mailchimp this means invoking `mailchimp-validate`.
- If validation passes, it invokes the provider-specific import function.
- For Mailchimp this means invoking `mailchimp-import`.
- It immediately opens `ImportProgressDialog` instead of waiting for the backend function to finish.

Error handling:

- If the client-side start logic throws, the component directly updates `import_jobs.status = 'failed'`.

Important architectural detail:

- The step does not await actual completion of the import. It only awaits the request that starts the background work.
- The visible progress experience depends on realtime and polling updates arriving from `import_jobs`.

## 8. ReportStep.tsx

`ReportStep.tsx` renders the normalized final report after import completion.

It normalizes these report keys:

- `contacts_imported`
- `contacts_skipped`
- `contacts_failed`
- `segments_created`
- `tags_created`
- `consents_recorded`
- `errors` as a string array
- `batches_processed`

UI behavior:

- summary cards show the main counts
- warnings/errors render in an accordion
- the step supports `Download Report`
- the step also exposes `Disconnect Provider`

Important contract:

- The final report object produced by `mailchimp-import` already uses the same key names that `ReportStep.tsx` expects.

## 9. oauth-authorize

`oauth-authorize` is the backend entry for starting the Mailchimp OAuth flow.

Request contract:

- JSON body contains `provider`
- requires an authenticated user

Behavior:

- verifies the required environment variables are present
- builds a signed JWT `state` payload
- returns an authorization URL and the signed state token

The JWT state payload includes:

- `uid`
- `provider`
- `nonce`
- `ts`
- `redirectUri`
- `appOrigin`
- `exp`

Important design choice:

- OAuth state is not stored in the database. It is encoded and signed as a JWT.

Mailchimp-specific detail:

- The generated Mailchimp auth URL does not explicitly add a custom scope string in the current implementation.

Return shape:

- `{ authUrl, state }`

## 10. migrations-oauth-callback

`migrations-oauth-callback` is the OAuth callback edge function that Mailchimp returns to after user authorization.

Behavior:

- handles a GET callback
- verifies the JWT state produced by `oauth-authorize`
- exchanges the authorization code for an access token at `https://login.mailchimp.com/oauth2/token`
- fetches account metadata from `https://login.mailchimp.com/oauth2/metadata`
- encrypts the access token before storing it
- upserts `provider_connections`
- redirects the browser back to `/oauth/callback?provider=...&status=...`

What it writes into `provider_connections`:

- `status: 'connected'`
- encrypted access token
- account metadata
- token expiry when reported
- connection timestamps

Mailchimp-specific side effect:

- On success it background-invokes `mailchimp-fetch-lists` with `{ tenant_id, user_id, preCache: true }` so list and segment artifacts are cached immediately after OAuth.

Important bug/mismatch:

- The catch branch hardcodes `provider=mailchimp` in the error redirect instead of preserving the actual provider value.

## 11. OAuthCallbackHandler.tsx

`OAuthCallbackHandler.tsx` is the frontend page mounted at `/oauth/callback`.

Behavior in the migration OAuth flow:

- reads `provider` and `status` from the query string
- posts either `oauth-success` or `oauth-error` back to the opener window
- attempts to close the popup window
- if `window.close()` does not close the popup, it falls back to a simple completion UI with a `Close Window` button

Important detail:

- In the server-redirect Mailchimp path, the popup callback uses `postMessage(..., '*')` instead of a locked target origin.
- The same file also contains a separate Meta-specific OAuth branch that is stricter about origin handling.

Why it matters:

- The ConnectStep parent listener is origin-aware, but the popup side of the flow is still using a wildcard target for this path.

## 12. mailchimp-fetch-lists

`mailchimp-fetch-lists` loads Mailchimp audiences and their segments, then stores them in BloomSuite.

Authentication modes:

- normal end-user invocation through an authenticated session
- internal pre-cache invocation using a service-role-authenticated path after OAuth success

Behavior:

- loads the Mailchimp `provider_connections` row
- decrypts the stored token through `MailchimpClient.fromConnection(...)`
- fetches all lists from Mailchimp
- fetches segments per list
- writes artifacts into `provider_artifacts`
- returns `{ lists, totalLists, totalSegments }`

Artifact contract details:

- list artifacts and segment artifacts are cached in `provider_artifacts`
- segment artifact `external_id` uses the composite format `listId:segmentId`
- segment artifact `data.parent_list_id` preserves the parent list relationship
- artifacts are intended to upsert/deduplicate on `(tenant_id, provider, artifact_type, external_id)`

Important schema-driven implementation detail:

- `provider_artifacts.import_job_id` is non-nullable, so the function creates a hidden completed artifact-cache `import_jobs` row if needed.
- That hidden cache job exists to satisfy schema shape rather than to represent a user-visible import execution.

## 13. mailchimp-fetch-preview

`mailchimp-fetch-preview` produces the preview payload used by `PreviewStep.tsx`.

Behavior:

- reads `import_jobs.config`
- parses the selected lists and selected segments
- if selected segments exist, calls the Mailchimp segment members endpoint
- otherwise calls the list members endpoint for the first selected list
- compares sample emails against tenant-scoped `crm_customers.email`
- returns the preview summary object used by the UI

Returned fields include:

- `listInfo`
- `selectedSegments`
- `sampleContacts`
- `estimatedImportCount`
- `estimatedDuration`
- `alreadyInCRM`
- `newContacts`

Important limitation:

- Duplicate estimation is not a full import-wide reconciliation. It is inferred from sampled emails.
- When multiple lists are chosen with no segments, only the first list is previewed.

## 14. mailchimp-validate

`mailchimp-validate` is a preflight check, not a full dry-run import.

Behavior:

- requires authenticated invocation
- pings Mailchimp via `client.ping()`
- validates email format against the first 100 members per selected list
- checks for duplicates against `crm_customers`

Return shape:

- `{ valid, validationErrors }`

Important detail:

- Duplicate detection does not fail validation. It is informational/logging-oriented rather than a hard stop.

## 15. mailchimp-import

`mailchimp-import` is the core ingestion engine.

Request/response shape:

- the function returns `202` quickly
- the actual import continues in background through `EdgeRuntime.waitUntil(...)`

Early setup behavior:

- ensures or creates a related `migration_jobs` row
- reads and parses `import_jobs.config`
- extracts `listIds` and `segmentIds`
- builds work items

Work item semantics:

- if segments are selected, import work is segment-scoped
- otherwise import work is full-list scoped
- segment work items call `getSegmentMembers(...)`
- list work items call `getListMembers(...)`

Primary write paths:

- `crm_customers`
- `customer_consents`
- `suppression_list`
- `crm_tags`
- `customer_tags`
- `customer_sources`
- `crm_segments`
- `customer_segments`
- `import_jobs`
- `migration_jobs`

RPCs used:

- `log_import_batch_error`
- `record_contact_import_event`

What `crm_customers` is directly upserted with:

- `tenant_id`
- `email`
- `first_name`
- `last_name`
- `phone`
- `custom_fields`

What is not directly written into `crm_customers` by this helper:

- the newer consent detail JSON columns
- the suppression snapshot columns
- newer profile/attribution fields unless they are incidentally packed into `custom_fields`

Consent and suppression handling instead occurs through separate tables:

- `customer_consents`
- `suppression_list`

Segment behavior:

- `ensureCrmSegment(...)` creates provider-sourced CRM segments with `source = 'mailchimp'`
- `source_id` is the composite segment id
- `linkCustomersToSegment(...)` writes `customer_segments`

Progress fields written during runtime:

- `current_page`
- `fetched_rows`
- `inserted_rows`
- `skipped_rows`
- `failed_rows`
- `total_pages_est`
- `progress_percentage`
- `current_stage`
- `batch_stats`

Progress behavior:

- `progress_percentage` is capped at 99 until the job fully completes
- completion and failure update both `import_jobs` and `migration_jobs`

Final report contract:

- `contacts_imported`
- `contacts_skipped`
- `contacts_failed`
- `segments_created`
- `tags_created`
- `consents_recorded`
- `errors`
- `batches_processed`

## 16. mailchimp-revoke-token

`mailchimp-revoke-token` handles disconnect/revoke for Mailchimp and Klaviyo.

Mailchimp-specific behavior:

- calls `https://login.mailchimp.com/oauth2/revoke`
- updates `provider_connections.status = 'revoked'`
- sets `revoked_at`
- clears `encrypted_access_token`
- deletes cached `provider_artifacts`

Important detail:

- The function does not clear a refresh token column because the current flow stores and uses the encrypted access token path reflected in the current code.

Effect on data:

- Imported CRM data remains in BloomSuite.
- Cached Mailchimp audience metadata is cleared.
- Future previews and imports are blocked until reconnect.

## 17. Progress Hooks And Status Components

There are two overlapping progress systems in the codebase.

`useImportProgress.ts`:

- subscribes directly to `import_jobs`
- fetches the job once, then listens for realtime updates by id
- exposes `isRunning`, `isCompleted`, `isFailed`, `progress`, and `stage`
- is a lightweight import-job hook

`ImportProgressDialog.tsx`:

- does not rely on `useImportProgress`
- manages its own realtime subscription to `import_jobs`
- also polls every 2 seconds as a fallback
- tracks `progress_percentage`, `current_stage`, `batch_stats`, `fetched_rows`, `inserted_rows`, `skipped_rows`, `failed_rows`, `estimated_completion_at`, and normalized errors
- shows a stale-progress warning if the job is still marked running but has not updated for 45 seconds
- auto-calls `onComplete` 1.5 seconds after completion
- has no cancel action

`useMigrationJobs.ts`:

- reads `migration_jobs`, not `provider_connections`
- subscribes to all realtime changes on `migration_jobs`
- invalidates the query on each change
- shows toast notifications when a migration job completes or fails
- exposes pause/resume/cancel mutations through `migration-control`

`MigrationJobCard.tsx`:

- renders a card for one `migration_jobs` row
- shows progress percentage, current/total counts, started/completed times, and pause/resume/cancel controls

`MigrationStatusIndicator.tsx`:

- is a fixed bottom-right card
- only renders when there is at least one active `migration_jobs` row
- shows the first active job only
- is generic to any migration platform, not Mailchimp-specific

`MailchimpStatusBadge.tsx`:

- also reads `migration_jobs`
- finds the most recent job where `source_platform === 'mailchimp'`
- labels a completed job as `Connected`
- labels a running job as `Syncing...`
- can show a retry button on failed or paused states

Important mismatch:

- `MailchimpStatusBadge` presents connection state based on the latest migration job, not on the actual `provider_connections` row.
- A completed Mailchimp migration job is treated as if Mailchimp is connected.

## 18. Integration Entry Surfaces, Navigation, And Detail Pages

Mailchimp currently appears in several surfaces that do not route users in exactly the same way.

`integrationsHubConfig.ts`:

- Mailchimp is declared as a `marketing-import` integration.
- `targetPath` is `/integrations/mailchimp`.
- `actionLabel` is `Connect`.
- `detailActionLabel` is `Open import flow`.
- The config copy describes Mailchimp as importing contacts, lists, segments, tags, and consent data.

`IntegrationHub.tsx`:

- still contains a legacy marketplace-style `availableIntegrations` array with a Mailchimp card in the marketing/email section.
- Mailchimp uses a dedicated `handleConnectMailchimp()` path that invokes `oauth-authorize` and opens a popup.
- The page also renders a featured `Data Migration Tool` card.
- That featured card sends users to `/integrations/migrations`, not `/integrations/mailchimp`.
- The page also renders `MigrationStatusIndicator` globally.

`CRMIntegrationsPage.tsx`:

- shows a small list of import providers
- Mailchimp `Import` navigates to `/integrations/mailchimp`
- Klaviyo and Constant Contact go straight to `/integrations/migrations?provider=...`
- Mailchimp alone renders `MailchimpStatusBadge`

`App.tsx` route wiring:

- `/integrations/migrations` renders `MigrationsPage`
- `/integrations/:slug` renders `IntegrationDetailPage`
- `/oauth/callback` renders `OAuthCallbackHandler`
- There is no dedicated Mailchimp page component; `/integrations/mailchimp` is resolved through `:slug`

`useIntegrationDetailData.ts` Mailchimp branch:

- fetches the latest tenant/user-scoped Mailchimp `provider_connections` row
- fetches cached `provider_artifacts`
- fetches Mailchimp `import_jobs`
- computes connection state, authorization text, import history, counts, capability rows, timeline entries, and danger-zone copy
- sets `importFlowPath = /integrations/migrations?provider=${provider}`
- sets `previewListsPath = /integrations/migrations?provider=${provider}&step=choose`
- uses `created_at` as the effective start time for Mailchimp import history because `started_at` is not available in the current `import_jobs` schema
- disconnects Mailchimp by invoking `mailchimp-revoke-token`

`IntegrationDetailPage.tsx` Mailchimp rendering:

- metric cards show `Lists Available`, `Contacts Imported`, `Last Import`, and `Authorization`
- action menu includes `Start Import` and `Preview Lists`
- the detail overview shows `Authorization`, `Import History`, and `Recent Imports`
- the right column shows `Connection Details`, `Import Capabilities`, `Import Actions`, and a Mailchimp-specific danger zone
- the connection details panel includes a `Revoke Token` button when supported
- the import actions panel shows `Start Import` and `Preview Lists`
- if there is a completed import, it renders a compact summary line with imported count, relative time, duration, segments created, and error count
- if there is no completed import, it renders `No import history yet`

Resulting navigation reality:

- Mailchimp has a detail-first surface at `/integrations/mailchimp`
- that detail page then pushes users into the legacy wizard at `/integrations/migrations?provider=mailchimp`
- the hub still has a generic migration CTA that bypasses the Mailchimp detail page

## 19. Database Schema And Contracts

This section describes the current schema shape that the Mailchimp flow depends on most directly.

### provider_connections

Base creation came from `20251011201443_5f5027cf-b7e6-4dc1-ad49-a1608e9778c3.sql`.

Current relevant columns:

- `id`
- `tenant_id`
- `user_id`
- `provider`
- `encrypted_access_token`
- `token_expires_at`
- `provider_account_id`
- `provider_account_name`
- `metadata`
- `status`
- `connected_at`
- `revoked_at`
- `created_at`
- `updated_at`

Current provider/status constraints:

- provider check was expanded later to include `constant_contact`
- status check was normalized by MC-000 to: `pending`, `connected`, `expired`, `revoked`, `error`

Indexes and policies:

- indexes on `tenant_id` and `status`
- RLS enabled
- tenant-scoped `FOR ALL` policy based on `users.tenant_id` and `auth.uid()`
- `updated_at` trigger is present

### import_jobs

The original wizard migration created a richer table with fields like `provider_connection_id`, `job_type`, `selected_lists`, and `started_at`, but `20251012003118_c27ba10b-37be-46db-b561-c9658a27eaec.sql` replaced it with the simpler shape the current code actually uses.

Current core columns used by the Mailchimp flow:

- `id`
- `tenant_id`
- `user_id`
- `provider`
- `status`
- `config`
- `report`
- `completed_at`
- `created_at`
- `updated_at`
- `progress_percentage`
- `current_stage`
- `estimated_completion_at`
- `error_details`
- `batch_stats`
- `current_page`
- `total_pages_est`
- `fetched_rows`
- `inserted_rows`
- `skipped_rows`
- `failed_rows`
- `migration_job_id`

Important current constraints:

- provider check includes `mailchimp`, `klaviyo`, and later `constant_contact`
- status check on the recreated table is still the narrow set `pending`, `running`, `completed`, `failed`

Important implication:

- Older UI/helpers may reference richer or older status/state concepts, but the current table contract is simpler.
- `started_at` is not part of the current table, which is why Mailchimp history logic now falls back to `created_at`.

Indexes and runtime support:

- indexes on `user_id`, `tenant_id`, and `(user_id, status, created_at DESC)`
- RLS enabled
- select/insert/update policies scoped to tenant/user
- realtime enabled via `REPLICA IDENTITY FULL` and `supabase_realtime`
- helper SQL functions exist for progress updates and batch-error logging

### provider_artifacts

The current artifact table came from `20251012004307_11420691-7852-4969-a4f1-a883658b7e04.sql`.

Relevant columns:

- `id`
- `import_job_id`
- `tenant_id`
- `provider`
- `artifact_type`
- `external_id`
- `name`
- `member_count`
- `data`
- `embedding`
- `created_at`

Constraint evolution:

- later provider check includes `mailchimp`, `klaviyo`, and `constant_contact`
- MC-002 deduplicates existing duplicates and adds a unique constraint on `(tenant_id, provider, artifact_type, external_id)`

Mailchimp-specific artifact contract:

- Mailchimp list artifacts use Mailchimp list ids as `external_id`
- Mailchimp segment artifacts use `listId:segmentId`
- `data.parent_list_id` preserves list-to-segment relationship

Indexes and policies:

- indexes on `import_job_id` and `tenant_id`
- RLS enabled
- tenant-scoped `FOR ALL` artifact policy

### migration_jobs

`migration_jobs` came from `20251113221203_edffcd0b-5aea-4d28-bac7-d55e8e5c9046.sql`.

Relevant columns:

- `id`
- `tenant_id`
- `user_id`
- `source_platform`
- `job_type`
- `status`
- `progress_current`
- `progress_total`
- `progress_percentage`
- `started_at`
- `completed_at`
- `paused_at`
- `error_message`
- `metadata`
- `created_at`
- `updated_at`

This table is not the primary Mailchimp import source of truth, but it still powers:

- `useMigrationJobs`
- `MigrationStatusIndicator`
- `MailchimpStatusBadge`
- generic migration toasts and controls

Indexes and policies:

- indexes on tenant, user, status, and descending created date
- realtime enabled
- tenant-scoped RLS policies for select/insert/update

### CRM destination tables

`crm_customers`:

- created with a tenant-scoped unique key on `(tenant_id, email)`
- includes base identity fields plus `custom_fields`
- later migrations added many richer fields such as suppression flags, attribution fields, opt-out timestamps, consent detail JSON, and other profile columns
- current Mailchimp import only writes a narrow subset directly

`crm_segments`:

- created as a tenant-scoped segment table
- MC-000 adds `source` and `source_id`
- unique partial index on `(tenant_id, source, source_id)` where both are non-null
- Mailchimp uses this for imported segments

`customer_segments`:

- many-to-many join table between customers and segments
- unique `(customer_id, segment_id)`
- explicit FK from `segment_id` to `crm_segments(id)` added by MC-000

`customer_consents`:

- unique `(customer_id, channel)`
- stores channel and consent status per customer

`suppression_list`:

- tenant-scoped suppression records with email/phone/channel/reason
- active suppression index on `(tenant_id, channel)` where `lifted_at IS NULL`

`crm_tags` and `customer_tags`:

- `crm_tags` is unique per `(tenant_id, name)`
- `customer_tags` uses a composite primary key of `(contact_id, tag_id)`

`customer_sources`:

- tracks source provenance for imported customers
- unique `(customer_id, source_type)`
- later source-type constraint includes `mailchimp`, `klaviyo`, `constant_contact`, `csv`, `manual`, `pos`, and `api`

### Overall schema summary

The current Mailchimp flow relies on a mixed schema history:

- some original wizard tables were simplified later
- progress and resumability fields were added after that simplification
- generic migration tables still coexist with Mailchimp-specific import tables
- UI code sometimes reflects both old and new assumptions

## 20. Known Issues, Gaps, And Architectural Mismatches

The current system works, but several mismatches are visible in the code.

1. Route inconsistency: Mailchimp has a detail-first route (`/integrations/mailchimp`), but the featured migration CTA still goes to `/integrations/migrations` and bypasses the detail page.
2. Connection-state inconsistency: `MailchimpStatusBadge` infers `Connected` from the latest `migration_jobs` row, not from `provider_connections`.
3. OAuth callback security mismatch: `OAuthCallbackHandler` uses `postMessage(..., '*')` in the server-redirect branch.
4. OAuth error redirect mismatch: `migrations-oauth-callback` hardcodes `provider=mailchimp` on error.
5. Wizard-step mismatch: Analyze and Apply are still in the main path, even though the import flow is otherwise scoped around lists, segments, validation, and import.
6. Apply-step copy mismatch: `ApplyStep.tsx` describes high-confidence mappings as auto-applied while code comments say application really happens later.
7. Connect-step unlock mismatch: `Continue` can become enabled based on any connected provider, not necessarily the chosen provider.
8. Preview-scope mismatch: preview uses only the first selected list when multiple lists are chosen and no segments are selected.
9. Abandoned-job leakage: `MigrationsPage.tsx` creates `import_jobs` on choose completion with no cleanup path if the user abandons the flow.
10. Hidden cache-job smell: `mailchimp-fetch-lists` may create a hidden completed `import_jobs` row just to satisfy the artifact schema.
11. Status-model mismatch: some UI helpers handle statuses like `cancelled`, `queued`, and `processing`, while current `import_jobs` schema is constrained to a smaller status set.
12. Progress-system duplication: `useImportProgress` and `ImportProgressDialog` both implement import-job subscriptions separately.
13. Import control mismatch: generic migration controls expose pause/resume/cancel on `migration_jobs`, but the Mailchimp import dialog itself has no cancel action.
14. Data-shape mismatch: the current import writes core identity rows directly to `crm_customers`, while richer consent and suppression snapshot columns on `crm_customers` are not populated by the current helper.
15. Preview duplicate estimation is sample-based, not exact.
16. Validation does not fail duplicates; it only reports validation problems.

None of these issues make the system unusable, but they matter for any cleanup or rebuild because they explain why the UI can feel more complex or inconsistent than the happy-path demo flow suggests.

## 21. Complete End-To-End User Journey

This is the actual end-to-end Mailchimp journey across the current surfaces.

### Entry paths

A user can arrive through any of these routes:

- `/integrations` hub card that targets `/integrations/mailchimp`
- `/integrations` featured `Data Migration Tool` card that targets `/integrations/migrations`
- `/crm/integrations` Mailchimp card that targets `/integrations/mailchimp`
- a direct deep link to `/integrations/mailchimp`

### Detail-first path

If the user lands on `/integrations/mailchimp`:

1. `IntegrationDetailPage.tsx` asks `useIntegrationDetailData.ts` for the Mailchimp marketing-import model.
2. The hook loads the latest Mailchimp `provider_connections` row, cached `provider_artifacts`, and Mailchimp `import_jobs`.
3. The page shows authorization state, cached list/segment counts, recent import history, capabilities, and danger-zone copy.
4. The user can click `Start Import`, which navigates to `/integrations/migrations?provider=mailchimp`.
5. The user can also click `Preview Lists`, which navigates to `/integrations/migrations?provider=mailchimp&step=choose`.

### Connect flow

Inside `ConnectStep.tsx`:

1. The user clicks Mailchimp connect.
2. The frontend invokes `oauth-authorize` with `{ provider: 'mailchimp' }`.
3. `oauth-authorize` returns `{ authUrl, state }`.
4. The frontend opens a popup to the Mailchimp authorization page.
5. Mailchimp redirects the popup to `migrations-oauth-callback`.
6. The callback verifies state, exchanges the code for a token, fetches Mailchimp metadata, encrypts the token, upserts `provider_connections`, and background-invokes `mailchimp-fetch-lists` with `preCache: true`.
7. The callback redirects the popup to `/oauth/callback?provider=mailchimp&status=success`.
8. `OAuthCallbackHandler.tsx` posts a success message back to the opener and tries to close the popup.
9. `ConnectStep.tsx` receives the message, updates local provider connection state, and lets the user continue.

### Selection and job creation

1. `ChooseStep.tsx` loads Mailchimp lists and segments through `mailchimp-fetch-lists`.
2. The user selects one or more lists and/or segments.
3. When they continue, `MigrationsPage.tsx` inserts an `import_jobs` row with `status = 'pending'` and `config = selection`.
4. The new `jobId` becomes the source of truth for later preview/import steps.

### Preview and optional AI steps

1. `PreviewStep.tsx` invokes `mailchimp-fetch-preview` with the saved `jobId`.
2. The preview shows sample contacts, import estimates, and CRM duplicate hints.
3. The wizard then continues through `AnalyzeStep.tsx` and `ApplyStep.tsx`, even though those steps are not deeply Mailchimp-specific.

### Validation and import start

1. `ImportStep.tsx` invokes `mailchimp-validate`.
2. If validation succeeds, `ImportStep.tsx` invokes `mailchimp-import`.
3. `mailchimp-import` quickly returns `202`, then continues the real work in the background.
4. `ImportStep.tsx` opens `ImportProgressDialog` immediately.

### Background processing

1. `mailchimp-import` ensures a related `migration_jobs` row exists.
2. It builds work items from selected lists and selected segments.
3. For each work item, it fetches Mailchimp members, batches them, upserts CRM customers, records consents, writes suppressions, creates tags, writes source records, creates Mailchimp-backed CRM segments, and links customers to those segments.
4. It continuously updates `import_jobs` progress fields and generic `migration_jobs` progress.
5. The progress dialog listens to `import_jobs` realtime updates and also polls every 2 seconds.

### Completion

1. When the import completes, `mailchimp-import` writes the final report to `import_jobs.report`, marks both job tables completed, and sets the final counts.
2. `ImportProgressDialog` detects completion and calls `onComplete` after a short delay.
3. The wizard advances to `ReportStep.tsx`.
4. `ReportStep.tsx` renders imported/skipped/failed counts, segments/tags/consents counts, and any errors.

### Post-import and disconnect

After completion, the user can:

- return to `/integrations/mailchimp` and see updated import history and totals
- download the report from `ReportStep.tsx`
- revoke Mailchimp from the detail page or report flow

If they revoke Mailchimp:

1. the UI invokes `mailchimp-revoke-token`
2. the backend revokes the Mailchimp token and clears `provider_artifacts`
3. `provider_connections.status` becomes `revoked`
4. imported CRM data remains in place

### What a rebuild should preserve

If this flow is rebuilt, the essential functional contracts to preserve are:

- Mailchimp OAuth connection stored in `provider_connections`
- composite Mailchimp segment ids of `listId:segmentId`
- cached list/segment metadata in `provider_artifacts`
- import-run progress in `import_jobs`
- CRM writes across customers, consents, suppressions, tags, sources, and CRM segments
- a final report object with the same normalized keys used by `ReportStep.tsx`

Everything else is negotiable, especially the duplicated status surfaces, hidden cache-job workaround, and the legacy/generic route split.