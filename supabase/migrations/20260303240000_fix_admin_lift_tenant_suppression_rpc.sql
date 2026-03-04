-- Ensure admin_lift_tenant_suppression RPC exists and is visible to PostgREST.
-- Fixes: "Could not find the function public.admin_lift_tenant_suppression(...) in the schema cache"

-- Drop any stale variants so PostgREST can't get confused.
DROP FUNCTION IF EXISTS public.admin_lift_tenant_suppression(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_lift_tenant_suppression(TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS public.admin_lift_tenant_suppression(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.admin_lift_tenant_suppression(UUID, UUID);

CREATE OR REPLACE FUNCTION public.admin_lift_tenant_suppression(
  p_tenant_id UUID,
  p_suppression_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_row RECORD;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL OR p_suppression_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id and p_suppression_id are required';
  END IF;

  UPDATE public.suppression_list s
  SET
    lifted_at = now(),
    lifted_by = v_actor,
    updated_at = now()
  WHERE s.tenant_id = p_tenant_id
    AND s.id = p_suppression_id
    AND s.lifted_at IS NULL
  RETURNING s.id, s.email, s.suppression_type INTO v_row;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('updated_count', 0);
  END IF;

  INSERT INTO public.email_governance_suppression_events (
    tenant_id,
    email,
    channel,
    suppression_type,
    reason,
    source,
    is_active,
    metadata,
    occurred_at
  ) VALUES (
    p_tenant_id,
    v_row.email,
    'email',
    v_row.suppression_type,
    NULLIF(btrim(p_reason), ''),
    'admin',
    false,
    jsonb_build_object('admin_user_id', v_actor, 'lifted_from_suppression_id', v_row.id),
    now()
  );

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_suppression_lifted',
    jsonb_build_object(
      'suppression_id', v_row.id,
      'email', v_row.email,
      'suppression_type', v_row.suppression_type,
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'manual_suppression_lift')
    )
  );

  RETURN jsonb_build_object('updated_count', 1, 'id', v_row.id, 'email', v_row.email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_lift_tenant_suppression(UUID, UUID, TEXT) TO authenticated;

-- Force PostgREST to pick up the repaired RPC.
NOTIFY pgrst, 'reload schema';
