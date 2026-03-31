# Mailchimp Architecture Decisions

Status: Approved for MC-000

Scope boundary: MC-000 records the approved Mailchimp architecture decisions, normalizes the schema contracts that the backend functions, detail page, migrations, and generated types currently disagree on, and adds shared contract types. MC-000 does not rewrite Mailchimp runtime behavior, frontend behavior, OAuth behavior, import execution behavior, or provider adapter behavior.

## Prerequisite

The Mailchimp codebase audit is the basis for these decisions. The repo currently contains overlapping assumptions across edge functions, the shared integration detail shell, migrations, and generated database types:

- selected `segmentIds` are collected in the wizard but not enforced during Mailchimp import
- the detail page counts lists and segments from `provider_artifacts`, but the active Mailchimp flow does not populate `provider_artifacts`
- import report payloads are not normalized across providers and do not match the detail hook's expectations
- the Mailchimp disconnect flow uses `disconnected`, while the base schema contract allows `connected`, `expired`, `revoked`, and `error`
- resumability and queue-progress expectations are not fully encoded in `import_jobs`
- there is no shared Mailchimp adapter abstraction yet
- the existing CRM segment tables are missing provider-source metadata and one explicit segment foreign key relationship

MC-000 resolves those ambiguities before any Mailchimp runtime code is rewritten.

## Decision 1: Import Scope Uses Lists And Segments

Decision: Segment selection in the migration wizard must filter contacts during import.

Rules:

- if `segmentIds` is empty or null, importing a list means importing all members of that list
- if `segmentIds` contains values, the import must fetch segment members for those selected segments and import only those members
- records fetched from multiple selected segments must be deduplicated by normalized email before writing to BloomSuite

Mailchimp API contract:

```text
GET /lists/{listId}/members?count=100&offset={n}
GET /lists/{listId}/segments/{segmentId}/members?count=100&offset={n}
```

MC-000 records this contract only. The runtime import rewrite belongs to a later milestone.

## Decision 2: provider_artifacts Is A Required Cache Surface

Decision: `mailchimp-fetch-lists` must populate `provider_artifacts` after fetching Mailchimp lists and segments.

Rules:

- one `provider_artifacts` row per Mailchimp list with `artifact_type = 'list'`
- one `provider_artifacts` row per Mailchimp segment with `artifact_type = 'segment'`
- persisted fields include `external_id`, `name`, `member_count`, and `data` containing the provider response payload

Reasoning:

- the shared integration detail hook already derives list and segment counts from `provider_artifacts`
- a non-populated artifact cache causes the detail page to report zero lists and zero segments even when the provider is connected

MC-000 records the requirement and leaves the runtime write-path implementation to a later milestone.

## Decision 3: ImportReport Is Normalized Across Marketing Import Providers

Decision: Marketing-import providers must produce the same report payload contract.

Canonical interface:

```typescript
interface ImportReport {
  contacts_imported: number;
  contacts_skipped: number;
  contacts_failed: number;
  segments_created: number;
  tags_created: number;
  consents_recorded: number;
  errors: string[];
  batches_processed: number;
}
```

Rules:

- `errors` is an array of error messages, not a numeric count
- `segments_created` is the canonical key, not `segments_imported`
- Mailchimp, Klaviyo, and Constant Contact must converge on this same contract

MC-000 defines the shared type and records the contract. Runtime producers are updated in later milestones.

## Decision 4: Disconnect Uses revoked

Decision: Disconnecting Mailchimp sets `provider_connections.status = 'revoked'`.

Rules:

- `provider_connections.revoked_at` is set to the disconnect timestamp
- `provider_connections.encrypted_access_token` is cleared after provider revocation
- Mailchimp access tokens must be revoked at `https://login.mailchimp.com/oauth2/revoke` before local token removal
- `disconnected` is not a valid `provider_connections.status` value in the normalized contract

MC-000 normalizes the schema contract only. The runtime revoke implementation is updated later.

## Decision 5: Large Imports Use Queue-Backed Resumable import_jobs

