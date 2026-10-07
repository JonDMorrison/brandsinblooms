-- Cache only existing company-wide read authorization for this SQL statement.
-- Owner/admin/marketing and an explicitly selected master-admin company qualify
-- through the existing permission function. Location-limited roles still use
-- the ORIGINAL policy unchanged. No caller-controlled tenant claim is trusted.
DO $migration$
DECLARE original_qual text;
BEGIN
  SELECT qual INTO original_qual FROM pg_policies
   WHERE schemaname='public' AND tablename='crm_customers'
     AND policyname='crm_customers_select_by_scope';
  IF original_qual IS NULL THEN RAISE EXCEPTION 'Customer read policy not found'; END IF;
  IF strpos(original_qual,'full_read_candidates')>0 THEN RETURN; END IF;
  EXECUTE format($policy$
    ALTER POLICY crm_customers_select_by_scope ON public.crm_customers USING (
      tenant_id IN (
        SELECT full_read_candidates.tenant_id FROM (
          SELECT app_user.tenant_id FROM public.users app_user
            WHERE app_user.id=(SELECT auth.uid())
          UNION
          SELECT context.active_tenant_id FROM public.admin_session_context context
            WHERE context.admin_user_id=(SELECT auth.uid())
        ) AS full_read_candidates
        WHERE full_read_candidates.tenant_id IS NOT NULL
          AND public.has_tenant_permission(full_read_candidates.tenant_id,'customer.read',NULL)
      ) OR (%s)
    )
  $policy$,original_qual);
END $migration$;
