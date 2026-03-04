-- Ensure the admin tenant governance override RPC exists with the expected signature.
-- This is intentionally a new migration (do not edit already-applied migrations).

BEGIN;

-- Drop any stale variants so PostgREST schema cache can't get confused.
DROP FUNCTION IF EXISTS public.admin_set_tenant_email_governance_overrides(UUID, JSONB, TEXT);
DROP FUNCTION IF EXISTS public.admin_set_tenant_email_governance_overrides(JSONB, TEXT, UUID);
DROP FUNCTION IF EXISTS public.admin_set_tenant_email_governance_overrides(JSONB, UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_set_tenant_email_governance_overrides(TEXT, JSONB, UUID);

CREATE OR REPLACE FUNCTION public.admin_set_tenant_email_governance_overrides(
  p_tenant_id UUID,
  p_overrides JSONB,
  p_reason TEXT DEFAULT 'manual_update'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_old JSONB;
  v_new JSONB;
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'manual_update');
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  v_actor := auth.uid();
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  PERFORM 1
  FROM public.tenants t
  WHERE t.id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found: %', p_tenant_id;
  END IF;

  SELECT overrides
    INTO v_old
  FROM public.tenant_email_governance_overrides
  WHERE tenant_id = p_tenant_id;

  PERFORM public.validate_tenant_email_governance_overrides(COALESCE(p_overrides, '{}'::jsonb));

  INSERT INTO public.tenant_email_governance_overrides (
    tenant_id,
    overrides,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    COALESCE(p_overrides, '{}'::jsonb),
    now(),
    v_actor,
    v_reason
  )
  ON CONFLICT (tenant_id) DO UPDATE
  SET overrides = EXCLUDED.overrides,
      updated_at = now(),
      updated_by = EXCLUDED.updated_by,
      updated_reason = EXCLUDED.updated_reason;

  SELECT overrides
    INTO v_new
  FROM public.tenant_email_governance_overrides
  WHERE tenant_id = p_tenant_id;

  PERFORM public.log_admin_action(
    'tenant_governance_overrides_updated',
    p_tenant_id,
    NULL,
    jsonb_build_object(
      'reason', v_reason,
      'old_overrides', COALESCE(v_old, '{}'::jsonb),
      'new_overrides', COALESCE(v_new, '{}'::jsonb)
    )
  );

  RETURN COALESCE(v_new, '{}'::jsonb);
END;
$$;

-- Back-compat wrapper: if any clients/Edge functions call with different param ordering,
-- provide an alternate signature and forward to the canonical function.
CREATE OR REPLACE FUNCTION public.admin_set_tenant_email_governance_overrides(
  p_overrides JSONB,
  p_reason TEXT,
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.admin_set_tenant_email_governance_overrides(p_tenant_id, p_overrides, p_reason);
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_tenant_email_governance_overrides(UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_tenant_email_governance_overrides(JSONB, TEXT, UUID) TO authenticated;

-- Ensure PostgREST picks up the refreshed function definitions.
NOTIFY pgrst, 'reload schema';

COMMIT;
