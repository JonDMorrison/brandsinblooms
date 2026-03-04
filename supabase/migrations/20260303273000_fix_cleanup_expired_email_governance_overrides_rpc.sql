BEGIN;

-- Repair migration: restore cleanup_expired_email_governance_overrides RPC
-- This is called by various admin/automation RPCs and cron.

DROP FUNCTION IF EXISTS public.cleanup_expired_email_governance_overrides(TEXT, UUID, UUID);

CREATE OR REPLACE FUNCTION public.cleanup_expired_email_governance_overrides(
  p_source TEXT DEFAULT 'system',
  p_tenant_id UUID DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_source TEXT := COALESCE(NULLIF(btrim(p_source), ''), 'system');
  v_campaign_cleared INTEGER := 0;
  v_tenant_reputation_cleared INTEGER := 0;
  v_tenant_suppression_cleared INTEGER := 0;
  v_tenant_under_review_cleared INTEGER := 0;
BEGIN
  WITH expired_campaign_overrides AS (
    UPDATE public.email_governance_campaign_intervention_state s
    SET
      autopause_override_enabled = false,
      autopause_override_precedence = 'automation_allowed',
      autopause_override_until = NULL,
      autopause_override_reason = NULL,
      updated_at = v_now,
      updated_reason = 'autopause_override_expired'
    WHERE COALESCE(s.autopause_override_enabled, false) = true
      AND s.autopause_override_until IS NOT NULL
      AND s.autopause_override_until <= v_now
      AND (p_campaign_id IS NULL OR s.campaign_id = p_campaign_id)
      AND (p_tenant_id IS NULL OR s.tenant_id = p_tenant_id)
    RETURNING s.campaign_id, s.tenant_id
  ), logged AS (
    INSERT INTO public.email_governance_audit_logs (
      tenant_id,
      actor_type,
      action_type,
      decision,
      reason,
      policy_name,
      policy_version,
      campaign_id,
      metadata,
      occurred_at
    )
    SELECT
      e.tenant_id,
      'system',
      'campaign_autopause_override_expired',
      'log',
      'Campaign auto-pause override expired and was reverted.',
      'milestone9_automation_precedence',
      '2026-02-27',
      e.campaign_id,
      jsonb_build_object('source', v_source),
      v_now
    FROM expired_campaign_overrides e
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO v_campaign_cleared FROM logged;

  WITH expired_reputation_overrides AS (
    UPDATE public.email_governance_tenant_control_state s
    SET
      manual_reputation_score = NULL,
      reputation_override_mode = NULL,
      reputation_override_expires_at = NULL,
      reputation_override_reason = NULL,
      updated_at = v_now,
      updated_reason = 'reputation_override_expired'
    WHERE s.reputation_override_mode = 'temporary'
      AND s.reputation_override_expires_at IS NOT NULL
      AND s.reputation_override_expires_at <= v_now
      AND (p_tenant_id IS NULL OR s.tenant_id = p_tenant_id)
    RETURNING s.tenant_id
  ), logged AS (
    INSERT INTO public.email_governance_audit_logs (
      tenant_id,
      actor_type,
      action_type,
      decision,
      reason,
      policy_name,
      policy_version,
      metadata,
      occurred_at
    )
    SELECT
      e.tenant_id,
      'system',
      'tenant_reputation_override_expired',
      'log',
      'Tenant reputation override expired and was reverted.',
      'milestone9_automation_precedence',
      '2026-02-27',
      jsonb_build_object('source', v_source),
      v_now
    FROM expired_reputation_overrides e
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO v_tenant_reputation_cleared FROM logged;

  WITH expired_suppression_bypass AS (
    UPDATE public.email_governance_tenant_control_state s
    SET
      suppression_bypass_enabled = false,
      suppression_bypass_until = NULL,
      suppression_bypass_reason = NULL,
      updated_at = v_now,
      updated_reason = 'suppression_bypass_expired'
    WHERE COALESCE(s.suppression_bypass_enabled, false) = true
      AND s.suppression_bypass_until IS NOT NULL
      AND s.suppression_bypass_until <= v_now
      AND (p_tenant_id IS NULL OR s.tenant_id = p_tenant_id)
    RETURNING s.tenant_id
  ), logged AS (
    INSERT INTO public.email_governance_audit_logs (
      tenant_id,
      actor_type,
      action_type,
      decision,
      reason,
      policy_name,
      policy_version,
      metadata,
      occurred_at
    )
    SELECT
      e.tenant_id,
      'system',
      'tenant_suppression_bypass_expired',
      'log',
      'Tenant suppression bypass expired and was reverted.',
      'milestone9_automation_precedence',
      '2026-02-27',
      jsonb_build_object('source', v_source),
      v_now
    FROM expired_suppression_bypass e
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO v_tenant_suppression_cleared FROM logged;

  WITH expired_under_review_overrides AS (
    UPDATE public.email_governance_tenant_control_state s
    SET
      under_review_override_enabled = false,
      under_review_override_precedence = 'automation_allowed',
      under_review_override_until = NULL,
      under_review_override_reason = NULL,
      updated_at = v_now,
      updated_reason = 'under_review_override_expired'
    WHERE COALESCE(s.under_review_override_enabled, false) = true
      AND s.under_review_override_until IS NOT NULL
      AND s.under_review_override_until <= v_now
      AND (p_tenant_id IS NULL OR s.tenant_id = p_tenant_id)
    RETURNING s.tenant_id
  ), logged AS (
    INSERT INTO public.email_governance_audit_logs (
      tenant_id,
      actor_type,
      action_type,
      decision,
      reason,
      policy_name,
      policy_version,
      metadata,
      occurred_at
    )
    SELECT
      e.tenant_id,
      'system',
      'tenant_under_review_override_expired',
      'log',
      'Tenant under-review override expired and was reverted.',
      'milestone9_automation_precedence',
      '2026-02-27',
      jsonb_build_object('source', v_source),
      v_now
    FROM expired_under_review_overrides e
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO v_tenant_under_review_cleared FROM logged;

  RETURN jsonb_build_object(
    'campaign_overrides_cleared', COALESCE(v_campaign_cleared, 0),
    'tenant_reputation_overrides_cleared', COALESCE(v_tenant_reputation_cleared, 0),
    'tenant_suppression_bypass_cleared', COALESCE(v_tenant_suppression_cleared, 0),
    'tenant_under_review_overrides_cleared', COALESCE(v_tenant_under_review_cleared, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_email_governance_overrides(TEXT, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_email_governance_overrides(TEXT, UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
