-- Applied to udldmkqwnxhdeztyqcau on 2026-11-24 (recorded version in filename).
-- QA pass 4 follow-up #3: Birthday Club and Lapsed (12+ months) have members
-- on the Northfield demo (3eade43c-2e5a-4ad0-80fb-500e3d7afbd4).
--
-- Built on the recorded definition of intelligence_ops.refresh_greenfield_demo()
-- (pg_get_functiondef, 2026-11-24; same as
-- 20261124165114_demo_refresh_sent_campaigns). Changes:
--   * rn % 10 = 7 (950 of 9,500): last purchase 380-709 days ago, first
--     purchase 730-1,129 days ago. Their demo purchase lines and timeline
--     purchase end at that last purchase.
--   * rn % 6 = 1 (1,584): tag birthday-club and custom_fields.date_of_birth;
--     a quarter of them this month, a quarter next month (rolling), the rest
--     spread over the year. Others lose any demo date_of_birth/club tag.
--   * search_path is '' (every relation was already schema-qualified).
-- Still only the demo tenant: the slug guard and every WHERE are unchanged,
-- and recompute_greenfield_static_segments refuses any other tenant. The
-- demo birthday automation stays inactive and every demo customer stays
-- suppressed with an .invalid address, so nothing can be sent.

CREATE OR REPLACE FUNCTION intelligence_ops.refresh_greenfield_demo()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_tenant constant uuid := '3eade43c-2e5a-4ad0-80fb-500e3d7afbd4';
  v_user constant uuid := 'c3b4108d-5071-4117-9e05-57e79006b79f';
  v_import constant uuid := 'a1000000-0000-4000-8000-000000000001';
  v_form_newsletter constant uuid := 'a2000000-0000-4000-8000-000000000001';
  v_form_workshop constant uuid := 'a2000000-0000-4000-8000-000000000002';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tenants
    WHERE id = v_tenant AND slug = 'greenfield-demo'
  ) THEN
    RAISE EXCEPTION 'Demo tenant identity did not match';
  END IF;

  UPDATE public.tenants
  SET settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
        'demo_mode', true,
        'demo_clock', 'rolling_daily',
        'demo_refreshed_at', now(),
        'demo_data_notice', 'Synthetic demonstration data; no messages may be delivered.'
      ),
      last_event_at = now(),
      updated_at = now()
  WHERE id = v_tenant;

  UPDATE public.company_profiles
  SET company_phone = '+1-503-555-0147',
      street_address = '1842 Hawthorne Garden Way',
      website_url = NULL,
      custom_sender_email = NULL,
      dns_records_verified = false,
      email_auth_status = 'pending',
      feature_flags = coalesce(feature_flags, '{}'::jsonb) ||
        '{"crm_enabled":true,"analytics_v1":true,"analytics_dashboard_v1":true,"scheduling_v1":true,"social_posting_v1":true,"smart_timing_enabled":true}'::jsonb,
      updated_at = now()
  WHERE user_id = v_user
    AND (company_phone, street_address, website_url, custom_sender_email,
         dns_records_verified, email_auth_status, feature_flags)
        IS DISTINCT FROM
        ('+1-503-555-0147', '1842 Hawthorne Garden Way', NULL::text, NULL::text,
         false, 'pending', coalesce(feature_flags, '{}'::jsonb) ||
         '{"crm_enabled":true,"analytics_v1":true,"analytics_dashboard_v1":true,"scheduling_v1":true,"social_posting_v1":true,"smart_timing_enabled":true}'::jsonb);

  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY id) AS rn
    FROM public.crm_customers
    WHERE tenant_id = v_tenant AND deleted_at IS NULL
  )
  UPDATE public.crm_customers c
  SET email = format('customer-%s@greenfield-demo.example.invalid', ranked.rn),
      phone = CASE WHEN ranked.rn <= 3500
        THEN format('+1-503-555-%s', lpad((((ranked.rn - 1) % 9000) + 1000)::text, 4, '0'))
        ELSE NULL END,
      -- About one in ten demo customers is lapsed: last purchase 380-709
      -- days ago, so "Lapsed (12+ months)" has members (qa4 follow-up #3).
      first_purchase_date = CASE WHEN ranked.rn % 10 = 7
        THEN (current_date - ((730 + ranked.rn % 400)::int))::timestamptz
        ELSE (current_date - ((90 + ranked.rn % 640)::int))::timestamptz END,
      last_purchase_date = CASE WHEN ranked.rn % 10 = 7
        THEN (current_date - ((380 + ranked.rn % 330)::int))::timestamptz
        ELSE (current_date - ((ranked.rn % 120)::int))::timestamptz END,
      total_spent = round((35 + ((ranked.rn * 7919) % 480000) / 100.0)::numeric, 2),
      lifetime_value = round((75 + ((ranked.rn * 104729) % 720000) / 100.0)::numeric, 2),
      pos_order_count = (1 + ranked.rn % 28)::int,
      email_opt_in = ranked.rn % 5 <> 0,
      sms_opt_in = ranked.rn <= 3500 AND ranked.rn % 4 = 0,
      suppressed = true,
      suppressed_at = coalesce(c.suppressed_at, now()),
      suppressed_reason = 'demo_synthetic_data',
      -- One in six demo customers is in the Birthday Club (tag
      -- birthday-club) with a date_of_birth (the field the birthday checker
      -- reads). A quarter of the club has a birthday this month and a quarter
      -- next month, rolling with the demo clock; the rest are spread over the
      -- year. Everyone else has no demo birthday and no club tag.
      tags = array_remove(coalesce(c.tags, ARRAY[]::text[]), 'birthday-club')
        || CASE WHEN ranked.rn % 6 = 1 THEN ARRAY['birthday-club']::text[]
           ELSE ARRAY[]::text[] END,
      custom_fields = (coalesce(c.custom_fields, '{}'::jsonb) - 'date_of_birth')
        || jsonb_build_object(
          'demo_record', true,
          'demo_refreshed_at', now()
        )
        || CASE WHEN ranked.rn % 6 = 1 THEN jsonb_build_object(
          'date_of_birth', to_char(make_date(
            (1950 + ranked.rn % 50)::int,
            CASE ranked.rn % 24
              WHEN 1 THEN extract(month from current_date)::int
              WHEN 13 THEN extract(month from current_date + interval '1 month')::int
              ELSE ((ranked.rn / 6) % 12 + 1)::int END,
            (1 + ranked.rn % 28)::int), 'YYYY-MM-DD'))
        ELSE '{}'::jsonb END,
      updated_at = now()
  FROM ranked
  WHERE c.id = ranked.id;

  INSERT INTO public.products (
    tenant_id, created_by_user_id, name, description, sku, price, cost_price,
    currency, inventory_count, stock_count, track_inventory, low_stock_threshold,
    category, subcategory, tags, source, external_id, external_data,
    last_synced_at, status, is_visible, slug
  )
  SELECT v_tenant, v_user, p.name,
    'Synthetic Northfield demo inventory, refreshed daily.', p.external_id, p.price,
    round((p.price * 0.48)::numeric, 2), 'USD', p.stock, p.stock, true,
    p.threshold, p.category, p.subcategory, p.tags, 'platform', p.external_id,
    jsonb_build_object('demo_record', true, 'simulated_source', 'Northfield POS'),
    now(), 'active', true, lower(regexp_replace(p.name, '[^a-zA-Z0-9]+', '-', 'g'))
  FROM (VALUES
    ('GF-PER-001','Lavender Hidcote',18.99,42,8,'Perennials','Sun Perennials',ARRAY['fragrant','pollinator']),
    ('GF-PER-002','Echinacea Magnus',21.99,7,10,'Perennials','Native Perennials',ARRAY['native','pollinator','low-stock']),
    ('GF-PER-003','Hosta Blue Angel',24.99,36,8,'Perennials','Shade Perennials',ARRAY['shade']),
    ('GF-PER-004','Heuchera Caramel',19.99,5,8,'Perennials','Shade Perennials',ARRAY['shade','low-stock']),
    ('GF-ANN-001','Proven Winners Petunia',8.99,84,15,'Annuals','Bedding Plants',ARRAY['colour','sun']),
    ('GF-ANN-002','Begonia Dragon Wing',9.99,62,12,'Annuals','Bedding Plants',ARRAY['shade']),
    ('GF-VEG-001','Heirloom Tomato 4-inch',5.49,96,20,'Edibles','Vegetable Starts',ARRAY['edible','spring']),
    ('GF-VEG-002','Basil Genovese',4.49,9,12,'Edibles','Herbs',ARRAY['edible','low-stock']),
    ('GF-HOU-001','Monstera Deliciosa 10-inch',44.99,18,5,'Houseplants','Tropical',ARRAY['indoor','popular']),
    ('GF-HOU-002','Pothos Golden 6-inch',16.99,4,8,'Houseplants','Tropical',ARRAY['indoor','low-stock']),
    ('GF-HOU-003','ZZ Plant 8-inch',32.99,22,6,'Houseplants','Low Light',ARRAY['indoor','easy-care']),
    ('GF-SHR-001','Hydrangea Endless Summer',49.99,28,6,'Shrubs','Flowering Shrubs',ARRAY['flowering']),
    ('GF-SHR-002','Rhododendron Nova Zembla',54.99,14,5,'Shrubs','Evergreen Shrubs',ARRAY['evergreen']),
    ('GF-TRE-001','Japanese Maple Bloodgood',129.99,6,3,'Trees','Ornamental Trees',ARRAY['specimen']),
    ('GF-SOI-001','Premium Potting Mix 28L',14.99,110,20,'Garden Supplies','Soil',ARRAY['soil','essential']),
    ('GF-SOI-002','Sea Soil Original 32L',17.99,8,15,'Garden Supplies','Soil',ARRAY['soil','low-stock']),
    ('GF-FER-001','Organic All Purpose 4-4-4',19.99,54,10,'Garden Supplies','Fertilizer',ARRAY['organic']),
    ('GF-POT-001','Ceramic Planter Sage 12-inch',39.99,12,5,'Pottery','Ceramic',ARRAY['decor']),
    ('GF-POT-002','Terracotta Pot 10-inch',12.99,48,10,'Pottery','Terracotta',ARRAY['classic']),
    ('GF-TOO-001','Bypass Pruner',34.99,31,6,'Garden Supplies','Tools',ARRAY['tools']),
    ('GF-SEE-001','Pollinator Seed Collection',12.99,73,12,'Seeds','Flower Seeds',ARRAY['pollinator','native']),
    ('GF-BUL-001','Spring Bulb Collection',29.99,3,8,'Bulbs','Seasonal Bulbs',ARRAY['seasonal','low-stock']),
    ('GF-GIF-001','Northfield Gift Card $50',50.00,999,0,'Gift Cards','Gift Cards',ARRAY['gift']),
    ('GF-DEC-001','Outdoor String Lights',46.99,26,6,'Seasonal','Outdoor Decor',ARRAY['seasonal','decor'])
  ) AS p(external_id,name,price,stock,threshold,category,subcategory,tags)
  ON CONFLICT (tenant_id, external_id) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    inventory_count = CASE
      WHEN products.external_id IN ('GF-PER-002','GF-PER-004','GF-VEG-002','GF-HOU-002','GF-SOI-002','GF-BUL-001')
        THEN greatest(2, EXCLUDED.inventory_count - (extract(doy from current_date)::int % 4))
      ELSE greatest(12, EXCLUDED.inventory_count - (extract(doy from current_date)::int % 9))
    END,
    stock_count = CASE
      WHEN products.external_id IN ('GF-PER-002','GF-PER-004','GF-VEG-002','GF-HOU-002','GF-SOI-002','GF-BUL-001')
        THEN greatest(2, EXCLUDED.stock_count - (extract(doy from current_date)::int % 4))
      ELSE greatest(12, EXCLUDED.stock_count - (extract(doy from current_date)::int % 9))
    END,
    low_stock_threshold = EXCLUDED.low_stock_threshold,
    external_data = EXCLUDED.external_data,
    last_synced_at = now(),
    updated_at = now();

  INSERT INTO public.customer_intelligence_imports (
    id, tenant_id, source, report_type, source_filename, source_period_start,
    source_period_end, source_sha256, status, source_row_count,
    accepted_row_count, reconciliation, completed_at, created_by
  ) VALUES (
    v_import, v_tenant, 'demo', 'customer_spending', 'greenfield-rolling-demo.json',
    current_date - 365, current_date, 'greenfield-rolling-demo-v1', 'completed',
    9500, 9500,
    jsonb_build_object('demo_record', true, 'synthetic', true, 'refreshed_at', now()),
    now(), v_user
  ) ON CONFLICT (id) DO UPDATE SET
    source_period_start = current_date - 365,
    source_period_end = current_date,
    completed_at = now(),
    reconciliation = EXCLUDED.reconciliation;

  INSERT INTO public.customer_intelligence_source_events (
    tenant_id, customer_id, import_id, source, event_type,
    external_customer_code, amount, occurred_at, source_fingerprint, raw_data
  )
  SELECT v_tenant, c.id, v_import, 'demo', 'customer_spending',
    format('GF-%s', c.rn), c.total_spent,
    now() - make_interval(days => (c.rn % 45)::int),
    'greenfield-demo-spend-' || c.id,
    jsonb_build_object(
      'kind', 'reported_period_spending', 'currency', 'CAD',
      'transactions', coalesce(c.pos_order_count, 1),
      'period_start', (current_date - 365)::text,
      'period_end', current_date::text,
      'demo_record', true
    )
  FROM (
    SELECT customer.*, row_number() OVER (ORDER BY customer.id) AS rn
    FROM public.crm_customers customer
    WHERE customer.tenant_id = v_tenant AND customer.deleted_at IS NULL
  ) c
  ON CONFLICT (tenant_id, source, source_fingerprint) DO UPDATE SET
    amount = EXCLUDED.amount,
    occurred_at = EXCLUDED.occurred_at,
    raw_data = EXCLUDED.raw_data,
    created_at = now();

  WITH customers AS (
    SELECT id, last_purchase_date, row_number() OVER (ORDER BY id) AS rn
    FROM public.crm_customers
    WHERE tenant_id = v_tenant AND deleted_at IS NULL
    ORDER BY id LIMIT 6000
  ), demo_products AS (
    SELECT id, external_id, name, category, price,
      row_number() OVER (ORDER BY external_id) AS rn,
      count(*) OVER () AS product_count
    FROM public.products
    WHERE tenant_id = v_tenant AND (external_data->>'demo_record')::boolean IS TRUE
  )
  INSERT INTO public.customer_purchase_line_items (
    tenant_id, customer_id, import_id, source, external_transaction_id,
    external_line_id, external_customer_code, product_code, product_name,
    sales_category, department, quantity, gross_amount, discount_amount,
    net_amount, currency, purchased_at, source_period_start, source_period_end,
    source_fingerprint, raw_data
  )
  SELECT v_tenant, c.id, v_import, 'demo',
    format('GF-TXN-%s-%s', c.rn, line_no), format('%s', line_no),
    format('GF-%s', c.rn), p.external_id, p.name, p.category, p.category,
    1 + ((c.rn + line_no) % 3),
    round((p.price * (1 + ((c.rn + line_no) % 3)))::numeric, 2), 0,
    round((p.price * (1 + ((c.rn + line_no) % 3)))::numeric, 2), 'CAD',
    -- A lapsed customer's lines end at their last purchase.
    CASE WHEN c.last_purchase_date < current_date - 365
      THEN c.last_purchase_date - make_interval(days => ((line_no - 1) * 45)::int)
      ELSE now() - make_interval(days => ((c.rn * 7 + line_no * 11) % 365)::int) END,
    current_date - 365, current_date,
    format('greenfield-demo-line-%s-%s', c.id, line_no),
    jsonb_build_object('demo_record', true, 'product_id', p.id)
  FROM customers c
  CROSS JOIN generate_series(1, 2) line_no
  JOIN demo_products p ON p.rn = ((c.rn + line_no - 2) % p.product_count) + 1
  ON CONFLICT (tenant_id, source, source_fingerprint) DO UPDATE SET
    purchased_at = EXCLUDED.purchased_at,
    source_period_start = EXCLUDED.source_period_start,
    source_period_end = EXCLUDED.source_period_end,
    created_at = now();

  -- A lapsed customer's demo purchase sits on their last purchase date.
  UPDATE public.customer_timeline t
  SET created_at = CASE WHEN customer.last_purchase_date < current_date - 365
        THEN customer.last_purchase_date + interval '14 hours'
        ELSE now() - make_interval(days => ((t.metadata->>'demo_day_offset')::int % 120)) END,
      updated_at = now()
  FROM public.crm_customers customer
  WHERE t.tenant_id = v_tenant AND t.metadata->>'demo_record' = 'true'
    AND customer.id = t.customer_id AND customer.tenant_id = v_tenant;

  INSERT INTO public.customer_timeline (
    customer_id, activity_type, purchase_amount, product_name, metadata,
    created_at, updated_at, tenant_id
  )
  SELECT c.id, 'purchase', round((18 + (c.rn % 240))::numeric, 2),
    p.name,
    jsonb_build_object('demo_record', true, 'demo_key', c.id::text, 'demo_day_offset', c.rn % 120),
    now() - make_interval(days => (c.rn % 120)::int), now(), v_tenant
  FROM (
    SELECT id, row_number() OVER (ORDER BY id) AS rn
    FROM public.crm_customers
    WHERE tenant_id = v_tenant AND deleted_at IS NULL
    ORDER BY id LIMIT 6000
  ) c
  JOIN LATERAL (
    SELECT name FROM public.products
    WHERE tenant_id = v_tenant ORDER BY external_id
    OFFSET ((c.rn - 1) % 24) LIMIT 1
  ) p ON true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.customer_timeline t
    WHERE t.tenant_id = v_tenant AND t.metadata->>'demo_key' = c.id::text
  );

  -- Demo automations carry an editor flow (trigger node + email step) so the
  -- builder shows them. A flow someone edited in the demo is kept; only an
  -- empty flow or the legacy-converted one is replaced.
  INSERT INTO public.crm_automations (
    id, tenant_id, user_id, name, trigger_type, trigger_conditions,
    workflow_steps, is_active, template_source, overlap_behavior, flow_state
  )
  SELECT a.id, v_tenant, v_user, a.name, a.trigger_type, a.trigger_conditions,
    a.workflow_steps, a.is_active, 'greenfield_demo', a.overlap_behavior,
    jsonb_build_object(
      'nodes', jsonb_build_array(
        jsonb_build_object('id', 'trigger-demo', 'type', 'trigger',
          'position', jsonb_build_object('x', 250, 'y', 50),
          'data', jsonb_build_object('label', a.name, 'triggerType', a.trigger_type,
            'conditions', a.trigger_conditions)),
        jsonb_build_object('id', 'email-demo', 'type', 'email',
          'position', jsonb_build_object('x', 250, 'y', 220),
          'data', jsonb_build_object('editable', true, 'delay', a.delay_label,
            'template', a.template, 'subject', a.subject, 'content', a.content))
      ),
      'edges', jsonb_build_array(jsonb_build_object('id', 'e-trigger-demo-email-demo',
        'type', 'smoothstep', 'source', 'trigger-demo', 'target', 'email-demo'))
    )
  FROM (VALUES
    ('a3000000-0000-4000-8000-000000000001'::uuid,'Welcome new gardeners','contact.created','{}'::jsonb,
      '[{"type":"wait","days":1},{"type":"email","template":"welcome"}]'::jsonb,true,'ignore',
      '1 day','welcome','Welcome to Northfield Garden Center',
      'Thanks for joining us. Here is what is growing this week and how to get the most from your garden.'),
    ('a3000000-0000-4000-8000-000000000002'::uuid,'Bring lapsed customers back','repeat_purchase_90d','{"days":90}'::jsonb,
      '[{"type":"email","template":"we_miss_you"}]'::jsonb,true,'restart',
      'Immediate','we_miss_you','We miss you at Northfield',
      'It has been a while. Come see what is new in the garden centre this season.'),
    ('a3000000-0000-4000-8000-000000000003'::uuid,'First purchase care tips','first_purchase','{}'::jsonb,
      '[{"type":"wait","days":2},{"type":"email","template":"care_tips"}]'::jsonb,true,'ignore',
      '2 days','care_tips','Care tips for your new plants',
      'A few simple steps to help your new plants settle in and thrive.'),
    ('a3000000-0000-4000-8000-000000000004'::uuid,'Birthday garden gift','birthday','{}'::jsonb,
      '[{"type":"email","template":"birthday"}]'::jsonb,false,'ignore',
      'Immediate','birthday','A birthday gift from Northfield',
      'Happy birthday from all of us at Northfield Garden Center.')
  ) AS a(id, name, trigger_type, trigger_conditions, workflow_steps, is_active,
         overlap_behavior, delay_label, template, subject, content)
  ON CONFLICT (id) DO UPDATE SET
    is_active = EXCLUDED.is_active,
    flow_state = CASE
      WHEN NOT public.automation_flow_has_trigger(crm_automations.flow_state)
        OR crm_automations.flow_state @> '{"nodes":[{"id":"trigger-legacy"}]}'::jsonb
        THEN EXCLUDED.flow_state
      ELSE crm_automations.flow_state END
  WHERE crm_automations.is_active IS DISTINCT FROM EXCLUDED.is_active
     OR NOT public.automation_flow_has_trigger(crm_automations.flow_state)
     OR crm_automations.flow_state @> '{"nodes":[{"id":"trigger-legacy"}]}'::jsonb;

  INSERT INTO public.forms (
    id, tenant_id, name, status, fields_json, settings_json, compliance_json,
    embed_key, audience_json
  ) VALUES
    (v_form_newsletter,v_tenant,'Garden tips newsletter','published',
      '[{"id":"email","type":"email","label":"Email","required":true},{"id":"first_name","type":"text","label":"First name","required":true}]',
      '{"submit_button_text":"Join the garden list","success_message":"Welcome to Northfield!","show_branding":true}',
      '{"email_consent_required":true,"email_consent_text":"Send me seasonal garden tips.","double_opt_in":false,"gdpr_compliant":true}',
      md5(gen_random_uuid()::text),'{"tags":["Newsletter"]}'),
    (v_form_workshop,v_tenant,'Weekend workshop registration','published',
      '[{"id":"email","type":"email","label":"Email","required":true},{"id":"workshop","type":"select","label":"Workshop","required":true}]',
      '{"submit_button_text":"Reserve my place","success_message":"Your demo reservation is recorded.","show_branding":true}',
      '{"email_consent_required":false,"double_opt_in":false,"gdpr_compliant":true}',
      md5(gen_random_uuid()::text),'{"tags":["Workshop attendee"]}')
  -- Embed keys are 32-character hex (get-form-config rejects anything else).
  -- A key is only replaced when it is not already in that format.
  ON CONFLICT (id) DO UPDATE SET
    status = 'published',
    embed_key = CASE WHEN forms.embed_key ~ '^[0-9a-f]{32}$'
      THEN forms.embed_key ELSE EXCLUDED.embed_key END
    WHERE forms.status IS DISTINCT FROM 'published'
       OR forms.embed_key IS NULL
       OR forms.embed_key !~ '^[0-9a-f]{32}$';

  INSERT INTO public.form_submissions (
    tenant_id, form_id, customer_id, data, metadata, result, submitted_at
  )
  SELECT v_tenant,
    CASE WHEN ranked.rn % 3 = 0 THEN v_form_workshop ELSE v_form_newsletter END,
    ranked.id,
    jsonb_build_object('email', ranked.email, 'demo', true),
    jsonb_build_object('demo_record', true, 'demo_key', ranked.id::text),
    'accepted', now() - make_interval(days => (ranked.rn % 60)::int)
  FROM (
    SELECT id, email, row_number() OVER (ORDER BY id) rn
    FROM public.crm_customers
    WHERE tenant_id = v_tenant AND deleted_at IS NULL
    ORDER BY id LIMIT 240
  ) ranked
  WHERE NOT EXISTS (
    SELECT 1 FROM public.form_submissions fs
    WHERE fs.tenant_id = v_tenant AND fs.metadata->>'demo_key' = ranked.id::text
  );

  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY id) rn
    FROM public.form_submissions
    WHERE tenant_id = v_tenant AND metadata->>'demo_record' = 'true'
  )
  UPDATE public.form_submissions submission
  SET submitted_at = now() - make_interval(days => (ranked.rn % 60)::int)
  FROM ranked WHERE submission.id = ranked.id;

  -- Rolling demo sends (qa4 #3). Only rows this job seeded
  -- (metadata.demo_seed) are ever treated as sent; the job never changes a
  -- campaign's status and never touches rows people create at the demo
  -- tenant, so a draft can never become "sent" here. updated_at is kept.
  --  * sent_at is always after created_at and after scheduled_at.
  --  * every demo sent campaign has a real name and subject.
  --  * stored rates are percentages (like real campaigns), from the counts.
  PERFORM set_config('app.preserve_campaign_updated_at', 'on', true);
  WITH ranked AS (
    SELECT id, created_at, scheduled_at,
           row_number() OVER (ORDER BY created_at, id) rn
    FROM public.crm_campaigns
    WHERE tenant_id = v_tenant
      AND status = 'sent'
      AND (metadata->>'demo_seed') = 'true'
  ),
  names(rn, name, subject_line) AS (
    VALUES
      (1, 'Mother''s Day Hanging Baskets', 'For the gardener who raised a gardener — Mother''s Day baskets ready now'),
      (2, 'Spring Perennial Sale', 'Perennials are 25% off through Sunday'),
      (3, 'Patio Season Kickoff', 'Patio season is here — see what''s arrived'),
      (4, 'Fall Bulb Planting Guide', 'Plant now for a spring full of colour'),
      (5, 'Holiday Greenery Arrives', 'Wreaths, garland and fresh-cut trees are in')
  ),
  planned AS (
    SELECT ranked.id,
           ranked.rn,
           names.name AS seed_name,
           names.subject_line AS seed_subject,
           least(
             now() - interval '1 hour',
             greatest(
               now() - make_interval(days => (ranked.rn * 11)::int),
               greatest(ranked.created_at, coalesce(ranked.scheduled_at, ranked.created_at))
                 + interval '2 hours'
             )
           ) AS next_sent_at,
           (1800 + ranked.rn * 173)::int AS recipients,
           (760 + ranked.rn * 61)::int AS opens,
           (145 + ranked.rn * 13)::int AS clicks
    FROM ranked
    LEFT JOIN names ON names.rn = ((ranked.rn - 1) % 5) + 1
  )
  UPDATE public.crm_campaigns c
  SET sent_at = planned.next_sent_at,
      name = CASE
        WHEN btrim(coalesce(c.name, '')) = ''
          OR c.name ~* '^(untitled campaign|campaign [0-9a-f]{8})$'
          THEN planned.seed_name
        ELSE c.name END,
      subject_line = CASE
        WHEN btrim(coalesce(c.subject_line, '')) = '' THEN planned.seed_subject
        ELSE c.subject_line END,
      total_sent = planned.recipients,
      total_recipients = planned.recipients,
      total_opens = planned.opens,
      total_clicks = planned.clicks,
      open_rate = round(planned.opens::numeric * 100 / planned.recipients, 2),
      click_rate = round(planned.clicks::numeric * 100 / planned.recipients, 2),
      metrics = coalesce(c.metrics,'{}'::jsonb) || jsonb_build_object('demo_record',true,'refreshed_at',now())
  FROM planned
  WHERE c.id = planned.id
    -- Only a row that started before its send time can be a sent demo row.
    AND planned.next_sent_at > greatest(c.created_at, coalesce(c.scheduled_at, c.created_at));
  PERFORM set_config('app.preserve_campaign_updated_at', 'off', true);

  -- Static demo segments: the daily date shift moves customers across their
  -- rules (e.g. "This Season's Customers"), so membership is recomputed from
  -- each segment's own rule. Only the seeded segments are touched.
  IF to_regprocedure('intelligence_ops.recompute_greenfield_static_segments(uuid)') IS NOT NULL THEN
    PERFORM intelligence_ops.recompute_greenfield_static_segments(v_tenant);
  END IF;
END;
$function$;
