-- Engagement score: read opens and clicks from email_tracking_events too.
--
-- 20261126120000 scored email from email_governance_email_events only. For
-- several tenants that stream holds sent/delivered events but no opens or
-- clicks (e.g. 056feed8 in the last 365 days: governance 12,865 delivered,
-- 0 opened; email_tracking_events 2,056 opened, 3,416 clicked), so every
-- customer there scored email 0. Opens and clicks now come from both
-- streams; per customer the larger count from either stream is used, so an
-- open recorded in both is not counted twice. Machine opens and clicks
-- (is_mpp_guess) stay excluded. Only the batch function changes; the
-- nightly job and the view are unchanged. Scores are recomputed after
-- applying with SELECT public.refresh_customer_engagement_scores().

CREATE OR REPLACE FUNCTION private.score_customer_engagement_batch(
  p_tenant_id uuid,
  p_after_id uuid,
  p_batch_size integer
)
RETURNS TABLE (processed integer, scored integer, last_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  WITH batch AS (
    SELECT c.id, c.last_purchase_date, c.pos_order_count
      FROM public.crm_customers AS c
     WHERE c.tenant_id = p_tenant_id
       AND c.deleted_at IS NULL
       AND c.merged_into_customer_id IS NULL
       AND (p_after_id IS NULL OR c.id > p_after_id)
     ORDER BY c.id
     LIMIT p_batch_size
  ),
  gov AS (
    SELECT e.customer_id,
           count(DISTINCT coalesce(e.governance_message_id, e.email_message_id))
             FILTER (WHERE e.event_type IN ('delivered', 'sent')) AS delivered,
           count(DISTINCT coalesce(e.governance_message_id, e.email_message_id))
             FILTER (WHERE e.event_type = 'opened' AND NOT coalesce(e.is_mpp_guess, false)) AS opens,
           count(DISTINCT coalesce(e.governance_message_id, e.email_message_id))
             FILTER (WHERE e.event_type IN ('clicked', 'click') AND NOT coalesce(e.is_mpp_guess, false)) AS clicks,
           max(coalesce(e.event_ts_provider, e.ingested_at, e.created_at))
             FILTER (WHERE e.event_type IN ('opened', 'clicked', 'click') AND NOT coalesce(e.is_mpp_guess, false)) AS last_engaged_at
      FROM public.email_governance_email_events AS e
      JOIN batch AS b ON b.id = e.customer_id
     WHERE e.tenant_id = p_tenant_id
       AND NOT coalesce(e.is_spam_trap, false)
       AND coalesce(e.event_ts_provider, e.ingested_at, e.created_at) >= now() - interval '365 days'
     GROUP BY e.customer_id
  ),
  -- Opens and clicks for several tenants are recorded only here (the
  -- governance stream carries their sent/delivered events alone).
  ete AS (
    SELECT e.customer_id,
           count(DISTINCT coalesce(e.provider_message_id, e.campaign_id::text, e.created_at::text))
             FILTER (WHERE e.event_type IN ('delivered', 'sent')) AS delivered,
           count(DISTINCT coalesce(e.provider_message_id, e.campaign_id::text, e.created_at::text))
             FILTER (WHERE e.event_type IN ('opened', 'open') AND NOT coalesce(e.is_mpp_guess, false)) AS opens,
           count(DISTINCT coalesce(e.provider_message_id, e.campaign_id::text, e.created_at::text))
             FILTER (WHERE e.event_type IN ('clicked', 'click') AND NOT coalesce(e.is_mpp_guess, false)) AS clicks,
           max(coalesce(e.event_ts_provider, e.created_at))
             FILTER (WHERE e.event_type IN ('opened', 'open', 'clicked', 'click') AND NOT coalesce(e.is_mpp_guess, false)) AS last_engaged_at
      FROM public.email_tracking_events AS e
      JOIN batch AS b ON b.id = e.customer_id
     WHERE e.tenant_id = p_tenant_id
       AND coalesce(e.event_ts_provider, e.created_at) >= now() - interval '365 days'
     GROUP BY e.customer_id
  ),
  -- The same open can be recorded in both streams, so take the larger count
  -- per customer rather than the sum.
  email AS (
    SELECT coalesce(g.customer_id, t.customer_id) AS customer_id,
           greatest(coalesce(g.delivered, 0), coalesce(t.delivered, 0)) AS delivered,
           greatest(coalesce(g.opens, 0), coalesce(t.opens, 0)) AS opens,
           greatest(coalesce(g.clicks, 0), coalesce(t.clicks, 0)) AS clicks,
           greatest(g.last_engaged_at, t.last_engaged_at) AS last_engaged_at
      FROM gov AS g
      FULL JOIN ete AS t ON t.customer_id = g.customer_id
  ),
  components AS (
    SELECT b.id AS customer_id,
           em.delivered, em.opens, em.clicks, em.last_engaged_at,
           b.last_purchase_date, b.pos_order_count,
           CASE
             WHEN greatest(coalesce(em.delivered, 0), coalesce(em.opens, 0), coalesce(em.clicks, 0)) > 0 THEN
               round(100 * (
                 0.5 * least(1, (em.opens::numeric / greatest(em.delivered, em.opens, em.clicks)) / 0.5)
                 + 0.5 * least(1, (em.clicks::numeric / greatest(em.delivered, em.opens, em.clicks)) / 0.1)
               ), 1)
           END AS email_score,
           CASE
             WHEN b.last_purchase_date IS NOT NULL THEN
               round(100 * greatest(0, 1 - least(greatest(current_date - b.last_purchase_date, 0), 365)::numeric / 365), 1)
           END AS recency_score,
           CASE
             WHEN coalesce(b.pos_order_count, 0) > 0 THEN
               round(least(100, 100 * ln(1 + b.pos_order_count::numeric) / ln(13::numeric)), 1)
           END AS purchase_score
      FROM batch AS b
      LEFT JOIN email AS em ON em.customer_id = b.id
  ),
  upserted AS (
    INSERT INTO public.customer_engagement_scores AS s (
      customer_id, tenant_id, overall_score, email_score, recency_score,
      purchase_score, signals, computed_at
    )
    SELECT c.customer_id,
           p_tenant_id,
           round(
             (coalesce(c.email_score * 0.40, 0) + coalesce(c.recency_score * 0.35, 0) + coalesce(c.purchase_score * 0.25, 0))
             / nullif(
                 (CASE WHEN c.email_score IS NOT NULL THEN 0.40 ELSE 0 END)
                 + (CASE WHEN c.recency_score IS NOT NULL THEN 0.35 ELSE 0 END)
                 + (CASE WHEN c.purchase_score IS NOT NULL THEN 0.25 ELSE 0 END),
                 0),
             1),
           c.email_score,
           c.recency_score,
           c.purchase_score,
           jsonb_strip_nulls(jsonb_build_object(
             'email_delivered', c.delivered,
             'email_opens', c.opens,
             'email_clicks', c.clicks,
             'email_last_engaged_at', c.last_engaged_at,
             'last_purchase_date', c.last_purchase_date,
             'order_count', nullif(c.pos_order_count, 0)
           )),
           now()
      FROM components AS c
    ON CONFLICT (customer_id) DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      overall_score = EXCLUDED.overall_score,
      email_score = EXCLUDED.email_score,
      recency_score = EXCLUDED.recency_score,
      purchase_score = EXCLUDED.purchase_score,
      signals = EXCLUDED.signals,
      computed_at = EXCLUDED.computed_at
    RETURNING s.customer_id, s.overall_score
  )
  SELECT count(*)::integer,
         count(u.overall_score)::integer,
         CASE WHEN count(*) < p_batch_size THEN NULL ELSE (max(u.customer_id::text))::uuid END
    FROM upserted AS u;
END;
$function$;


REVOKE ALL ON FUNCTION private.score_customer_engagement_batch(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.score_customer_engagement_batch(uuid, uuid, integer) TO service_role;
