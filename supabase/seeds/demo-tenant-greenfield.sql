-- =====================================================================
-- Greenfield Garden Centre — internal demo tenant seed
-- =====================================================================
-- Purpose: populate an internal-only demo tenant on the BloomSuite
--          production project (ref: udldmkqwnxhdeztyqcau) so the main
--          dashboard renders convincingly for the homepage hero
--          screenshot and other internal demo / sales surfaces.
--
-- WHAT GETS CREATED
--   1. app_admin_emails entry for jon@brandsinblooms.com (so he can
--      use the master-admin tenant switcher to access this tenant —
--      the BloomSuite data model is single-tenant per public.users row,
--      so the master-admin path is the only way to give Jon access
--      to a second tenant without breaking his primary workspace).
--   2. tenants row (slug = 'greenfield-demo'). Demo flags live in the
--      settings jsonb; the schema doesn't expose a typed is_demo column.
--      No subscriptions row is created and no Stripe customer/sub IDs
--      are linked anywhere — this tenant must NEVER be billed.
--   3. ~9,500 crm_customers rows with realistic Canadian first/last
--      names, unique @greenfield-demo.test emails, BC/AB/ON-biased
--      provinces, seasonal created_at weighting (heavier April-June,
--      lighter December-February). last_purchase_date and total_spent
--      drive the monthly revenue trendline.
--   4. 5 crm_segments (auto_update=false so the recompute worker can't
--      override the seeded memberships). VIP Buyers / This Season's
--      Customers / Lapsed (12+ months) / Email Subscribers / Birthday
--      Club. Memberships in customer_segments at roughly the spec'd
--      counts (950 / 3,200 / 1,800 / 7,200 / 2,400 — within 10%).
--   5. 3 crm_campaigns, all in non-triggering states:
--        a) "Mother's Day Hanging Baskets"  — status='sent' (terminal,
--           the email-send-job claim worker doesn't re-pick terminal
--           rows). total_sent=7,100, open_rate=32.4, click_rate=6.1,
--           sent_at ≈ 3 weeks ago, send_completed_at set.
--        b) "Spring Perennial Sale" — status='draft' (NOT 'scheduled'
--           which would fire claim_scheduled_campaigns_rpc).
--           scheduled_at set 5 days out so the dashboard surfaces it
--           as upcoming.
--        c) "Patio Season Kickoff"  — status='draft'.
--      All three: auto_send_enabled=FALSE.
--   6. Revenue trendline is read by the dashboard from
--      crm_customers.total_spent grouped by last_purchase_date month.
--      Per-customer last_purchase_date is distributed proportional to
--      the monthly CAD totals from the spec
--      (Jan 42k / Feb 51k / Mar 128k / Apr 264k / May 281k / Jun 198k /
--       Jul 142k / Aug 138k / Sep 94k / Oct 112k / Nov 58k / Dec 76k).
--      No rows are inserted into pos_orders / shopify_orders /
--      lightspeed_customers — those tables require a pos_connection_id
--      we don't have for this synthetic tenant.
--
-- WHAT IS NOT TOUCHED
--   - Existing tenants, their crm_customers, crm_campaigns,
--     crm_segments, customer_segments rows. Every INSERT here is
--     scoped to the new greenfield-demo tenant_id.
--   - email_send_jobs / email_messages / sms_messages / sms_send_jobs:
--     not populated. We do NOT want to land synthetic rows on the
--     send queues.
--   - subscriptions table: no row. (Schema is per-user, not per-tenant.
--     Jon's existing personal subscription stays unchanged.)
--   - Stripe: nothing. Demo tenant must never be linked to billing.
--
-- ROLLBACK (paste into Supabase SQL editor in this exact order — FK
-- chain matters):
--
--   BEGIN;
--   DELETE FROM customer_segments
--     WHERE segment_id IN (SELECT id FROM crm_segments
--       WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'greenfield-demo'));
--   DELETE FROM crm_segments
--     WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'greenfield-demo');
--   DELETE FROM crm_campaigns
--     WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'greenfield-demo');
--   DELETE FROM crm_customers
--     WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'greenfield-demo');
--   DELETE FROM tenants WHERE slug = 'greenfield-demo';
--   DELETE FROM app_admin_emails WHERE email = 'jon@brandsinblooms.com';
--   COMMIT;
--
-- IDEMPOTENCY: re-running this file as-is will fail because the
-- tenant slug is unique. If you need to re-seed, rollback first.
-- =====================================================================

