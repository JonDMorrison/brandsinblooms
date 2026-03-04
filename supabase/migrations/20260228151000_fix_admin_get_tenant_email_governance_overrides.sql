-- Repair migration: restore missing admin RPC used by tenant email management panel.

CREATE OR REPLACE FUNCTION public.admin_get_tenant_email_governance_overrides(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF auth.uid() IS NULL OR NOT public.is_master_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  RETURN public.get_tenant_email_governance_overrides(p_tenant_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_tenant_email_governance_overrides(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_tenant_email_governance_overrides(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
