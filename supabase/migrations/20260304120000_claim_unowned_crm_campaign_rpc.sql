-- Allow a signed-in user to claim ownership of an unowned CRM campaign.
--
-- Motivation:
-- Some legacy or system-created crm_campaigns rows may have user_id = NULL,
-- which causes owner-scoped UPDATEs in the app to return 0 rows ("[]").
--
-- Security model:
-- - Owner-only editing remains enforced by the application query filter.
-- - This RPC only assigns ownership when user_id IS NULL.
-- - It also ensures the campaign belongs to the caller's tenant (or is unassigned).

CREATE OR REPLACE FUNCTION public.claim_unowned_crm_campaign(
  p_campaign_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_updated_count INTEGER := 0;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT u.tenant_id
  INTO v_tenant_id
  FROM public.users u
  WHERE u.id = v_user_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.crm_campaigns c
  SET
    user_id = v_user_id,
    tenant_id = COALESCE(c.tenant_id, v_tenant_id),
    updated_at = NOW()
  WHERE c.id = p_campaign_id
    AND c.user_id IS NULL
    AND (c.tenant_id IS NULL OR c.tenant_id = v_tenant_id)
    AND c.sent_at IS NULL
    AND c.status IN ('draft', 'scheduled');

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_unowned_crm_campaign(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_unowned_crm_campaign(UUID) TO service_role;

-- Reload PostgREST schema cache so RPC is immediately visible.
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END;
$$;
