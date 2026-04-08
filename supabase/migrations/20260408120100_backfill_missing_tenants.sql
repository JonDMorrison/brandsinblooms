-- Backfill: create missing tenants rows and link public.users.tenant_id for the
-- 9 users who signed up between the 20251003141736 one-time backfill and the
-- 20260408120000 root-cause trigger fix.
--
-- Erica (erica@waltersgreenhouse.ca, id 6a442ffe-bf0d-4f8b-afa7-4b59010a0e55)
-- gets an explicit "Walter's Greenhouse" tenant name. Every other broken user
-- gets a tenant name derived from their signup metadata, full name, or email.
--
-- To verify after running:
--   SELECT au.email, u.tenant_id
--   FROM auth.users au
--   JOIN public.users u ON u.id = au.id
--   WHERE u.tenant_id IS NULL;
--   -- expected: 0 rows

DO $$
DECLARE
  r RECORD;
  v_tenant_id uuid;
  v_tenant_name text;
  v_slug text;
  v_fixed_count int := 0;
  v_ericas_id constant uuid := '6a442ffe-bf0d-4f8b-afa7-4b59010a0e55';
BEGIN
  ------------------------------------------------------------------
  -- 1. Erica specifically (Walter's Greenhouse)
  ------------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_ericas_id AND tenant_id IS NULL
  ) THEN
    INSERT INTO public.tenants (name, slug, is_active)
    VALUES (
      'Walter''s Greenhouse',
      'walters-greenhouse-' || substr(v_ericas_id::text, 1, 8),
      true
    )
    RETURNING id INTO v_tenant_id;

    UPDATE public.users
    SET tenant_id = v_tenant_id
    WHERE id = v_ericas_id;

    INSERT INTO public.company_profiles (user_id, company_name)
    VALUES (v_ericas_id, 'Walter''s Greenhouse')
    ON CONFLICT (user_id) DO UPDATE SET
      company_name = COALESCE(public.company_profiles.company_name, 'Walter''s Greenhouse'),
      updated_at = now();

    -- Erica's subscriptions row already exists (plan: free_trial); leave it alone.

    v_fixed_count := v_fixed_count + 1;
    RAISE NOTICE 'Fixed Erica (%) -> tenant %', v_ericas_id, v_tenant_id;
  ELSE
    RAISE NOTICE 'Erica (%) already has tenant_id or public.users row missing -- skipping', v_ericas_id;
  END IF;

  ------------------------------------------------------------------
  -- 2. Every other broken account
  ------------------------------------------------------------------
  FOR r IN
    SELECT u.id, u.email, u.name, au.raw_user_meta_data
    FROM public.users u
    JOIN auth.users au ON au.id = u.id
    WHERE u.tenant_id IS NULL
  LOOP
    v_tenant_name := COALESCE(
      NULLIF(btrim(r.raw_user_meta_data->>'company_name'), ''),
      NULLIF(btrim(r.raw_user_meta_data->>'business_name'), ''),
      NULLIF(btrim(r.raw_user_meta_data->>'full_name'), ''),
      NULLIF(r.name, ''),
      split_part(COALESCE(r.email, ''), '@', 1),
      'Organization'
    );

    v_slug := lower(regexp_replace(
      COALESCE(r.email, r.id::text),
      '[^a-z0-9]+', '-', 'g'
    )) || '-' || substr(r.id::text, 1, 8);

    INSERT INTO public.tenants (name, slug, is_active)
    VALUES (v_tenant_name, v_slug, true)
    RETURNING id INTO v_tenant_id;

    UPDATE public.users
    SET tenant_id = v_tenant_id
    WHERE id = r.id;

    -- company_profiles may or may not already exist (handle_new_user_team should
    -- have created one). If it exists, just backfill company_name if null.
    INSERT INTO public.company_profiles (user_id, company_name)
    VALUES (r.id, v_tenant_name)
    ON CONFLICT (user_id) DO UPDATE SET
      company_name = COALESCE(public.company_profiles.company_name, EXCLUDED.company_name),
      updated_at = now();

    -- subscriptions should already exist via handle_new_user_subscription, but
    -- insert a free_trial row if for some reason it doesn't.
    INSERT INTO public.subscriptions (user_id, plan, start_date, end_date)
    SELECT r.id, 'free_trial', CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.subscriptions WHERE user_id = r.id
    );

    v_fixed_count := v_fixed_count + 1;
    RAISE NOTICE 'Fixed % (%) -> tenant %', r.email, r.id, v_tenant_id;
  END LOOP;

  RAISE NOTICE 'Backfill complete: % account(s) fixed', v_fixed_count;
END $$;
