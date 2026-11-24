-- Per-tab master-admin workspace (newsletter QA pass 2, item #9).
--
-- public.admin_session_context keeps ONE active tenant per admin, so two
-- browser tabs of the same admin could not work in different companies: a
-- switch in one tab silently re-scoped every other tab's server checks.
--
-- The client now sends the tab's selection on every PostgREST request as the
-- `x-bloom-admin-tenant` header. public.admin_active_tenant_id() resolves the
-- caller's active tenant:
--   * not a master admin (or no JWT)       -> NULL (unchanged: the context row
--                                              was only ever honoured for master
--                                              admins)
--   * header "none"                        -> NULL (this tab has no company)
--   * header = an existing tenants.id      -> that tenant
--   * header present but anything else     -> NULL (fail closed)
--   * header absent (edge functions, old
--     clients, SQL)                        -> admin_session_context row, as before
--
-- Why this is no wider than before: the header is only honoured for master
-- admins, and a master admin could already point admin_session_context at any
-- tenant through the existing "Admins can manage their own session context"
-- policy. The header just lets each tab carry its own choice instead of the
-- single shared row. Every caller of the row is switched to the helper below;
-- comparisons are written so a NULL active tenant never grants access.
--
-- Additive only: no table or column changes; function signatures, return
-- types, grants and every other line of the rewritten bodies are unchanged
-- (each rewrite asserts that exactly the expected fragment was replaced).

CREATE OR REPLACE FUNCTION public.admin_active_tenant_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_header text;
  v_tenant_id uuid;
BEGIN
  IF v_user_id IS NULL OR NOT coalesce(public.is_master_admin(v_user_id), false) THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_header := btrim(
      nullif(current_setting('request.headers', true), '')::json
        ->> 'x-bloom-admin-tenant'
    );
  EXCEPTION WHEN others THEN
    v_header := NULL;
  END;

  IF v_header IS NOT NULL THEN
    IF lower(v_header) = 'none' THEN
      RETURN NULL;
    END IF;

    BEGIN
      v_tenant_id := v_header::uuid;
    EXCEPTION WHEN others THEN
      RETURN NULL;
    END;

    SELECT tenant.id
    INTO v_tenant_id
    FROM public.tenants AS tenant
    WHERE tenant.id = v_tenant_id;

    RETURN v_tenant_id;
  END IF;

  SELECT context.active_tenant_id
  INTO v_tenant_id
  FROM public.admin_session_context AS context
  WHERE context.admin_user_id = v_user_id;

  RETURN v_tenant_id;
END;
$function$;

COMMENT ON FUNCTION public.admin_active_tenant_id() IS
  'Active tenant of the calling master admin for this request: the x-bloom-admin-tenant header (per browser tab) when present, else admin_session_context. NULL for everyone else.';

REVOKE ALL ON FUNCTION public.admin_active_tenant_id() FROM PUBLIC;
-- Row-level policies call it as the querying role.
GRANT EXECUTE ON FUNCTION public.admin_active_tenant_id() TO anon, authenticated, service_role;

-- ---------------------------------------------------------------
-- Rewrite every reader of admin_session_context to use the helper.
-- ---------------------------------------------------------------
DO $migration$
DECLARE
  v_rewrite record;
  v_def text;
  v_new text;
BEGIN
  FOR v_rewrite IN
    SELECT *
    FROM (VALUES
      (
        'public.has_tenant_permission(uuid,text,uuid)',
        'RETURN EXISTS \(\s*SELECT 1\s+FROM public\.admin_session_context AS context\s+WHERE context\.admin_user_id = v_user_id\s+AND context\.active_tenant_id = p_tenant_id\s*\);',
        'RETURN coalesce(public.admin_active_tenant_id() = p_tenant_id, false);'
      ),
      (
        'public.bloom_can_access_tenant(uuid)',
        'EXISTS \(\s*SELECT 1 FROM public\.admin_session_context context\s+WHERE context\.admin_user_id = auth\.uid\(\)\s+AND context\.active_tenant_id = p_tenant_id\s*\)',
        'coalesce(public.admin_active_tenant_id() = p_tenant_id, false)'
      ),
      (
        'public.get_current_crm_access()',
        'SELECT context\.active_tenant_id\s+INTO v_tenant_id\s+FROM public\.admin_session_context AS context\s+WHERE context\.admin_user_id = v_user_id;',
        'v_tenant_id := public.admin_active_tenant_id();'
      ),
      (
        'public.get_customer_catalog_stats()',
        'SELECT admin_context\.active_tenant_id\s+INTO v_tenant_id\s+FROM public\.admin_session_context AS admin_context\s+WHERE admin_context\.admin_user_id = v_user_id;',
        'v_tenant_id := public.admin_active_tenant_id();'
      ),
      (
        'public.protect_user_crm_role()',
        'NOT EXISTS \(\s*SELECT 1 FROM public\.admin_session_context AS context\s+WHERE context\.admin_user_id = v_actor\s+AND context\.active_tenant_id = OLD\.tenant_id\s*\)',
        'NOT coalesce(public.admin_active_tenant_id() = OLD.tenant_id, false)'
      ),
      (
        'public.get_crm_dashboard_snapshot(uuid,uuid)',
        'NOT EXISTS \(\s*SELECT 1\s+FROM public\.admin_session_context admin_context\s+WHERE admin_context\.admin_user_id = v_actor_user_id\s+AND admin_context\.active_tenant_id = p_tenant_id\s*\)',
        'NOT coalesce(public.admin_active_tenant_id() = p_tenant_id, false)'
      )
    ) AS rewrites(signature, pattern, replacement)
  LOOP
    v_def := pg_get_functiondef(v_rewrite.signature::regprocedure);
    v_new := regexp_replace(v_def, v_rewrite.pattern, v_rewrite.replacement);

    IF v_new = v_def OR v_new ILIKE '%admin_session_context%' THEN
      RAISE EXCEPTION 'admin tab scope: unexpected body for %', v_rewrite.signature;
    END IF;

    EXECUTE v_new;
  END LOOP;
END;
$migration$;

DO $migration$
DECLARE
  v_policy record;
  v_new text;
BEGIN
  FOR v_policy IN
    SELECT policy.tablename, policy.policyname, policy.qual
    FROM pg_policies AS policy
    WHERE policy.schemaname = 'public'
      AND (policy.tablename, policy.policyname) IN (
        ('crm_customers', 'crm_customers_select_by_scope'),
        ('crm_segments', 'crm_segments_select_by_scope'),
        ('customer_segments', 'customer_segments_select_by_scope')
      )
  LOOP
    v_new := regexp_replace(
      v_policy.qual,
      'SELECT context\.active_tenant_id\s+FROM admin_session_context context\s+WHERE \(context\.admin_user_id = \( SELECT auth\.uid\(\) AS uid\)\)',
      'SELECT public.admin_active_tenant_id() AS active_tenant_id',
      'g'
    );

    IF v_new = v_policy.qual OR v_new ILIKE '%admin_session_context%' THEN
      RAISE EXCEPTION 'admin tab scope: unexpected policy %.%', v_policy.tablename, v_policy.policyname;
    END IF;

    EXECUTE format(
      'ALTER POLICY %I ON public.%I USING (%s)',
      v_policy.policyname,
      v_policy.tablename,
      v_new
    );
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_policies AS policy
    WHERE policy.schemaname = 'public'
      AND policy.tablename <> 'admin_session_context'
      AND (coalesce(policy.qual, '') ILIKE '%admin_session_context%'
        OR coalesce(policy.with_check, '') ILIKE '%admin_session_context%')
  ) THEN
    RAISE EXCEPTION 'admin tab scope: a policy still reads admin_session_context';
  END IF;
END;
$migration$;
