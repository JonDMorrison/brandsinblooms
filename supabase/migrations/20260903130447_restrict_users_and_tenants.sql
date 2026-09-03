-- Restrict tenant and user identity data to the authenticated principal.
-- Tenant creation is atomic so onboarding never needs broad table grants.

DROP POLICY IF EXISTS "Allow all operations on users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own record" ON public.users;
DROP POLICY IF EXISTS "Master admins can view user records" ON public.users;

REVOKE ALL ON TABLE public.users FROM anon, authenticated;
GRANT SELECT ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;

CREATE POLICY "Users can view their own record"
ON public.users
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND (
    id = (SELECT auth.uid())
    OR public.is_master_admin((SELECT auth.uid()))
  )
);

DROP POLICY IF EXISTS "Users can view accessible tenants" ON public.tenants;
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;
DROP POLICY IF EXISTS "Users can update their tenant" ON public.tenants;
DROP POLICY IF EXISTS "Users can delete their tenant" ON public.tenants;
DROP POLICY IF EXISTS "Tenant members can view their tenant" ON public.tenants;
DROP POLICY IF EXISTS "Tenant members can update their tenant" ON public.tenants;

REVOKE ALL ON TABLE public.tenants FROM anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.tenants TO authenticated;
GRANT ALL ON TABLE public.tenants TO service_role;

CREATE POLICY "Tenant members can view their tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND (
    public.is_master_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND app_user.tenant_id = tenants.id
    )
  )
);

CREATE POLICY "Tenant members can update their tenant"
ON public.tenants
FOR UPDATE
TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND (
    public.is_master_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND app_user.tenant_id = tenants.id
    )
  )
)
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND (
    public.is_master_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND app_user.tenant_id = tenants.id
    )
  )
);

CREATE OR REPLACE FUNCTION public.create_current_user_tenant(p_name text)
RETURNS SETOF public.tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_display_name text;
  v_existing_tenant_id uuid;
  v_tenant public.tenants%ROWTYPE;
  v_slug text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- Serialize onboarding retries for this authenticated account.
  SELECT
    auth_user.email,
    coalesce(
      nullif(auth_user.raw_user_meta_data->>'full_name', ''),
      nullif(split_part(auth_user.email, '@', 1), ''),
      'User'
    )
  INTO v_email, v_display_name
  FROM auth.users AS auth_user
  WHERE auth_user.id = v_user_id
  FOR UPDATE;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Authenticated user record not found' USING ERRCODE = '42501';
  END IF;

  SELECT app_user.tenant_id
  INTO v_existing_tenant_id
  FROM public.users AS app_user
  WHERE app_user.id = v_user_id
  FOR UPDATE;

  IF v_existing_tenant_id IS NOT NULL THEN
    RETURN QUERY
    SELECT tenant.*
    FROM public.tenants AS tenant
    WHERE tenant.id = v_existing_tenant_id;
    RETURN;
  END IF;

  v_slug := 'tenant-' || left(replace(v_user_id::text, '-', ''), 16);

  IF EXISTS (SELECT 1 FROM public.tenants AS tenant WHERE tenant.slug = v_slug) THEN
    v_slug := v_slug || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);
  END IF;

  INSERT INTO public.tenants (name, slug, settings, is_active)
  VALUES (
    coalesce(nullif(left(trim(p_name), 160), ''), 'My Garden Center'),
    v_slug,
    '{}'::jsonb,
    true
  )
  RETURNING * INTO v_tenant;

  INSERT INTO public.users (id, tenant_id, email, name, full_name)
  VALUES (v_user_id, v_tenant.id, v_email, v_display_name, v_display_name)
  ON CONFLICT (id) DO UPDATE
  SET tenant_id = CASE
        WHEN users.tenant_id IS NULL THEN EXCLUDED.tenant_id
        ELSE users.tenant_id
      END,
      email = EXCLUDED.email,
      name = coalesce(nullif(users.name, ''), EXCLUDED.name),
      full_name = coalesce(nullif(users.full_name, ''), EXCLUDED.full_name);

  SELECT app_user.tenant_id
  INTO v_existing_tenant_id
  FROM public.users AS app_user
  WHERE app_user.id = v_user_id;

  IF v_existing_tenant_id <> v_tenant.id THEN
    RAISE EXCEPTION 'User is already assigned to another tenant' USING ERRCODE = '42501';
  END IF;

  RETURN NEXT v_tenant;
END;
$$;

REVOKE ALL ON FUNCTION public.create_current_user_tenant(text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_current_user_tenant(text)
TO authenticated, service_role;

COMMENT ON FUNCTION public.create_current_user_tenant(text) IS
  'Atomically creates and assigns the authenticated user tenant during onboarding.';
