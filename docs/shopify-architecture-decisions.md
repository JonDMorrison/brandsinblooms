# Shopify Architecture Decisions

Status: Approved for SH-000

Scope boundary: SH-000 records decisions, adds schema for the new first-class Shopify integration, and marks losing legacy paths as deprecated. SH-000 does not add any new Shopify sync implementation, OAuth implementation, webhook handler implementation, or frontend feature work. SH-000 also does not remove or hide any legacy Shopify UI surfaces.

## Prerequisite

The Shopify codebase audit is the basis for these decisions. The repo currently contains overlapping Shopify paths with incompatible assumptions:

- a dedicated `shopify-sync` edge function that writes customer data into `crm_customers`
- a Shopify branch inside `pos-sync` that writes customer data into `pos_customers`
- legacy manual-token frontend flows that still expose Shopify as a connectable POS source

This milestone resolves those ambiguities before any new first-class Shopify code is written.

## Decision 1: Canonical Backend Sync Path

Decision: The new first-class Shopify integration will use a brand-new `shopify-full-sync` edge function modeled after `lightspeed-full-sync` and backed by `pos_sync_jobs_v2`.

Implications:

- `supabase/functions/shopify-sync/index.ts` is deprecated legacy code
- the Shopify branch in `supabase/functions/pos-sync/index.ts` is deprecated legacy code
- neither legacy path is a valid foundation for the new integration
- the new path must be queue-backed to support large Shopify stores and progress tracking

Legacy status policy:

- SH-000 marks both legacy backend paths as deprecated
- SH-000 does not delete those paths yet
- deletion happens only after SH-003 removes the legacy Shopify UI surfaces that can still invoke them

## Decision 2: Canonical Customer Table Strategy

Decision: New Shopify sync writes to both canonical and provider-specific destinations:

- canonical CRM destination: `crm_customers`
- provider-specific destination: `shopify_customers`

Decision detail:

- `pos_customers` is not the target for the new Shopify integration
- Shopify follows the same normalized pattern established by Lightspeed: provider-specific storage plus CRM-facing canonical storage

## Decision 3: Canonical Auth Method

Decision: New Shopify connections use OAuth only.

Rules:

- manual private-app token entry is retired for new first-class Shopify connections
- existing legacy manual-token connections are grandfathered only until SH-003 hides the old UI surfaces
- new Shopify code must not rely on the legacy `credentials_encrypted` JSON-stringified manual-token contract

Reasoning:

- manual private-app tokens are not the long-term recommended Shopify integration pattern
- OAuth aligns with Partner Dashboard app management and scoped installs
- the current legacy credential storage naming is misleading because the payload is serialized JSON, not guaranteed encrypted material

Required OAuth scopes:

```text
read_customers
read_orders
read_products
read_inventory
read_fulfillments
```

## Decision 4: Webhook Strategy

Decision: Shopify webhooks are merchant-scoped and will be registered programmatically after OAuth using the Shopify Admin API.

Rules:

- webhook registration occurs after OAuth token storage
- webhook routing follows the same per-store principle used by Lightspeed
- webhook verification uses HMAC-SHA256 with the Shopify app `client_secret`
- webhook state must be stored on `shopify_connections`

Implementation contract:

- BloomSuite users never manually configure Shopify webhooks
- the future OAuth callback must call the Shopify webhook ensure/subscription path automatically
- SH-000 records this requirement but does not implement the callback or webhook code yet

## Decision 5: Data Model For New Shopify Tables

Decision: The new first-class Shopify integration uses four new tables:

- `shopify_connections`
- `shopify_customers`
- `shopify_orders`
- `shopify_products`

Rules:

- all four tables must include mandatory `tenant_id`
- all four tables must have RLS enabled
- SH-000 adds SELECT policies only; service-role/backend functions own write paths
- legacy `pos_connections` rows where `platform = 'shopify'` are not migrated automatically in SH-000
- those legacy rows remain historical/legacy data until the old UI is retired

