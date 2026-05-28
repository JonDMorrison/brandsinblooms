# BLOOM-M04: Basic Query Tools Implementation

> **Copilot Thinking Effort:** XHigh
> **Branch:** `feature/bloom-assist`
> **Phase:** 1 — Foundation
> **Milestone:** 4 of 40

---

## Objective

Implement the core query tools that let Bloom read CRM data: customers, products, campaigns, segments, and orders. Each tool queries the real CRM tables using the exact same patterns as the existing hooks (`useCRMCustomers`, `useProducts`, `useCampaigns`, `useSegments`, `useIntegrationDetailData`). All queries scope by `tenant_id` and use the composable filter engine from BLOOM-M03.

---

## Scope

### Tool Implementations in `supabase/functions/bloom-assist/tools/implementations/`

**`query-customers.ts`**
- Queries `crm_customers` with `.eq("tenant_id", tenantId)`
- Supports filters on: `first_name`, `last_name`, `email`, `phone`, `total_spent`, `last_purchase_date`, `created_at`, `sms_opt_in`, `email_opt_in`, `signup_source`, `preferred_channel`, `city`, `state_region`, `postal_code`
- Supports junction filters for personas (via `customer_personas`), segments (via `customer_segments`), tags (via `customer_tags` → `crm_tags`)
- Select includes: id, first_name, last_name, email, phone, total_spent, last_purchase_date, created_at, persona (joined), segments (joined), tags (joined)
- Pagination: `page` (default 1), `page_size` (default 10, max 50)
- Sort: `sort_by` (any filterable field), `sort_order` (asc/desc)
- Returns `block_type: "data_table"` for 2+ results, `"data_card"` for 1 result
- Follows the exact query pattern from `src/hooks/useCRMCustomers.ts` and `src/hooks/useCustomers.ts`

**`query-products.ts`**
- Queries `products` — relies on RLS for tenant scoping (matching existing `useProducts` behavior, no explicit `.eq("tenant_id")` on reads)
- Supports filters on: `name`, `sku`, `status` (enum: active/draft/archived), `source` (enum: platform/square/stripe/shopify/lightspeed/import), `price`, `inventory_count`, `is_featured`, `track_inventory`
- Select includes: id, name, sku, status, source, price, compare_at_price, currency, inventory_count, track_inventory, is_featured, created_at
- Follows the exact query pattern from `src/hooks/useProducts.ts`

**`query-campaigns.ts`**
- Queries `crm_campaigns` with `.eq("tenant_id", tenantId)`
- Supports filters on: `name`, `subject`, `status`, `created_at`, `scheduled_at`, `sent_at`, `segment_id` (via `campaign_segments`), `user_id`
- Supports metrics filters: `open_rate`, `click_rate`, `delivered_count` (from JSONB `metrics` column)
- Select includes: id, name, subject, status, scheduled_at, sent_at, metrics, segment info (joined), created_at
- Follows the query pattern from `src/pages/crm/CRMCampaignsPage.tsx`

**`query-segments.ts`**
- Queries `crm_segments` with `.eq("tenant_id", tenantId)`
- Supports filters on: `name`, `type` (dynamic/static), `status`, `customer_count`
- Select includes: id, name, type, status, customer_count, rules, created_at
- Follows the pattern from `src/hooks/useSegments.ts`

**`query-orders.ts`**
- **CRITICAL: No unified orders table exists.** Must aggregate across provider-specific tables:
  - `pos_orders` (Square/Clover)
  - `shopify_orders` (Shopify)
  - `lightspeed_sales` (Lightspeed)
- Check which providers are connected for this tenant via `provider_connections` or equivalent
- Query connected provider tables, normalize results into common shape: `{ id, source, customer_email, total, status, items_count, created_at }`
- Follows the read patterns from `src/hooks/useIntegrationDetailData.ts`

**`get-customer-detail.ts`**
- Single customer by ID with full data: all fields + joined personas, segments, tags, purchase metrics, email/SMS consent status
- Returns `block_type: "data_card"`

**`get-product-detail.ts`**
- Single product by ID with full data: all fields + variations + images
- Returns `block_type: "data_card"`

**`get-segment-members.ts`**
- Queries `customer_segments` → `crm_customers` for a specific segment ID
- Paginated member list with customer details
- Follows the pattern from `src/hooks/useSegmentMembers.ts`

---

## Security Guarantees

- Every query scopes by `tenant_id` (except products which use RLS)
- Junction table queries (personas, segments, tags) are always double-scoped: the parent entity is tenant-scoped AND the junction record is validated
- Order queries only return data from providers connected to this tenant
- No raw SQL — all queries use Supabase query builder
- Query results never include internal metadata (user_id of creator, RLS policy details)

---

## Acceptance Criteria

- [ ] `query_customers` returns paginated, filtered, sorted results from `crm_customers` with persona/segment/tag joins
- [ ] `query_products` works with RLS (no explicit tenant filter) matching `useProducts` behavior
- [ ] `query_campaigns` returns campaigns with segment info and metrics from JSONB
- [ ] `query_segments` returns segments with member counts
- [ ] `query_orders` aggregates across connected provider tables and normalizes the shape
- [ ] `get_customer_detail` returns full customer with all joined data
- [ ] `get_product_detail` returns product with variations and images
- [ ] `get_segment_members` returns paginated member list
- [ ] All tools return correct `block_type` (data_card vs data_table) based on result count
- [ ] All tools respect the composable filter engine from BLOOM-M03
- [ ] All tools log execution to `bloom_tool_executions`
- [ ] No `site_id` references anywhere

---

## What NOT To Do

- Do NOT write raw SQL — use Supabase query builder
- Do NOT create a unified `orders` table — query provider-specific tables as they exist
- Do NOT add explicit `.eq("tenant_id")` to product queries — products use RLS
- Do NOT return internal fields like `user_id`, `claim_token`, `metrics_parity_snapshot` in campaign results
- Do NOT implement mutation tools in this milestone — queries only
- Do NOT generate test files or documentation