Decision: Mailchimp imports run as paginated, resumable, queue-backed jobs using `import_jobs` for state and Supabase Realtime for progress.

Rules:

- fetch 100 contacts per page
- persist `current_page` in `import_jobs` after each batch
- store running row counters in `import_jobs`
- update `progress_percentage`, `current_stage`, and `batch_stats` after each batch
- resume from the last stored page if a worker invocation is interrupted

Expected scale contract:

| Audience size | Pages | Estimated duration |
| --- | --- | --- |
| 1,000 contacts | 10 | < 1 minute |
| 10,000 contacts | 100 | 3–8 minutes |
| 100,000 contacts | 1,000 | 30–60 minutes |
| 500,000 contacts | 5,000 | 3–6 hours |

MC-000 adds the resumability columns to `import_jobs`. The runtime queue implementation remains for later milestones.

## Decision 6: Mailchimp API Calls Must Be Encapsulated In A Shared Client

Decision: Mailchimp API access is centralized in `supabase/functions/_shared/mailchimp/MailchimpClient.ts`.

Required responsibilities:

- inject Mailchimp authorization headers consistently
- derive the Mailchimp data center from `metadata.dc` or `metadata.api_endpoint`
- build the canonical base URL: `https://{dc}.api.mailchimp.com/3.0/`
- handle 429 responses using `Retry-After` when present, or a 60-second fallback
- expose offset-based pagination helpers
- normalize provider API errors into a shared shape

MC-000 records the adapter boundary only. The client implementation belongs to a later milestone.

## Decision 7: Selected Mailchimp Segments Become BloomSuite CRM Segments

Decision: When Mailchimp segments are selected for import, BloomSuite creates and reuses corresponding CRM segments.

Rules:

- `crm_segments` stores provider-sourced segment metadata through `source` and `source_id`
- provider-created Mailchimp segments use `source = 'mailchimp'`
- segment uniqueness is tenant-scoped on `(tenant_id, source, source_id)`
- `customer_segments` links imported customers to those CRM segments
- `segments_created` in `ImportReport` counts CRM segments created during the import

Important modeling note:

- `crm_segments` and `customer_segments` already exist in this repo as shared CRM tables
- MC-000 extends those tables instead of creating parallel Mailchimp-only segment tables

## Schema Notes For MC-000

MC-000 uses additive schema changes only.

`import_jobs` additions:

- `current_page`
- `total_pages_est`
- `fetched_rows`
- `inserted_rows`
- `skipped_rows`
- `failed_rows`

`provider_connections` normalization:

- normalized status values: `pending`, `connected`, `expired`, `revoked`, `error`
- `disconnected` is not part of the allowed schema contract

`crm_segments` additions:

- `source`
- `source_id`
- tenant-scoped uniqueness for provider-sourced segments

`customer_segments` normalization:

- explicit foreign key from `segment_id` to `crm_segments(id)`

Generated types are part of the deliverable because they are one of the contract layers that previously drifted from the live schema.

## MC-000 Acceptance Mapping

This milestone is complete only when:

- this document exists and records all seven approved decisions
- a schema-only migration adds the six resumability columns to `import_jobs`
- the `provider_connections` status contract excludes `disconnected`
- `crm_segments` includes provider-source metadata needed for Mailchimp-created segments
- `customer_segments.segment_id` has an explicit foreign key to `crm_segments(id)`
- `supabase/functions/_shared/mailchimp/types.ts` exports the normalized `ImportReport` interface
- generated database types reflect the new schema contract
- no runtime Mailchimp behavior is rewritten yet

## Explicit Non-Goals

MC-000 does not implement:

- Mailchimp segment-member import logic
- Mailchimp `provider_artifacts` write behavior
- Mailchimp adapter runtime code
- Mailchimp import report producer changes
- Mailchimp revoke-flow runtime changes
- frontend wizard changes
- frontend detail-page changes
- progress hook changes
- test expansion beyond basic contract validation needed for the schema and type changes

Those belong to later milestones.