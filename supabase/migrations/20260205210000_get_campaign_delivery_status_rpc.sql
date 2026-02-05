-- Expose a safe, RLS-resilient way for the UI to fetch delivery/status fields.
-- The UI needs this to render "Last Schedule Run" even when crm_campaigns SELECT policies drift
-- (e.g., legacy rows missing tenant_id/user_id).

CREATE OR REPLACE FUNCTION public.get_campaign_delivery_status(p_campaign_id UUID)
RETURNS TABLE (
  id UUID,
  status TEXT,
  scheduled_at TIMESTAMPTZ,
  send_started_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  send_error TEXT,
  send_blocked_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;
  v_campaign_user_id UUID;
  v_campaign_tenant_id UUID;
  v_effective_tenant_id UUID;
BEGIN
  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT u.tenant_id
  INTO v_actor_tenant_id
  FROM public.users u
  WHERE u.id = v_actor_user_id;

  SELECT c.user_id, c.tenant_id
  INTO v_campaign_user_id, v_campaign_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL AND v_campaign_tenant_id IS NULL THEN
    RETURN;
  END IF;

  v_effective_tenant_id := v_campaign_tenant_id;

  -- If tenant_id is missing, derive it from other relationships.
  IF v_effective_tenant_id IS NULL AND v_campaign_user_id IS NOT NULL THEN
    SELECT u.tenant_id
    INTO v_effective_tenant_id
    FROM public.users u
    WHERE u.id = v_campaign_user_id;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    -- Try segment linkage
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.crm_campaigns c
    JOIN public.crm_segments s ON s.id = c.segment_id
    WHERE c.id = p_campaign_id
    LIMIT 1;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.campaign_segments cs
    JOIN public.crm_segments s ON s.id = cs.segment_id
    WHERE cs.campaign_id = p_campaign_id
    LIMIT 1;
  END IF;

  -- Authorization: owner or same-tenant.
  IF v_campaign_user_id = v_actor_user_id THEN
    -- ok
  ELSIF v_actor_tenant_id IS NOT NULL AND v_effective_tenant_id IS NOT NULL AND v_actor_tenant_id = v_effective_tenant_id THEN
    -- ok
  ELSE
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.status,
    c.scheduled_at,
    c.send_started_at,
    c.sent_at,
    c.updated_at,
    c.send_error,
    c.send_blocked_reason
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_delivery_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_delivery_status(UUID) TO service_role;

-- Reload PostgREST schema cache so RPC is immediately visible.
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END;
$$;
