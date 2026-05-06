# supabase/seeds

Internal-only seed files for the BloomSuite Supabase project. Each file
in this directory is a one-shot demo data setup that should never run
against a customer-facing environment.

## Hard rules

1. **Production project only.** These seeds are written against
   project ref `udldmkqwnxhdeztyqcau` (the BloomSuite production
   instance). They reference UUIDs and `auth.users` rows that only
   exist there. Do not run them against the local Supabase emulator,
   the staging branch, or any other Supabase project.
2. **Never link a demo tenant to Stripe.** No demo seed in this
   directory creates a `subscriptions` row, a Stripe customer, or
   a Stripe subscription_id. The plan label lives in
   `tenants.settings->>'subscription_plan'` only — purely
   display-side. If a demo tenant ever needs upgrading to a real
   billing relationship, archive it and create a fresh
   non-demo tenant instead.
3. **Use the service-role key to apply.** Demo seeds bypass standard
   RLS policies for performance. Run them via the Supabase MCP
   `execute_sql` tool, the dashboard SQL editor, or
   `npx supabase db execute --project-ref ... --file ...` — all of
   which are authenticated with the service role.
4. **Demo tenants must be visually unmistakable.** The slug should
   contain `-demo`, the name should be a fictional business
   ("Greenfield Garden Centre", not "Burnett's"), and the settings
   jsonb should carry `is_demo: true` so future automation can filter
   demo rows out of customer-facing surfaces.

## Files

### `demo-tenant-greenfield.sql`

Seeds a "Greenfield Garden Centre" demo tenant for homepage hero
screenshot capture and internal sales demos.

**What it creates**

- `app_admin_emails` row for `jon@brandsinblooms.com` so Jon can use
  the master-admin tenant switcher to access the demo tenant. (The
  BloomSuite data model is single-tenant per `public.users` row, so
  the master-admin path is the only way to give Jon access to a
  second tenant without breaking his primary workspace.)
- `tenants` row: name "Greenfield Garden Centre", slug
  "greenfield-demo", settings jsonb tagged `is_demo: true`,
  `is_internal: true`, `hidden_from_lists: true`,
  `subscription_plan: bloom`, located in Vancouver, BC, Canada.
- ~9,500 `crm_customers` with realistic Canadian first/last names,
  unique `@greenfield-demo.test` emails, BC/AB/ON-biased provinces,
  18-month created_at distribution with seasonal weighting, and
  ~63% with realistic last_purchase_date + total_spent for the
  revenue trendline.
- 5 `crm_segments` (auto_update=false so the recompute worker
  cannot drop the seeded memberships): VIP Buyers (950), This
  Season's Customers (~3,200), Lapsed 12+ months (1,800), Email
  Subscribers (7,200), Birthday Club (2,400). Memberships
  populated in `customer_segments`.
- 3 `crm_campaigns` in non-triggering states:
  - **Mother's Day Hanging Baskets** — `status='sent'` (terminal,
    no claim worker re-fires), sent ≈ 21 days ago, total_sent=7100,
    open_rate=32.4%, click_rate=6.1%.
  - **Spring Perennial Sale** — `status='draft'` with
    `scheduled_at` 5 days out. Surfaces as upcoming on the
    dashboard without firing `claim_scheduled_campaigns_rpc`.
  - **Patio Season Kickoff** — pure draft.
  - All three: `auto_send_enabled=false`.

**What it does NOT touch**

- No rows are inserted into `email_send_jobs`, `email_messages`,
  `sms_messages`, `sms_send_jobs`, `pos_orders`, `shopify_orders`,
  or any worker-claimed queue table.
- No `subscriptions` row. No Stripe.
- No existing tenants, customers, segments, campaigns, or
  customer_segments rows are modified. Every INSERT and UPDATE in
  the seed is scoped to the new `greenfield-demo` tenant_id.

**Apply**

Via Supabase MCP:

```
execute_sql(project_id="udldmkqwnxhdeztyqcau",
            query="<contents of demo-tenant-greenfield.sql>")
```

Via CLI:

```
npx supabase db execute \
  --project-ref udldmkqwnxhdeztyqcau \
  --file supabase/seeds/demo-tenant-greenfield.sql
```

The seed is wrapped in a single `BEGIN; ... COMMIT;` so partial
state is impossible. It is **NOT** idempotent — re-running will
fail on the unique `tenants.slug` constraint. Rollback first if
you need to re-seed.

**Rollback**

Paste this block into the Supabase SQL editor (FK chain order
matters):

```sql
BEGIN;

DELETE FROM customer_segments
 WHERE segment_id IN (
   SELECT id FROM crm_segments
    WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'greenfield-demo')
 );

DELETE FROM crm_segments
 WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'greenfield-demo');

DELETE FROM crm_campaigns
 WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'greenfield-demo');

DELETE FROM crm_customers
 WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'greenfield-demo');

DELETE FROM tenants WHERE slug = 'greenfield-demo';

DELETE FROM app_admin_emails WHERE email = 'jon@brandsinblooms.com';

COMMIT;
```

The last DELETE removes Jon's master-admin grant added by the
seed. Skip that line if you want him to keep app-admin access for
other reasons.
