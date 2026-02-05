-- Server-side scheduling RPCs (SECURITY DEFINER)
-- Purpose: make schedule updates reliable even when client-side RLS/tenant linkage drifts.

CREATE OR REPLACE FUNCTION public.set_campaign_schedule(
  p_campaign_id uuid,
  p_scheduled_at timestamptz,
  p_timezone text DEFAULT NULL
)
RETURNS TABLE(success boolean, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_campaign record;
  v_allowed boolean := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Not authenticated';
    RETURN;
  END IF;

  SELECT c.id, c.user_id, c.tenant_id, c.status
  INTO v_campaign
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign.id IS NULL THEN
    RETURN QUERY SELECT false, 'Campaign not found';
    RETURN;
  END IF;

  -- Authorization: owner OR same-tenant user
  IF v_campaign.user_id = v_user_id THEN
    v_allowed := true;
  ELSIF v_campaign.tenant_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = v_user_id
      AND u.tenant_id = v_campaign.tenant_id
  ) THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RETURN QUERY SELECT false, 'Not allowed';
    RETURN;
  END IF;

  IF lower(coalesce(v_campaign.status, '')) IN ('sending', 'sent') THEN
    RETURN QUERY SELECT false, 'Campaign is locked';
    RETURN;
  END IF;

  UPDATE public.crm_campaigns
  SET
    scheduled_at = p_scheduled_at,
    status = 'scheduled',
    send_started_at = NULL,
    send_error = NULL,
    send_blocked_reason = NULL,
    updated_at = now(),
    metadata = CASE
      WHEN p_timezone IS NULL THEN metadata
      ELSE coalesce(metadata, '{}'::jsonb) || jsonb_build_object('scheduled_timezone', p_timezone)
    END
  WHERE id = p_campaign_id;

  RETURN QUERY SELECT true, NULL::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_campaign_schedule(
  p_campaign_id uuid
)
RETURNS TABLE(success boolean, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_campaign record;
  v_allowed boolean := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Not authenticated';
    RETURN;
  END IF;

  SELECT c.id, c.user_id, c.tenant_id, c.status
  INTO v_campaign
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign.id IS NULL THEN
    RETURN QUERY SELECT false, 'Campaign not found';
    RETURN;
  END IF;

  -- Authorization: owner OR same-tenant user
  IF v_campaign.user_id = v_user_id THEN
    v_allowed := true;
  ELSIF v_campaign.tenant_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = v_user_id
      AND u.tenant_id = v_campaign.tenant_id
  ) THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RETURN QUERY SELECT false, 'Not allowed';
    RETURN;
  END IF;

  IF lower(coalesce(v_campaign.status, '')) IN ('sending', 'sent') THEN
    RETURN QUERY SELECT false, 'Campaign is locked';
    RETURN;
  END IF;

  UPDATE public.crm_campaigns
  SET
    scheduled_at = NULL,
    status = 'draft',
    send_started_at = NULL,
    send_error = NULL,
    send_blocked_reason = NULL,
    updated_at = now()
  WHERE id = p_campaign_id;

  RETURN QUERY SELECT true, NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_campaign_schedule(uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_campaign_schedule(uuid, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_campaign_schedule(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_campaign_schedule(uuid) TO service_role;

-- Reload PostgREST schema cache
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END;
$$;
