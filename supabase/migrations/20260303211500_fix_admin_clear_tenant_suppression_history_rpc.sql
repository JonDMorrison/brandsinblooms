-- Ensure admin_clear_tenant_suppression_history RPC exists and is visible to PostgREST.
-- Forward-only repair migration (do not edit previously applied migrations).

BEGIN;

-- Drop stale variants to avoid schema cache confusion.
DROP FUNCTION IF EXISTS public.admin_clear_tenant_suppression_history(UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_clear_tenant_suppression_history(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.admin_clear_tenant_suppression_history(
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
  v_deleted_current INTEGER := 0;
  v_deleted_history INTEGER := 0;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  WITH deleted_current AS (
    DELETE FROM public.suppression_list
    WHERE tenant_id = p_tenant_id
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO v_deleted_current FROM deleted_current;

  WITH deleted_history AS (
    DELETE FROM public.email_governance_suppression_events
    WHERE tenant_id = p_tenant_id
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO v_deleted_history FROM deleted_history;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_suppression_history_cleared',
    jsonb_build_object(
      'deleted_suppression_list_rows', COALESCE(v_deleted_current, 0),
      'deleted_suppression_event_rows', COALESCE(v_deleted_history, 0),
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'manual_suppression_history_clear')
    )
  );

  RETURN jsonb_build_object(
    'deleted_suppression_list_rows', COALESCE(v_deleted_current, 0),
    'deleted_suppression_event_rows', COALESCE(v_deleted_history, 0)
  );
END;
$$;

-- Compatibility wrapper: some clients may call with swapped param order.
CREATE OR REPLACE FUNCTION public.admin_clear_tenant_suppression_history(
  p_reason TEXT,
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.admin_clear_tenant_suppression_history(p_tenant_id, p_reason);
$$;

GRANT EXECUTE ON FUNCTION public.admin_clear_tenant_suppression_history(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_tenant_suppression_history(TEXT, UUID) TO authenticated;

-- Force PostgREST to pick up refreshed definitions.
NOTIFY pgrst, 'reload schema';

COMMIT;
