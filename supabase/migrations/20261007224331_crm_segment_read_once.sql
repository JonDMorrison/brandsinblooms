-- Cache the existing all-company segment WRITE entitlement for SELECT only.
-- This is already a SELECT entitlement through crm_segments_manage_by_scope.
-- Reuse it once per statement instead of once per customer membership. Keep
-- original read rules and all location-limited behavior unchanged.
DO $migration$
DECLARE original_qual text;
BEGIN
  SELECT qual INTO original_qual FROM pg_policies WHERE schemaname='public'
    AND tablename='crm_segments' AND policyname='crm_segments_select_by_scope';
  IF original_qual IS NULL THEN RAISE EXCEPTION 'Segment read policy not found'; END IF;
  IF strpos(original_qual,'full_segment_read_candidates')>0 THEN RETURN; END IF;
  EXECUTE format($policy$
    ALTER POLICY crm_segments_select_by_scope ON public.crm_segments USING (
      tenant_id IN (
        SELECT full_segment_read_candidates.tenant_id FROM (
          SELECT app_user.tenant_id FROM public.users app_user WHERE app_user.id=(SELECT auth.uid())
          UNION
          SELECT context.active_tenant_id FROM public.admin_session_context context WHERE context.admin_user_id=(SELECT auth.uid())
        ) AS full_segment_read_candidates
        WHERE full_segment_read_candidates.tenant_id IS NOT NULL
          AND public.has_tenant_permission(full_segment_read_candidates.tenant_id,'segment.write',NULL)
      ) OR (%s)
    )
  $policy$,original_qual);
END $migration$;
