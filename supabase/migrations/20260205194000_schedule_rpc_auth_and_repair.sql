-- Improve schedule RPC authorization and repair legacy NULL tenant/user linkage.
-- Goal: eliminate false 'Not allowed' failures caused by missing tenant_id/user_id on crm_campaigns.

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
  v_user_tenant_id uuid;
  v_campaign record;
  v_effective_tenant_id uuid;
  v_allowed boolean := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Not authenticated';
    RETURN;
  END IF;

  SELECT u.tenant_id
  INTO v_user_tenant_id
  FROM public.users u
  WHERE u.id = v_user_id;

  SELECT c.id, c.user_id, c.tenant_id, c.status, c.source_content_task_id, c.segment_id
  INTO v_campaign
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign.id IS NULL THEN
    RETURN QUERY SELECT false, 'Campaign not found';
    RETURN;
  END IF;

  -- Derive an effective tenant_id if the campaign row is missing it.
  v_effective_tenant_id := v_campaign.tenant_id;

  IF v_effective_tenant_id IS NULL AND v_campaign.source_content_task_id IS NOT NULL THEN
    SELECT t.tenant_id
    INTO v_effective_tenant_id
    FROM public.content_tasks t
    WHERE t.id = v_campaign.source_content_task_id;
  END IF;

  IF v_effective_tenant_id IS NULL AND v_campaign.segment_id IS NOT NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.crm_segments s
    WHERE s.id = v_campaign.segment_id;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.campaign_segments cs
    JOIN public.crm_segments s ON s.id = cs.segment_id
    WHERE cs.campaign_id = v_campaign.id
    LIMIT 1;
  END IF;

  IF v_effective_tenant_id IS NULL AND v_campaign.user_id IS NOT NULL THEN
    SELECT u.tenant_id
    INTO v_effective_tenant_id
    FROM public.users u
    WHERE u.id = v_campaign.user_id;
  END IF;

  -- Authorization: owner OR same-tenant.
  IF v_campaign.user_id = v_user_id THEN
    v_allowed := true;
  ELSIF v_effective_tenant_id IS NOT NULL AND v_user_tenant_id = v_effective_tenant_id THEN
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
    tenant_id = COALESCE(tenant_id, v_effective_tenant_id, v_user_tenant_id),
    user_id = CASE WHEN user_id IS NULL THEN v_user_id ELSE user_id END,
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
  v_user_tenant_id uuid;
  v_campaign record;
  v_effective_tenant_id uuid;
  v_allowed boolean := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Not authenticated';
    RETURN;
  END IF;

  SELECT u.tenant_id
  INTO v_user_tenant_id
  FROM public.users u
  WHERE u.id = v_user_id;

  SELECT c.id, c.user_id, c.tenant_id, c.status, c.source_content_task_id, c.segment_id
  INTO v_campaign
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign.id IS NULL THEN
    RETURN QUERY SELECT false, 'Campaign not found';
    RETURN;
  END IF;

  v_effective_tenant_id := v_campaign.tenant_id;

  IF v_effective_tenant_id IS NULL AND v_campaign.source_content_task_id IS NOT NULL THEN
    SELECT t.tenant_id
    INTO v_effective_tenant_id
    FROM public.content_tasks t
    WHERE t.id = v_campaign.source_content_task_id;
  END IF;

  IF v_effective_tenant_id IS NULL AND v_campaign.segment_id IS NOT NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.crm_segments s
    WHERE s.id = v_campaign.segment_id;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.campaign_segments cs
    JOIN public.crm_segments s ON s.id = cs.segment_id
    WHERE cs.campaign_id = v_campaign.id
    LIMIT 1;
  END IF;

  IF v_effective_tenant_id IS NULL AND v_campaign.user_id IS NOT NULL THEN
    SELECT u.tenant_id
    INTO v_effective_tenant_id
    FROM public.users u
    WHERE u.id = v_campaign.user_id;
  END IF;

  IF v_campaign.user_id = v_user_id THEN
    v_allowed := true;
  ELSIF v_effective_tenant_id IS NOT NULL AND v_user_tenant_id = v_effective_tenant_id THEN
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
    tenant_id = COALESCE(tenant_id, v_effective_tenant_id, v_user_tenant_id),
    user_id = CASE WHEN user_id IS NULL THEN v_user_id ELSE user_id END,
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
