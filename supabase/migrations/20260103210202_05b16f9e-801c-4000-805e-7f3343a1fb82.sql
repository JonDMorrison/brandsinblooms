-- =============================================
-- Email Analytics Hardening - Add columns and functions
-- =============================================

-- 1. Add new columns to email_tracking_events
ALTER TABLE public.email_tracking_events 
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS event_ts_provider timestamptz,
  ADD COLUMN IF NOT EXISTS ingested_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS link_id uuid,
  ADD COLUMN IF NOT EXISTS is_mpp_guess boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS webhook_delivery_id text,
  ADD COLUMN IF NOT EXISTS ip_hash text;

-- 2. Add rollup_refreshed_at to crm_campaigns
ALTER TABLE public.crm_campaigns 
  ADD COLUMN IF NOT EXISTS rollup_refreshed_at timestamptz;

-- 3. Update event_type CHECK constraint to include all variants
ALTER TABLE public.email_tracking_events 
  DROP CONSTRAINT IF EXISTS email_tracking_events_event_type_check;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_events_tenant_campaign 
ON public.email_tracking_events (tenant_id, campaign_id);

CREATE INDEX IF NOT EXISTS idx_email_events_link_id 
ON public.email_tracking_events (link_id) WHERE link_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_events_mpp 
ON public.email_tracking_events (campaign_id, is_mpp_guess);

-- 5. Create unique index for idempotency
DROP INDEX IF EXISTS idx_email_tracking_events_provider_idempotency;
CREATE UNIQUE INDEX idx_email_tracking_events_provider_idempotency 
ON public.email_tracking_events (tenant_id, provider_message_id, event_type, event_ts_provider)
WHERE provider_message_id IS NOT NULL AND event_ts_provider IS NOT NULL;

-- 6. Create tracked_links table if not exists
CREATE TABLE IF NOT EXISTS public.tracked_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracked_links_tenant_campaign ON public.tracked_links(tenant_id, campaign_id);

-- Enable RLS on tracked_links
ALTER TABLE public.tracked_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage tracked links for their tenant" ON public.tracked_links;
CREATE POLICY "Users can manage tracked links for their tenant" ON public.tracked_links
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.crm_campaigns cc
    JOIN public.users u ON u.tenant_id = cc.tenant_id
    WHERE cc.id = tracked_links.campaign_id 
    AND u.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Service role access tracked_links" ON public.tracked_links;
CREATE POLICY "Service role access tracked_links" ON public.tracked_links
FOR ALL USING (auth.role() = 'service_role');

