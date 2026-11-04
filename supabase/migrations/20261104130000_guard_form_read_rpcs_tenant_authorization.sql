-- get_forms_with_stats, get_form_submissions_page and get_form_analytics are
-- SECURITY DEFINER, so they bypass RLS on forms/form_submissions. All three
-- are granted to `authenticated` and took p_tenant_id straight from the
-- client with no authorization check, so any logged-in user could read any
-- other tenant's forms, submissions (contact PII) and analytics.
--
-- This inserts the same caller check delete_form_submissions already uses,
-- plus the master-admin exemption the admin tenant switcher depends on.
-- Bodies are otherwise preserved byte-for-byte: the guard is spliced in
-- after each function's single top-level BEGIN.
DO $mig$
DECLARE
  r record;
  v_def text;
  v_new text;
  v_pos int;
  v_marker constant text := E'\nBEGIN\n';
  v_guard constant text := $guard$  -- Tenant authorization: this function is SECURITY DEFINER and therefore
  -- bypasses RLS. Without this check any authenticated caller could pass an
  -- arbitrary p_tenant_id and read another tenant's data.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR NOT (
      EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.tenant_id = p_tenant_id
      )
      OR public.is_master_admin(auth.uid())
    ) THEN
      RAISE EXCEPTION 'Not authorized'
        USING ERRCODE = '42501';
    END IF;
  END IF;

$guard$;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'get_forms_with_stats',
        'get_form_submissions_page',
        'get_form_analytics'
      )
  LOOP
    v_def := pg_get_functiondef(r.oid);

    IF v_def ILIKE '%Not authorized%' THEN
      RAISE NOTICE 'skipping % (already guarded)', r.proname;
      CONTINUE;
    END IF;

    v_pos := position(v_marker in v_def);
    IF v_pos = 0 THEN
      RAISE EXCEPTION 'could not locate top-level BEGIN in %', r.proname;
    END IF;

    v_new := substr(v_def, 1, v_pos + length(v_marker) - 1)
             || v_guard
             || substr(v_def, v_pos + length(v_marker));

    EXECUTE v_new;
    RAISE NOTICE 'guarded %', r.proname;
  END LOOP;
END
$mig$;
