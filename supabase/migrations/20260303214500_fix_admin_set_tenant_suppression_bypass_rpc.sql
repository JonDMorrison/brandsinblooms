-- Ensure admin_set_tenant_suppression_bypass RPC exists and is visible to PostgREST.
-- Forward-only repair migration.

BEGIN;

-- Ensure the tenant control state table has the suppression bypass columns.
CREATE TABLE IF NOT EXISTS public.email_governance_tenant_control_state (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  suppression_bypass_enabled BOOLEAN NOT NULL DEFAULT false,
  suppression_bypass_until TIMESTAMPTZ,
  suppression_bypass_reason TEXT,
  suppression_bypass_automation_mode TEXT NOT NULL DEFAULT 'campaign_only',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  updated_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_governance_tenant_control_state
  ADD COLUMN IF NOT EXISTS suppression_bypass_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suppression_bypass_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suppression_bypass_reason TEXT,
  ADD COLUMN IF NOT EXISTS suppression_bypass_automation_mode TEXT NOT NULL DEFAULT 'campaign_only',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS updated_reason TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_suppression_bypass_mode_check'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_suppression_bypass_mode_check
      CHECK (suppression_bypass_automation_mode IN ('campaign_only', 'campaign_and_automation'));
  END IF;
END
$$;

-- Drop any stale variants so PostgREST schema cache can't get confused.
DROP FUNCTION IF EXISTS public.admin_set_tenant_suppression_bypass(UUID, BOOLEAN, TIMESTAMPTZ, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_set_tenant_suppression_bypass(UUID, BOOLEAN, TEXT, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.admin_set_tenant_suppression_bypass(UUID, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.admin_set_tenant_suppression_bypass(BOOLEAN, UUID, TIMESTAMPTZ, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_set_tenant_suppression_bypass(
  p_tenant_id UUID,
  p_enabled BOOLEAN,
  p_until TIMESTAMPTZ DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_automation_mode TEXT DEFAULT 'campaign_only'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_now TIMESTAMPTZ := now();
  v_mode TEXT := COALESCE(NULLIF(btrim(p_automation_mode), ''), 'campaign_only');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF v_mode NOT IN ('campaign_only', 'campaign_and_automation') THEN
    RAISE EXCEPTION 'Invalid p_automation_mode. Must be campaign_only or campaign_and_automation';
  END IF;

  IF COALESCE(p_enabled, false) = false THEN
    p_until := NULL;
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    suppression_bypass_enabled,
    suppression_bypass_until,
    suppression_bypass_reason,
    suppression_bypass_automation_mode,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    COALESCE(p_enabled, false),
    p_until,
    NULLIF(btrim(p_reason), ''),
    v_mode,
    v_now,
    v_actor,
    COALESCE(NULLIF(btrim(p_reason), ''), 'admin_set_tenant_suppression_bypass')
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    suppression_bypass_enabled = EXCLUDED.suppression_bypass_enabled,
    suppression_bypass_until = EXCLUDED.suppression_bypass_until,
    suppression_bypass_reason = EXCLUDED.suppression_bypass_reason,
    suppression_bypass_automation_mode = EXCLUDED.suppression_bypass_automation_mode,
    updated_at = v_now,
    updated_by = v_actor,
    updated_reason = EXCLUDED.updated_reason;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_suppression_bypass_updated',
    jsonb_build_object(
      'enabled', COALESCE(p_enabled, false),
      'until', p_until,
      'automation_mode', v_mode,
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'manual_suppression_bypass_update')
    )
  );

  -- Return the updated suppression bypass state.
  RETURN jsonb_build_object(
    'suppression_bypass_enabled', COALESCE(p_enabled, false),
    'suppression_bypass_until', p_until,
    'suppression_bypass_reason', NULLIF(btrim(p_reason), ''),
    'suppression_bypass_automation_mode', v_mode,
    'suppression_bypass_active', (
      COALESCE(p_enabled, false)
      AND (p_until IS NULL OR p_until > v_now)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_tenant_suppression_bypass(UUID, BOOLEAN, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;

-- Ensure PostgREST picks up the refreshed function definitions.
NOTIFY pgrst, 'reload schema';

COMMIT;