-- 7. Function to get derived metrics for a campaign
CREATE OR REPLACE FUNCTION public.get_campaign_derived_metrics(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH event_counts AS (
    SELECT
      count(DISTINCT customer_email) FILTER (WHERE event_type IN ('sent')) AS sent,
      count(DISTINCT customer_email) FILTER (WHERE event_type IN ('delivered')) AS delivered,
      count(DISTINCT customer_email) FILTER (WHERE event_type IN ('open', 'opened')) AS opens,
      count(DISTINCT customer_email) FILTER (WHERE event_type IN ('click', 'clicked')) AS clicks,
      count(DISTINCT customer_email) FILTER (WHERE event_type IN ('bounce', 'bounced')) AS bounces,
      count(DISTINCT customer_email) FILTER (WHERE event_type IN ('complaint', 'complained')) AS complaints,
      count(DISTINCT customer_email) FILTER (WHERE event_type IN ('unsubscribed')) AS unsubscribes,
      count(DISTINCT customer_email) FILTER (WHERE event_type IN ('open', 'opened') AND NOT is_mpp_guess) AS opens_non_mpp
    FROM public.email_tracking_events
    WHERE campaign_id = p_campaign_id
  ),
  link_stats AS (
    SELECT 
      COALESCE(
        jsonb_agg(
          jsonb_build_object('link_id', link_id, 'url', url, 'clicks', click_count)
          ORDER BY click_count DESC
        ),
        '[]'::jsonb
      ) AS top_links
    FROM (
      SELECT 
        COALESCE(e.link_id::text, e.event_data->>'click_link', 'unknown') as link_id,
        COALESCE(tl.url, e.event_data->>'click_link', 'Unknown') as url,
        count(DISTINCT e.customer_email) as click_count
      FROM public.email_tracking_events e
      LEFT JOIN public.tracked_links tl ON tl.id = e.link_id
      WHERE e.campaign_id = p_campaign_id AND e.event_type IN ('click', 'clicked')
      GROUP BY 1, 2
      ORDER BY click_count DESC
      LIMIT 5
    ) top
  )
  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
      'sent', COALESCE(ec.sent, 0),
      'delivered', COALESCE(ec.delivered, 0),
      'opens', COALESCE(ec.opens, 0),
      'clicks', COALESCE(ec.clicks, 0),
      'bounces', COALESCE(ec.bounces, 0),
      'complaints', COALESCE(ec.complaints, 0),
      'unsubscribes', COALESCE(ec.unsubscribes, 0),
      'opens_non_mpp', COALESCE(ec.opens_non_mpp, 0)
    ),
    'rates', jsonb_build_object(
      'open_reported', CASE WHEN GREATEST(COALESCE(ec.delivered, 0), COALESCE(ec.sent, 0)) > 0 
        THEN round((COALESCE(ec.opens, 0)::numeric / GREATEST(COALESCE(ec.delivered, 0), COALESCE(ec.sent, 0))) * 100, 2) 
        ELSE 0 END,
      'open_adjusted', CASE WHEN GREATEST(COALESCE(ec.delivered, 0), COALESCE(ec.sent, 0)) > 0 
        THEN round((COALESCE(ec.opens_non_mpp, 0)::numeric / GREATEST(COALESCE(ec.delivered, 0), COALESCE(ec.sent, 0))) * 100, 2) 
        ELSE 0 END,
      'click', CASE WHEN GREATEST(COALESCE(ec.delivered, 0), COALESCE(ec.sent, 0)) > 0 
        THEN round((COALESCE(ec.clicks, 0)::numeric / GREATEST(COALESCE(ec.delivered, 0), COALESCE(ec.sent, 0))) * 100, 2) 
        ELSE 0 END,
      'bounce', CASE WHEN COALESCE(ec.sent, 0) > 0 
        THEN round((COALESCE(ec.bounces, 0)::numeric / ec.sent) * 100, 2) 
        ELSE 0 END,
      'complaint', CASE WHEN COALESCE(ec.sent, 0) > 0 
        THEN round((COALESCE(ec.complaints, 0)::numeric / ec.sent) * 100, 2) 
        ELSE 0 END
    ),
    'links', ls.top_links,
    'computed_at', now()
  ) INTO result
  FROM event_counts ec
  CROSS JOIN link_stats ls;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- 8. Function to recompute and update campaign metrics
CREATE OR REPLACE FUNCTION public.recompute_campaign_metrics(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  derived_metrics jsonb;
BEGIN
  derived_metrics := public.get_campaign_derived_metrics(p_campaign_id);
  
  UPDATE public.crm_campaigns
  SET 
    metrics = derived_metrics,
    total_sent = COALESCE((derived_metrics->'totals'->>'sent')::int, 0),
    total_opens = COALESCE((derived_metrics->'totals'->>'opens')::int, 0),
    total_clicks = COALESCE((derived_metrics->'totals'->>'clicks')::int, 0),
    open_rate = COALESCE((derived_metrics->'rates'->>'open_reported')::numeric, 0),
    click_rate = COALESCE((derived_metrics->'rates'->>'click')::numeric, 0),
    rollup_refreshed_at = now()
  WHERE id = p_campaign_id;
  
  RETURN derived_metrics;
END;
$$;

-- 9. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_campaign_derived_metrics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_campaign_metrics(uuid) TO authenticated;