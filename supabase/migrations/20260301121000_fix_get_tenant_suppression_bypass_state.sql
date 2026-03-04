-- Forward-only repair migration.
-- Ensures RPC exists with the exact signature expected by Edge Functions:
--   public.get_tenant_suppression_bypass_state(p_tenant_id uuid)

CREATE OR REPLACE FUNCTION public.get_tenant_suppression_bypass_state(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  BEGIN
    SELECT
      COALESCE(s.suppression_bypass_enabled, false) AS suppression_bypass_enabled,
      s.suppression_bypass_until,
      s.suppression_bypass_reason,
      COALESCE(s.suppression_bypass_automation_mode, 'campaign_only') AS suppression_bypass_automation_mode
    INTO v_row
    FROM public.email_governance_tenant_control_state s
    WHERE s.tenant_id = p_tenant_id;
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      v_row := NULL;
  END;

  RETURN jsonb_build_object(
    'suppression_bypass_enabled', COALESCE(v_row.suppression_bypass_enabled, false),
    'suppression_bypass_until', v_row.suppression_bypass_until,
    'suppression_bypass_reason', v_row.suppression_bypass_reason,
    'suppression_bypass_automation_mode', COALESCE(v_row.suppression_bypass_automation_mode, 'campaign_only'),
    'suppression_bypass_active', (
      COALESCE(v_row.suppression_bypass_enabled, false)
      AND (v_row.suppression_bypass_until IS NULL OR v_row.suppression_bypass_until > v_now)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_suppression_bypass_state(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_suppression_bypass_state(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