Schema conventions:

- mirror the proven Lightspeed provider-table pattern where it fits
- keep Shopify-specific business fields where the provider payload requires them
- do not use `pos_customers` as a first-class Shopify destination

Important schema guardrail:

- do not encode `REFERENCES users(tenant_id)` as a foreign key just because it appears in example text
- this repo resolves tenant access through `public.users.id -> tenant_id` in RLS policies
- new provider tables should follow the repo’s valid tenant modeling patterns rather than introducing an invalid tenant foreign key

Practical modeling for SH-000:

- `shopify_connections.tenant_id` is mandatory and tenant-scoped, following the connection-table pattern already used by Lightspeed
- `shopify_customers`, `shopify_orders`, and `shopify_products` use tenant-scoped provider-table modeling consistent with existing provider sync tables

## Decision 6: Legacy Surface Retirement Timeline

Decision: Legacy Shopify connection surfaces are hidden in SH-003 and deleted only after the new first-class integration ships and a 30-day soak period passes.

SH-003 hide list:

- `src/components/crm/pos/POSConnectionForm.tsx`
- `src/components/crm/pos/POSSetupWizard.tsx`
- `src/components/crm/pos/POSPlatformPicker.tsx`
- `src/pages/crm/POSIntegrations.tsx`
- `src/pages/settings/POSPage.tsx`
- `src/components/settings/ConnectionsSettings.tsx`

Rules:

- SH-000 leaves these files unchanged
- SH-003 will hide Shopify through a feature flag or single legacy deprecation constant
- full code deletion waits until post-launch soak confirms the new Shopify integration is stable

## Schema Notes For SH-000

The new migration created in SH-000 should follow these repo-valid conventions:

- `shopify_connections` mirrors `lightspeed_connections` and later webhook-health additions
- `shopify_customers`, `shopify_orders`, and `shopify_products` mirror the Lightspeed provider-table pattern
- webhook health columns should align with the POS integration contract and existing Lightspeed webhook-health semantics
- Shopify may require `webhook_subscription_ids JSONB` rather than a single subscription id because multiple subscriptions may exist per store

Expected webhook health fields on `shopify_connections`:

- `webhooks_subscribed`
- `webhook_subscription_ids`
- `webhooks_last_checked_at`
- `webhook_last_error`
- `last_webhook_received_at`
- `webhook_retry_count`
- `webhook_next_retry_at`

## External Prerequisites

These acceptance items cannot be fully verified from repository code alone and must be checked operationally:

1. A Shopify app exists in the Shopify Partner Dashboard for the new OAuth flow.
2. That app is configured with these scopes:

```text
read_customers
read_orders
read_products
read_inventory
read_fulfillments
```

3. `SHOPIFY_CLIENT_ID` is configured as a Supabase secret.
4. `SHOPIFY_CLIENT_SECRET` is configured as a Supabase secret.

Current status in SH-000 planning: not verified from the current workspace environment.

## SH-000 Acceptance Mapping

This milestone is complete only when:

- all six decisions are captured in this document
- `shopify-sync/index.ts` is marked deprecated
- the Shopify branch inside `pos-sync/index.ts` is marked deprecated
- a schema-only migration creates `shopify_connections`, `shopify_customers`, `shopify_orders`, and `shopify_products`
- all four tables have RLS enabled and tenant-scoped SELECT policies
- no new Shopify sync code is introduced yet
- no legacy Shopify frontend surfaces are hidden or removed yet

## Explicit Non-Goals

SH-000 does not implement:

- `shopify-full-sync`
- Shopify OAuth start/callback functions
- Shopify webhook handlers
- Shopify webhook subscription helper functions
- legacy surface hiding
- legacy code deletion
- migration of old `pos_connections` Shopify rows into `shopify_connections`

Those belong to later milestones.