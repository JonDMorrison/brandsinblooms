-- Milestone 2: Reputation Engine + Silent Admin Override hardening
-- - Makes manual overrides silent for tenants by removing tenant table-level read access.
-- - Restricts direct scoring refresh RPC execution to service role.
-- - Adds explicit admin action to clear manual override and resume automation.
-- - Schedules 6-hour tenant reputation recompute cron.

-- Silent override: tenants should consume effective reputation via visibility RPCs,
-- not by reading low-level score tables that expose scoring source internals.
DROP POLICY IF EXISTS "email_gov_reputation_scores_select"
  ON public.email_governance_tenant_reputation_scores;

CREATE POLICY "email_gov_reputation_scores_select"
  ON public.email_governance_tenant_reputation_scores
  FOR SELECT
  TO authenticated
  USING (public.is_master_admin(auth.uid()));

DROP POLICY IF EXISTS "email_gov_reputation_score_history_select"
  ON public.email_governance_tenant_reputation_score_history;

CREATE POLICY "email_gov_reputation_score_history_select"
  ON public.email_governance_tenant_reputation_score_history
  FOR SELECT
  TO authenticated
  USING (public.is_master_admin(auth.uid()));

-- Prevent authenticated users from invoking cross-tenant recompute primitives directly.
REVOKE EXECUTE ON FUNCTION public.refresh_email_governance_tenant_reputation_score(UUID, TIMESTAMPTZ) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_email_governance_all_tenant_reputation_scores(TIMESTAMPTZ, INTEGER, INTEGER) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.refresh_email_governance_tenant_reputation_score(UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_email_governance_all_tenant_reputation_scores(TIMESTAMPTZ, INTEGER, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_clear_tenant_reputation_override(
  p_tenant_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'reputation_override_cleared');
  v_result JSONB;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    manual_reputation_score,
    reputation_override_mode,
    reputation_override_expires_at,
    reputation_override_reason,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    NULL,
    NULL,
    NULL,
    NULL,
    now(),
    v_actor,
    v_reason
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    manual_reputation_score = NULL,
    reputation_override_mode = NULL,
    reputation_override_expires_at = NULL,
    reputation_override_reason = NULL,
    updated_at = now(),
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  v_result := public.refresh_email_governance_tenant_reputation_score(p_tenant_id, now());

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_reputation_override_cleared',
    jsonb_build_object('reason', v_reason)
  );

  RETURN jsonb_build_object(
    'override_cleared', true,
    'reason', v_reason,
    'score_result', v_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_clear_tenant_reputation_override(UUID, TEXT) TO authenticated;

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  BEGIN
    SELECT j.jobid
    INTO v_job_id
    FROM cron.job j
    WHERE j.jobname = 'cron-recompute-tenant-reputation-6h'
    LIMIT 1;

    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;

    PERFORM cron.schedule(
      'cron-recompute-tenant-reputation-6h',
      '0 */6 * * *',
      $job$
      SELECT
        net.http_post(
          url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/cron-recompute-tenant-reputation',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
          ),
          body := jsonb_build_object(
            'page_size', 200,
            'max_pages', 500
          )
        );
      $job$
    );
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;
END;
$$;

NOTIFY pgrst, 'reload schema';
