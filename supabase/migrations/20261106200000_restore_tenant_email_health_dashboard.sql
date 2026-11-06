-- Restore public.get_tenant_email_health_dashboard.
--
-- The CRM calls this RPC from the email-sending settings card, the domain
-- health banner, the governance health card and the campaign send
-- confirmation. Production has no such function (PostgREST 404), and the
-- email_governance_tenant_reputation_snapshots table its original body read
-- (20260225190000) is also absent, so every caller has silently shown no
-- email health data.
--
-- This forward migration recreates the function with the same signature,
-- return columns, tenant check and rate units (fractions, 0.012 = 1.2%),
-- reading tables that exist in production:
--   * sent / delivered / bounced / complained: email_governance_email_events
--     (event_ts_provider, falling back to ingested_at), via the
--     (tenant_id, event_type, event_ts_provider) index
--   * unsubscribed: suppression_list email unsubscribes suppressed in the window
--   * score, tier, action: get_tenant_reputation_policy and the score tables

CREATE OR REPLACE FUNCTION public.get_tenant_email_health_dashboard(
  p_tenant_id UUID,
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  tenant_id UUID,
  as_of TIMESTAMPTZ,
  reputation_score INTEGER,
  reputation_tier TEXT,
  reputation_action TEXT,
  trend_direction TEXT,
  trend_delta INTEGER,
  baseline_score_7d INTEGER,
  sent_24h INTEGER,
  delivered_24h INTEGER,
  bounced_24h INTEGER,
  complained_24h INTEGER,
  unsubscribed_24h INTEGER,
  bounce_rate_24h NUMERIC,
  complaint_rate_24h NUMERIC,
  sent_30d INTEGER,
  delivered_30d INTEGER,
  bounced_30d INTEGER,
  complained_30d INTEGER,
  unsubscribed_30d INTEGER,
  bounce_rate_30d NUMERIC,
  complaint_rate_30d NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_tenant_id UUID;
  v_as_of TIMESTAMPTZ := COALESCE(p_as_of, now());
  v_policy RECORD;
  v_current_score INTEGER;
  v_baseline INTEGER;
  v_delta INTEGER;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  -- Same access rule as the original: only the caller's own tenant.
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  SELECT u.tenant_id INTO v_actor_tenant_id FROM public.users u WHERE u.id = auth.uid();
  IF v_actor_tenant_id IS NULL OR v_actor_tenant_id <> p_tenant_id THEN
    RETURN;
  END IF;

  SELECT * INTO v_policy FROM public.get_tenant_reputation_policy(p_tenant_id);

  SELECT r.score INTO v_current_score
  FROM public.email_governance_tenant_reputation_scores r
  WHERE r.tenant_id = p_tenant_id
  LIMIT 1;

  SELECT h.score INTO v_baseline
  FROM public.email_governance_tenant_reputation_score_history h
  WHERE h.tenant_id = p_tenant_id
    AND h.as_of <= v_as_of - INTERVAL '7 days'
  ORDER BY h.as_of DESC
  LIMIT 1;

  v_current_score := COALESCE(v_current_score, v_policy.score, 100);
  v_baseline := COALESCE(v_baseline, v_current_score);
  v_delta := v_current_score - v_baseline;

  tenant_id := p_tenant_id;
  as_of := v_as_of;
  reputation_score := v_current_score;
  reputation_tier := COALESCE(v_policy.tier, 'normal');
  reputation_action := COALESCE(v_policy.action, 'allow');
  trend_direction := CASE WHEN v_delta > 1 THEN 'up' WHEN v_delta < -1 THEN 'down' ELSE 'flat' END;
  trend_delta := v_delta;
  baseline_score_7d := v_baseline;

  SELECT
    COUNT(*) FILTER (WHERE e.event_type = 'sent' AND e.ts > v_as_of - INTERVAL '24 hours')::int,
    COUNT(*) FILTER (WHERE e.event_type = 'delivered' AND e.ts > v_as_of - INTERVAL '24 hours')::int,
    COUNT(*) FILTER (WHERE e.event_type = 'bounced' AND e.ts > v_as_of - INTERVAL '24 hours')::int,
    COUNT(*) FILTER (WHERE e.event_type = 'complained' AND e.ts > v_as_of - INTERVAL '24 hours')::int,
    COUNT(*) FILTER (WHERE e.event_type = 'sent')::int,
    COUNT(*) FILTER (WHERE e.event_type = 'delivered')::int,
    COUNT(*) FILTER (WHERE e.event_type = 'bounced')::int,
    COUNT(*) FILTER (WHERE e.event_type = 'complained')::int
  INTO sent_24h, delivered_24h, bounced_24h, complained_24h,
       sent_30d, delivered_30d, bounced_30d, complained_30d
  FROM (
    SELECT ev.event_type, COALESCE(ev.event_ts_provider, ev.ingested_at, ev.created_at) AS ts
    FROM public.email_governance_email_events ev
    WHERE ev.tenant_id = p_tenant_id
      AND ev.event_type IN ('sent', 'delivered', 'bounced', 'complained')
      AND COALESCE(ev.event_ts_provider, ev.ingested_at, ev.created_at) > v_as_of - INTERVAL '30 days'
      AND COALESCE(ev.event_ts_provider, ev.ingested_at, ev.created_at) <= v_as_of
  ) e;

  SELECT
    COUNT(*) FILTER (WHERE s.suppressed_at > v_as_of - INTERVAL '24 hours')::int,
    COUNT(*)::int
  INTO unsubscribed_24h, unsubscribed_30d
  FROM public.suppression_list s
  WHERE s.tenant_id = p_tenant_id
    AND s.channel = 'email'
    AND (s.suppression_type ILIKE 'unsub%' OR s.reason ILIKE '%unsubscri%')
    AND s.suppressed_at > v_as_of - INTERVAL '30 days'
    AND s.suppressed_at <= v_as_of;

  bounce_rate_24h := CASE WHEN sent_24h > 0 THEN round(bounced_24h::numeric / sent_24h, 4) ELSE 0 END;
  complaint_rate_24h := CASE WHEN sent_24h > 0 THEN round(complained_24h::numeric / sent_24h, 4) ELSE 0 END;
  bounce_rate_30d := CASE WHEN sent_30d > 0 THEN round(bounced_30d::numeric / sent_30d, 4) ELSE 0 END;
  complaint_rate_30d := CASE WHEN sent_30d > 0 THEN round(complained_30d::numeric / sent_30d, 4) ELSE 0 END;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_email_health_dashboard(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_email_health_dashboard(UUID, TIMESTAMPTZ) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
