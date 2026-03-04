BEGIN;

-- Repair migration:
-- 1) Ensure campaign intervention table has override expiry columns.
-- 2) Remove the ambiguous 6-arg overload of admin_set_campaign_intervention_state.

ALTER TABLE IF EXISTS public.email_governance_campaign_intervention_state
  ADD COLUMN IF NOT EXISTS autopause_override_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS autopause_override_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_campaign_intervention_override_expiry
  ON public.email_governance_campaign_intervention_state (autopause_override_until)
  WHERE autopause_override_enabled = true
    AND autopause_override_until IS NOT NULL;

-- Remove the 6-arg overload; it collides with the 7-arg function that has defaults.
DROP FUNCTION IF EXISTS public.admin_set_campaign_intervention_state(UUID, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT);

-- Ensure the canonical 7-arg RPC exists (matches milestone9 semantics).
CREATE OR REPLACE FUNCTION public.admin_set_campaign_intervention_state(
  p_campaign_id UUID,
  p_admin_paused BOOLEAN,
  p_force_stopped BOOLEAN,
  p_autopause_override_enabled BOOLEAN,
  p_autopause_override_precedence TEXT DEFAULT 'automation_allowed',
  p_reason TEXT DEFAULT NULL,
  p_autopause_override_until TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_tenant_id UUID;
  v_precedence TEXT := CASE
    WHEN lower(COALESCE(p_autopause_override_precedence, 'automation_allowed')) = 'final_override' THEN 'final_override'
    ELSE 'automation_allowed'
  END;
  v_effective_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'campaign_intervention_state_updated');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_campaign_id IS NULL THEN
    RAISE EXCEPTION 'p_campaign_id is required';
  END IF;

  IF COALESCE(p_autopause_override_enabled, false)
    AND p_autopause_override_until IS NOT NULL
    AND p_autopause_override_until <= now() THEN
    RAISE EXCEPTION 'p_autopause_override_until must be in the future when provided';
  END IF;

  SELECT c.tenant_id
  INTO v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  INSERT INTO public.email_governance_campaign_intervention_state (
    campaign_id,
    tenant_id,
    admin_paused,
    force_stopped,
    autopause_override_enabled,
    autopause_override_precedence,
    autopause_override_until,
    autopause_override_reason,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_campaign_id,
    v_tenant_id,
    COALESCE(p_admin_paused, false),
    COALESCE(p_force_stopped, false),
    COALESCE(p_autopause_override_enabled, false),
    v_precedence,
    CASE WHEN COALESCE(p_autopause_override_enabled, false) THEN p_autopause_override_until ELSE NULL END,
    CASE WHEN COALESCE(p_autopause_override_enabled, false) THEN v_effective_reason ELSE NULL END,
    now(),
    v_actor,
    v_effective_reason
  )
  ON CONFLICT (campaign_id)
  DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    admin_paused = EXCLUDED.admin_paused,
    force_stopped = EXCLUDED.force_stopped,
    autopause_override_enabled = EXCLUDED.autopause_override_enabled,
    autopause_override_precedence = EXCLUDED.autopause_override_precedence,
    autopause_override_until = EXCLUDED.autopause_override_until,
    autopause_override_reason = EXCLUDED.autopause_override_reason,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    v_tenant_id,
    'campaign_intervention_state_updated',
    jsonb_build_object(
      'campaign_id', p_campaign_id,
      'admin_paused', COALESCE(p_admin_paused, false),
      'force_stopped', COALESCE(p_force_stopped, false),
      'autopause_override_enabled', COALESCE(p_autopause_override_enabled, false),
      'autopause_override_precedence', v_precedence,
      'autopause_override_until', CASE WHEN COALESCE(p_autopause_override_enabled, false) THEN p_autopause_override_until ELSE NULL END,
      'reason', v_effective_reason
    )
  );

  RETURN jsonb_build_object(
    'campaign_id', p_campaign_id,
    'tenant_id', v_tenant_id,
    'admin_paused', COALESCE(p_admin_paused, false),
    'force_stopped', COALESCE(p_force_stopped, false),
    'autopause_override_enabled', COALESCE(p_autopause_override_enabled, false),
    'autopause_override_precedence', v_precedence,
    'autopause_override_until', CASE WHEN COALESCE(p_autopause_override_enabled, false) THEN p_autopause_override_until ELSE NULL END,
    'reason', v_effective_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_campaign_intervention_state(UUID, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
