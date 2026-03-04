BEGIN;

-- Repair migration: PostgREST cannot choose between two candidates when multiple
-- overloads share the same arg names/types. Keep the canonical signature:
--   (p_tenant_id uuid, p_overrides jsonb, p_reason text)
-- and reintroduce any back-compat overload with DIFFERENT arg names so named
-- RPC calls only match the canonical function.

DROP FUNCTION IF EXISTS public.admin_set_tenant_email_governance_overrides(JSONB, TEXT, UUID);

-- Back-compat overload (positional callers): jsonb, text, uuid
-- Arg names are intentionally different to avoid collision with PostgREST named args.
CREATE OR REPLACE FUNCTION public.admin_set_tenant_email_governance_overrides(
  p_overrides_in JSONB,
  p_reason_in TEXT,
  p_tenant_id_in UUID
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.admin_set_tenant_email_governance_overrides(
    p_tenant_id_in,
    p_overrides_in,
    p_reason_in
  );
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_tenant_email_governance_overrides(JSONB, TEXT, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