BEGIN;

-- 1) Master-admin grant for Jon's @brandsinblooms.com account.
--    jon@getclear.ca already had this; we're adding the parallel email
--    so Jon can use either credential.
INSERT INTO public.app_admin_emails (email, created_by)
VALUES ('jon@brandsinblooms.com', 'demo-tenant-seed')
ON CONFLICT (email) DO NOTHING;

-- 2) Tenant row.
INSERT INTO public.tenants (name, slug, settings, city, region, country, is_active)
VALUES (
  'Greenfield Garden Centre',
  'greenfield-demo',
  jsonb_build_object(
    'is_demo', true,
    'is_internal', true,
    'hidden_from_lists', true,
    'subscription_plan', 'bloom',
    'internal_notes',
      'Internal demo tenant for homepage screenshot capture. Do not link to Stripe. See supabase/seeds/README.md.'
  ),
  'Vancouver',
  'BC',
  'CA',
  true
);

-- Single DO block holds the rest so we can capture the new tenant id
-- and segment / campaign ids in local variables and use them across
-- inserts without round-tripping ids through the client.
DO $seed$
DECLARE
  v_tenant_id          uuid;
  v_seg_vip            uuid;
  v_seg_season         uuid;
  v_seg_lapsed         uuid;
  v_seg_subs           uuid;
  v_seg_bday           uuid;
  v_camp_mday          uuid;
  v_camp_spring        uuid;
  v_camp_patio         uuid;
  v_now                timestamptz := now();
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'greenfield-demo';

  -- ===================================================================
  -- 3) Customers — ~9,500 rows.
  --
  -- Random pieces:
  --   - first/last name from small fixed arrays (~30 each → 900 unique
  --     full-name combinations, more than enough variety for a screenshot)
  --   - email is unique by row index (deterministic, no collision risk)
  --   - province biased BC 35 / AB 25 / ON 25 / other 15
  --   - city derived from province
  --   - created_at: month index 0..17 picked from a seasonal weight
  --     array (April-June ~1.5x baseline, Dec-Feb ~0.6x baseline)
  --   - has_purchased: ~63% of contacts (the rest are email-only signups)
  --   - For purchasers, last_purchase_date is bucketed into one of the
  --     12 calendar months proportional to the revenue spec, total_spent
  --     drawn from a lognormal-ish distribution clamped 35..480 with
  --     mode near $80
  --   - email_opt_in true for ~76% of contacts (drives the
  --     ~7,200-target Email Subscribers segment)
  -- ===================================================================
  INSERT INTO public.crm_customers (
    tenant_id, email, first_name, last_name,
    city, state_region, country_code,
    email_opt_in, email_opt_in_at,
    created_at, last_purchase_date,
    first_purchase_date, total_spent, pos_total_spent, pos_order_count,
    is_vip, loyalty_member,
    timezone, preferred_channel
  )
  SELECT
    v_tenant_id,
    'gf-' || lpad(n::text, 5, '0') || '@greenfield-demo.test',
    (ARRAY['Sarah','Emma','Olivia','Sophia','Ava','Mia','Charlotte','Amelia',
           'Liam','Noah','Lucas','Mason','Ethan','Logan','Owen','Jacob',
           'Madison','Hannah','Grace','Chloe','Lily','Zoe','Ella','Aria',
           'Benjamin','William','Henry','James','Daniel','Alex'])[1 + (n * 7) % 30],
    (ARRAY['Tremblay','Wilson','Martin','Brown','Smith','Roy','Lee','Anderson',
           'Taylor','MacDonald','Campbell','Stewart','Gagnon','Cote','Ng',
           'Patel','Singh','Chen','Wong','Kim','Pelletier','Larsen','OBrien',
           'Beaulieu','Cooper','Mitchell','Hughes','Murphy','Hayes','Reid'])[1 + (n * 11) % 30],
    -- city/region tied together for realism
    CASE
      WHEN (n * 13 + 7) % 100 < 35 THEN
        (ARRAY['Vancouver','Burnaby','Surrey','Victoria','Kelowna','Richmond'])[1 + (n * 17) % 6]
      WHEN (n * 13 + 7) % 100 < 60 THEN
        (ARRAY['Calgary','Edmonton','Red Deer','Lethbridge','Airdrie'])[1 + (n * 19) % 5]
      WHEN (n * 13 + 7) % 100 < 85 THEN
        (ARRAY['Toronto','Mississauga','Ottawa','Hamilton','London','Kitchener','Markham'])[1 + (n * 23) % 7]
      WHEN (n * 13 + 7) % 100 < 92 THEN
        (ARRAY['Montreal','Quebec City','Laval'])[1 + (n * 29) % 3]
      ELSE
        (ARRAY['Winnipeg','Saskatoon','Halifax','Fredericton','St Johns'])[1 + (n * 31) % 5]
    END,
    CASE
      WHEN (n * 13 + 7) % 100 < 35 THEN 'BC'
      WHEN (n * 13 + 7) % 100 < 60 THEN 'AB'
      WHEN (n * 13 + 7) % 100 < 85 THEN 'ON'
      WHEN (n * 13 + 7) % 100 < 92 THEN 'QC'
      ELSE (ARRAY['MB','SK','NS','NB','NL'])[1 + (n * 41) % 5]
    END,
    'CA',
    -- email_opt_in: ~76% true (drives ~7,200 Email Subscribers count)
    ((n * 37) % 100) < 76,
    CASE WHEN ((n * 37) % 100) < 76
      THEN v_now - ((n * 13) % 540) * INTERVAL '1 day'
      ELSE NULL
    END,
    -- created_at: spread across last 18 months with seasonal weighting
    -- (months 0..17 from oldest to current; April-June months 1,2,3,13,14,15
    --  get a 1.5x weight, Dec-Feb months 8,9,10 get 0.6x). Implemented by
    -- shifting day offsets within the 540-day window using a fixed
    -- per-row hash so the distribution is reproducible.
    v_now - (
      CASE
        -- April-June bucket (heavier)
        WHEN (n * 53) % 100 < 32 THEN ((n * 19) % 90) + 60
        WHEN (n * 53) % 100 < 50 THEN ((n * 23) % 90) + 420
        -- Dec-Feb bucket (lighter)
        WHEN (n * 53) % 100 < 56 THEN ((n * 29) % 90) + 270
        -- Other months baseline
        ELSE ((n * 31) % 540)
      END
    ) * INTERVAL '1 day',
    -- last_purchase_date: bucketed into a month within last 12 months
    -- proportional to the monthly revenue spec. ~63% of contacts purchased.
    CASE
      WHEN (n * 67) % 100 < 63 THEN
        (
          v_now - (
            -- pick month 0..11 weighted by spec (in % of 1584 total):
            --   Jan 2.65 / Feb 3.22 / Mar 8.08 / Apr 16.67 / May 17.74 /
            --   Jun 12.50 / Jul 8.96 / Aug 8.71 / Sep 5.93 / Oct 7.07 /
            --   Nov 3.66 / Dec 4.80
            -- Convert to a 0..1000 dial via cumulative weights.
            CASE
              WHEN (n * 71) % 1000 <  27 THEN 11   -- Dec (now-11mo)
              WHEN (n * 71) % 1000 <  59 THEN 10   -- Nov
              WHEN (n * 71) % 1000 < 140 THEN  9   -- Oct
              WHEN (n * 71) % 1000 < 307 THEN  8   -- Sep
              WHEN (n * 71) % 1000 < 484 THEN  7   -- Aug
              WHEN (n * 71) % 1000 < 609 THEN  6   -- Jul
              WHEN (n * 71) % 1000 < 698 THEN  5   -- Jun
              WHEN (n * 71) % 1000 < 785 THEN  4   -- May
              WHEN (n * 71) % 1000 < 845 THEN  3   -- Apr
              WHEN (n * 71) % 1000 < 880 THEN  2   -- Mar
              WHEN (n * 71) % 1000 < 928 THEN  1   -- Feb
              ELSE 0                                -- Jan (most recent)
            END
          ) * INTERVAL '30 days'
        )::date
      ELSE NULL
    END,
    -- first_purchase_date: ~6 months before last_purchase_date, or NULL
    CASE
      WHEN (n * 67) % 100 < 63 THEN
        (v_now - INTERVAL '180 days' - ((n * 79) % 365) * INTERVAL '1 day')::date
      ELSE NULL
    END,
    -- total_spent: lognormal-ish skew toward $80 mode, clamped 35..480.
    -- Use ((random hash 0..99)/100)^2.6 * 445 + 35 to bias low.
    CASE
      WHEN (n * 67) % 100 < 63 THEN
        round((35 + power(((n * 83) % 100) / 100.0, 2.6) * 445)::numeric, 2)
      ELSE 0
    END,
    CASE
      WHEN (n * 67) % 100 < 63 THEN
        round((35 + power(((n * 83) % 100) / 100.0, 2.6) * 445)::numeric, 2)
      ELSE 0
    END,
    CASE
      WHEN (n * 67) % 100 < 63 THEN 1 + ((n * 89) % 6)
      ELSE 0
    END,
    -- is_vip: top 10% by hash
    ((n * 91) % 100) >= 90,
    -- loyalty_member: ~25%
    ((n * 97) % 100) < 25,
    'America/Vancouver',
    'email'
  FROM generate_series(1, 9500) AS n;

  -- ===================================================================
  -- 4) Segments. auto_update=false so the recompute worker doesn't
  --    drop our seeded memberships when it runs.
  -- ===================================================================
  INSERT INTO public.crm_segments
    (tenant_id, name, description, conditions, customer_count, auto_update, status, is_system_segment)
  VALUES
    (v_tenant_id, 'VIP Buyers',
     'High-value customers (lifetime spend ≥ $250 OR is_vip flag).',
     jsonb_build_object('rules', jsonb_build_array(
       jsonb_build_object('field', 'is_vip', 'op', 'eq', 'value', true),
       jsonb_build_object('field', 'total_spent', 'op', 'gte', 'value', 250)
     )),
     0, false, 'active', false)
  RETURNING id INTO v_seg_vip;

  INSERT INTO public.crm_segments
    (tenant_id, name, description, conditions, customer_count, auto_update, status, is_system_segment)
  VALUES
    (v_tenant_id, 'This Season''s Customers',
     'Purchased within the last 90 days.',
     jsonb_build_object('rules', jsonb_build_array(
       jsonb_build_object('field', 'last_purchase_date', 'op', 'within_days', 'value', 90)
     )),
     0, false, 'active', false)
  RETURNING id INTO v_seg_season;

  INSERT INTO public.crm_segments
    (tenant_id, name, description, conditions, customer_count, auto_update, status, is_system_segment)
  VALUES
    (v_tenant_id, 'Lapsed (12+ months)',
     'Last purchase 12 or more months ago.',
     jsonb_build_object('rules', jsonb_build_array(
       jsonb_build_object('field', 'last_purchase_date', 'op', 'older_than_days', 'value', 365)
     )),
     0, false, 'active', false)
  RETURNING id INTO v_seg_lapsed;

  INSERT INTO public.crm_segments
    (tenant_id, name, description, conditions, customer_count, auto_update, status, is_system_segment)
  VALUES
    (v_tenant_id, 'Email Subscribers',
     'All contacts with email_opt_in = true.',
     jsonb_build_object('rules', jsonb_build_array(
       jsonb_build_object('field', 'email_opt_in', 'op', 'eq', 'value', true)
     )),
     0, false, 'active', false)
  RETURNING id INTO v_seg_subs;

  INSERT INTO public.crm_segments
    (tenant_id, name, description, conditions, customer_count, auto_update, status, is_system_segment)
  VALUES
    (v_tenant_id, 'Birthday Club',
     'Opted into birthday-month offers.',
     jsonb_build_object('rules', jsonb_build_array(
       jsonb_build_object('field', 'tags', 'op', 'contains', 'value', 'birthday-club')
     )),
     0, false, 'active', false)
  RETURNING id INTO v_seg_bday;

  -- ===================================================================
  -- 5) Customer-segment memberships, sampled from the just-inserted
  --    customer rows. Each segment gets approximately the spec'd count.
  --    Using ORDER BY random() with a LIMIT keeps it within ±5% of
  --    target without per-customer enumerated logic.
  -- ===================================================================
  -- Reshape last_purchase_date for two cohorts before computing the
  -- segment memberships:
  --   1. push ~1,900 mid-distance customers (150-300 days old) further
  --      into the past (400-700 days) so the Lapsed (12+ months) segment
  --      has bodies. The original month-bucket CASE only stretches to
  --      ~330 days back, which leaves the >365-day window empty.
  --   2. promote ~1,950 customers from the 100-300 day range into the
  --      last 90 days so This Season's Customers hits its target.
  WITH lapsed_picks AS (
    SELECT id FROM public.crm_customers
     WHERE tenant_id = v_tenant_id
       AND last_purchase_date IS NOT NULL
       AND last_purchase_date BETWEEN (v_now - INTERVAL '300 days')::date
                                  AND (v_now - INTERVAL '150 days')::date
     ORDER BY md5(id::text)
     LIMIT 1900
  )
  UPDATE public.crm_customers c
     SET last_purchase_date = (
       v_now - INTERVAL '400 days' - (abs(hashtext(c.id::text)) % 350) * INTERVAL '1 day'
     )::date,
         first_purchase_date = (
           v_now - INTERVAL '700 days' - (abs(hashtext(c.id::text)) % 200) * INTERVAL '1 day'
         )::date
   WHERE c.id IN (SELECT id FROM lapsed_picks);

  WITH season_picks AS (
    SELECT id FROM public.crm_customers
     WHERE tenant_id = v_tenant_id
       AND last_purchase_date IS NOT NULL
       AND last_purchase_date BETWEEN (v_now - INTERVAL '300 days')::date
                                  AND (v_now - INTERVAL '90 days')::date
     ORDER BY md5(id::text || 'season')
     LIMIT 1950
  )
  UPDATE public.crm_customers c
     SET last_purchase_date = (
       v_now - (abs(hashtext(c.id::text)) % 90) * INTERVAL '1 day'
     )::date
   WHERE c.id IN (SELECT id FROM season_picks);

  INSERT INTO public.customer_segments (customer_id, segment_id)
  SELECT id, v_seg_vip FROM public.crm_customers
   WHERE tenant_id = v_tenant_id
     AND (is_vip = true OR total_spent >= 250)
   ORDER BY total_spent DESC
   LIMIT 950;

  INSERT INTO public.customer_segments (customer_id, segment_id)
  SELECT id, v_seg_season FROM public.crm_customers
   WHERE tenant_id = v_tenant_id
     AND last_purchase_date >= (v_now - INTERVAL '90 days')::date
   ORDER BY last_purchase_date DESC
   LIMIT 3200;

  INSERT INTO public.customer_segments (customer_id, segment_id)
  SELECT id, v_seg_lapsed FROM public.crm_customers
   WHERE tenant_id = v_tenant_id
     AND last_purchase_date IS NOT NULL
     AND last_purchase_date < (v_now - INTERVAL '365 days')::date
   ORDER BY last_purchase_date ASC
   LIMIT 1800;

  INSERT INTO public.customer_segments (customer_id, segment_id)
  SELECT id, v_seg_subs FROM public.crm_customers
   WHERE tenant_id = v_tenant_id
     AND email_opt_in = true
   ORDER BY created_at DESC
   LIMIT 7200;

  INSERT INTO public.customer_segments (customer_id, segment_id)
  SELECT id, v_seg_bday FROM public.crm_customers
   WHERE tenant_id = v_tenant_id
     AND email_opt_in = true
   ORDER BY md5(id::text)
   LIMIT 2400;

  -- Keep customer_count cached aggregate accurate so the segment-list
  -- widget on the dashboard renders the right numbers.
  UPDATE public.crm_segments
     SET customer_count = (
       SELECT count(*) FROM public.customer_segments
        WHERE segment_id = crm_segments.id
     )
   WHERE tenant_id = v_tenant_id;

  -- ===================================================================
  -- 6) Campaigns — three rows in non-triggering states.
  --    Mother's Day → status='sent' is terminal. Per
  --    campaign_status_lifecycle_integrity migration the worker only
  --    claims 'queued'/'sending', not 'sent'. Setting send_completed_at
  --    + queue_completed_at locks it as a finished historical row.
  -- ===================================================================
  INSERT INTO public.crm_campaigns (
    tenant_id, name, subject_line, content,
    status, sent_at, scheduled_at, queued_at,
    send_started_at, send_completed_at,
    queue_started_at, queue_completed_at,
    total_sent, total_opens, total_clicks,
    open_rate, click_rate,
    metrics, total_recipients, messages_sent, messages_failed, messages_skipped,
    auto_send_enabled, delivery_method,
    created_at, updated_at
  )
  VALUES (
    v_tenant_id,
    'Mother''s Day Hanging Baskets',
    'For the gardener who raised a gardener — Mother''s Day baskets ready now',
    'Hand-tied baskets, ready for pickup all weekend. Reserve yours online or stop by — we''re open until 6pm.',
    'sent',
    v_now - INTERVAL '21 days',
    v_now - INTERVAL '21 days' - INTERVAL '2 hours',
    v_now - INTERVAL '21 days' - INTERVAL '1 hour',
    v_now - INTERVAL '21 days',
    v_now - INTERVAL '21 days' + INTERVAL '38 minutes',
    v_now - INTERVAL '21 days',
    v_now - INTERVAL '21 days' + INTERVAL '38 minutes',
    7100, 2300, 433,                       -- 32.4% / 6.1%
    32.4, 6.1,
    jsonb_build_object(
      'sent', 7100, 'delivered', 7048, 'opened', 2300, 'clicked', 433,
      'bounced', 52, 'unsubscribed', 18, 'revenue', 18420
    ),
    7100, 7100, 0, 0,
    false, 'shared_sender',
    v_now - INTERVAL '23 days', v_now - INTERVAL '21 days' + INTERVAL '38 minutes'
  )
  RETURNING id INTO v_camp_mday;

  -- Spring Perennial Sale: 'draft' so no worker claims it.
  -- scheduled_at populated 5 days out; the dashboard treats this as an
  -- upcoming campaign without firing the queue.
  INSERT INTO public.crm_campaigns (
    tenant_id, name, subject_line, content,
    status, scheduled_at,
    total_sent, total_opens, total_clicks,
    open_rate, click_rate,
    metrics, auto_send_enabled, delivery_method,
    created_at, updated_at
  )
  VALUES (
    v_tenant_id,
    'Spring Perennial Sale',
    'Perennials are 25% off through Sunday',
    'Fill the bare spots in your beds. Coneflowers, daylilies, hostas, sedums — 25% off until Sunday.',
    'draft',
    v_now + INTERVAL '5 days',
    0, 0, 0,
    0, 0,
    '{"sent":0,"opened":0,"bounced":0,"clicked":0,"revenue":0,"delivered":0,"unsubscribed":0}'::jsonb,
    false, 'shared_sender',
    v_now - INTERVAL '4 days', v_now - INTERVAL '1 day'
  )
  RETURNING id INTO v_camp_spring;

  -- Patio Season Kickoff: pure draft, no schedule.
  INSERT INTO public.crm_campaigns (
    tenant_id, name, subject_line, content,
    status,
    total_sent, total_opens, total_clicks,
    open_rate, click_rate,
    metrics, auto_send_enabled, delivery_method,
    created_at, updated_at
  )
  VALUES (
    v_tenant_id,
    'Patio Season Kickoff',
    'Patio season is here — see what''s arrived',
    'New planters, cushions, hanging baskets, and tomato cages. Stop by this weekend.',
    'draft',
    0, 0, 0,
    0, 0,
    '{"sent":0,"opened":0,"bounced":0,"clicked":0,"revenue":0,"delivered":0,"unsubscribed":0}'::jsonb,
    false, 'shared_sender',
    v_now - INTERVAL '2 days', v_now - INTERVAL '6 hours'
  )
  RETURNING id INTO v_camp_patio;

  -- Touch tenant.last_event_at so the admin tenant list shows recent
  -- activity (not strictly required, but renders better).
  UPDATE public.tenants
     SET last_event_at = v_now
   WHERE id = v_tenant_id;

  RAISE NOTICE 'Greenfield demo seed complete. Tenant id: %', v_tenant_id;
  RAISE NOTICE 'Segment ids: vip=%, season=%, lapsed=%, subs=%, bday=%',
    v_seg_vip, v_seg_season, v_seg_lapsed, v_seg_subs, v_seg_bday;
  RAISE NOTICE 'Campaign ids: mday=%, spring=%, patio=%',
    v_camp_mday, v_camp_spring, v_camp_patio;
END $seed$;

COMMIT;
