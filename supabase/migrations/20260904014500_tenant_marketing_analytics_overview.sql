-- Replace the legacy social-media analytics reads used by the BloomSuite
-- Analytics overview with one tenant-aware, permission-checked reporting RPC.
--
-- The effective tenant is resolved by get_current_crm_access(), which includes
-- the persisted admin_session_context selection for master admins. This keeps
-- reporting aligned with the same tenant boundary as the rest of the CRM.

CREATE OR REPLACE FUNCTION public.get_marketing_analytics_overview(
  p_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_access jsonb;
  v_tenant_id uuid;
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_period_end timestamptz := now();
  v_period_start timestamptz;
  v_previous_start timestamptz;
  v_total_views bigint := 0;
  v_previous_views bigint := 0;
  v_clicks bigint := 0;
  v_conversions bigint := 0;
  v_engagements bigint := 0;
  v_engagement_rate numeric := 0;
  v_growth integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  v_access := public.get_current_crm_access();
  v_tenant_id := nullif(v_access->>'tenantId', '')::uuid;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant access required' USING ERRCODE = '42501';
  END IF;

  IF NOT coalesce(v_access->'permissions' ? 'reports.read', false) THEN
    RAISE EXCEPTION 'Reporting access required' USING ERRCODE = '42501';
  END IF;

  v_period_start := v_period_end - make_interval(days => v_days);
  v_previous_start := v_period_start - make_interval(days => v_days);

  SELECT count(*)
  INTO v_total_views
  FROM public.hub_views AS view_event
  JOIN public.campaigns AS campaign
    ON campaign.id = view_event.campaign_id
  WHERE campaign.tenant_id = v_tenant_id
    AND view_event.viewed_at >= v_period_start
    AND view_event.viewed_at < v_period_end;

  SELECT count(*)
  INTO v_previous_views
  FROM public.hub_views AS view_event
  JOIN public.campaigns AS campaign
    ON campaign.id = view_event.campaign_id
  WHERE campaign.tenant_id = v_tenant_id
    AND view_event.viewed_at >= v_previous_start
    AND view_event.viewed_at < v_period_start;

  SELECT
    count(*) FILTER (WHERE event_type = 'link_click'),
    count(*) FILTER (
      WHERE event_type IN ('coupon_redeem', 'share_click', 'purchase')
    ),
    count(*) FILTER (
      WHERE event_type IN ('link_click', 'coupon_redeem', 'share_click', 'purchase')
    )
  INTO v_clicks, v_conversions, v_engagements
  FROM public.analytics_events
  WHERE tenant_id = v_tenant_id
    AND created_at >= v_period_start
    AND created_at < v_period_end;

  IF v_total_views > 0 THEN
    v_engagement_rate := round((v_engagements::numeric / v_total_views::numeric) * 100, 2);
  END IF;

  IF v_previous_views > 0 THEN
    v_growth := round(
      ((v_total_views - v_previous_views)::numeric / v_previous_views::numeric) * 100
    )::integer;
  END IF;

  RETURN jsonb_build_object(
    'totalViews', v_total_views,
    'engagementRate', v_engagement_rate,
    'clicks', v_clicks,
    'conversions', v_conversions,
    'growth', v_growth
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_marketing_analytics_overview(integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_marketing_analytics_overview(integer)
  TO authenticated, service_role;
