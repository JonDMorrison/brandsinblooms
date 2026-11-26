-- Customer engagement score: compute it, keep "unknown" distinct from 0.
--
-- customer_360_enriched.engagement_overall_score was 0 for every customer:
-- the view read customer_engagement_summary.overall_engagement_score through
-- COALESCE(..., 0), and nothing ever wrote that column
-- (recalculate_customer_engagement has no caller, no cron job and no
-- trigger). Writing scores into customer_engagement_summary would also block
-- customer merges: merge_crm_customers refuses a duplicate with a non-zero
-- score or a non-'cold' tier (20260903110000).
--
-- This migration is additive:
-- 1. public.customer_engagement_scores: one row per customer with the overall
--    score (0-100), its components and computed_at. A customer with no signal
--    has NULL scores ("unknown"), never 0.
-- 2. private.score_customer_engagement_batch: set-based scoring for one
--    tenant, one batch of customers (id-ordered, keyset paged).
-- 3. public.refresh_customer_engagement_scores(tenant, batch): runs every
--    batch for one tenant or all tenants and logs each run to
--    public.customer_engagement_score_runs.
-- 4. pg_cron job customer-engagement-scores, nightly.
-- 5. customer_360_enriched reads the new scores without COALESCE to 0.
--
-- Inputs (last 365 days for email):
--   email   email_governance_email_events per customer: messages delivered
--           (or sent when no delivery event), opened and clicked. Machine
--           opens and clicks (is_mpp_guess) and spam traps are excluded.
--           Clicks are accepted as 'clicked' or 'click'.
--   recency crm_customers.last_purchase_date: 100 today, 0 at 365+ days.
--   purchase crm_customers.pos_order_count: log scale, 12+ orders = 100.
-- Overall = weighted mean of the components present (email 0.40,
-- recency 0.35, purchase 0.25), renormalised over those present.
--
-- Computing scores reads events and customers and writes only
-- customer_engagement_scores and its run log. It sends nothing, updates no
-- crm_customers row and fires no customer or segment trigger.

CREATE TABLE IF NOT EXISTS public.customer_engagement_scores (
  customer_id uuid PRIMARY KEY REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  overall_score numeric CHECK (overall_score IS NULL OR overall_score BETWEEN 0 AND 100),
  email_score numeric CHECK (email_score IS NULL OR email_score BETWEEN 0 AND 100),
  recency_score numeric CHECK (recency_score IS NULL OR recency_score BETWEEN 0 AND 100),
  purchase_score numeric CHECK (purchase_score IS NULL OR purchase_score BETWEEN 0 AND 100),
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_engagement_scores_tenant_score_idx
  ON public.customer_engagement_scores (tenant_id, overall_score);

ALTER TABLE public.customer_engagement_scores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_engagement_scores FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.customer_engagement_scores TO authenticated;
GRANT ALL ON TABLE public.customer_engagement_scores TO service_role;

DROP POLICY IF EXISTS customer_engagement_scores_read ON public.customer_engagement_scores;
CREATE POLICY customer_engagement_scores_read
  ON public.customer_engagement_scores
  FOR SELECT TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'customer.read', NULL));

CREATE TABLE IF NOT EXISTS public.customer_engagement_score_runs (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  customers integer NOT NULL DEFAULT 0,
  scored integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed')),
  error text
);

ALTER TABLE public.customer_engagement_score_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_engagement_score_runs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.customer_engagement_score_runs TO service_role;
GRANT USAGE ON SEQUENCE public.customer_engagement_score_runs_id_seq TO service_role;

CREATE SCHEMA IF NOT EXISTS private;

-- Scores one batch of a tenant's customers after p_after_id (keyset paging).
-- Returns how many customers it processed, how many got a score, and the
-- last customer id (NULL when the tenant is done).
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
  email AS (
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

-- Scores every customer of one tenant (or of every tenant when NULL), in
-- batches, logging one run row per tenant. Returns customers processed.
CREATE OR REPLACE FUNCTION public.refresh_customer_engagement_scores(
  p_tenant_id uuid DEFAULT NULL,
  p_batch_size integer DEFAULT 2000
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_tenant uuid;
  v_run_id bigint;
  v_after uuid;
  v_processed integer;
  v_scored integer;
  v_total integer := 0;
  v_tenant_total integer;
  v_tenant_scored integer;
BEGIN
  FOR v_tenant IN
    SELECT DISTINCT c.tenant_id
      FROM public.crm_customers AS c
     WHERE c.tenant_id IS NOT NULL
       AND (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
  LOOP
    INSERT INTO public.customer_engagement_score_runs (tenant_id)
    VALUES (v_tenant)
    RETURNING id INTO v_run_id;

    v_after := NULL;
    v_tenant_total := 0;
    v_tenant_scored := 0;
    BEGIN
      LOOP
        SELECT b.processed, b.scored, b.last_id
          INTO v_processed, v_scored, v_after
          FROM private.score_customer_engagement_batch(v_tenant, v_after, p_batch_size) AS b;
        v_tenant_total := v_tenant_total + coalesce(v_processed, 0);
        v_tenant_scored := v_tenant_scored + coalesce(v_scored, 0);
        EXIT WHEN v_after IS NULL;
      END LOOP;

      UPDATE public.customer_engagement_score_runs
         SET finished_at = now(), customers = v_tenant_total,
             scored = v_tenant_scored, status = 'succeeded'
       WHERE id = v_run_id;
      RAISE LOG 'customer_engagement_scores tenant=% customers=% scored=%',
        v_tenant, v_tenant_total, v_tenant_scored;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.customer_engagement_score_runs
         SET finished_at = now(), customers = v_tenant_total,
             scored = v_tenant_scored, status = 'failed', error = SQLERRM
       WHERE id = v_run_id;
    END;

    v_total := v_total + v_tenant_total;
  END LOOP;

  RETURN v_total;
END;
$function$;

REVOKE ALL ON FUNCTION public.refresh_customer_engagement_scores(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_customer_engagement_scores(uuid, integer) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'customer-engagement-scores') THEN
    PERFORM cron.unschedule('customer-engagement-scores');
  END IF;
  -- 08:23 UTC = 3:23 AM US Eastern, outside business hours.
  PERFORM cron.schedule(
    'customer-engagement-scores',
    '23 8 * * *',
    'SELECT public.refresh_customer_engagement_scores();'
  );
END $$;

-- customer_360_enriched: engagement columns read the computed scores, and a
-- customer with no score is NULL ("unknown"), not 0. engagement_tier is
-- derived from the score with recalculate_customer_engagement's thresholds
-- (hot >= 70, warm >= 40, cold >= 10, else dormant) instead of the
-- never-computed 'cold' default, and engagement_sms_score is NULL: there is
-- no usable per-customer SMS signal (4 of 5,350 sms_messages carry a
-- customer). customer_engagement_summary is no longer joined. Every other
-- column is unchanged (body from pg_get_viewdef on production, 2026-11-26).
CREATE OR REPLACE VIEW public.customer_360_enriched
WITH (security_invoker = true) AS
 SELECT c.id,
    c.tenant_id,
    c.email,
    c.first_name,
    c.last_name,
    c.phone,
    c.created_at,
    c.updated_at,
    c.created_at AS first_seen_at,
    c.updated_at AS last_seen_at,
    im.signup_source,
    im.signup_campaign,
    im.preferred_channel,
    im.city,
    im.state_region,
    im.postal_code,
    im.country_code,
    im.timezone,
    im.store_id,
    im.store_name,
    COALESCE(em.total_sent, 0) AS email_total_sent,
    COALESCE(em.total_delivered, 0) AS email_total_delivered,
    COALESCE(em.total_opened, 0) AS email_total_opened,
    COALESCE(em.total_clicked, 0) AS email_total_clicked,
    COALESCE(em.total_bounced, 0) AS email_total_bounced,
    COALESCE(em.total_unsubscribes, 0) AS email_total_unsubscribes,
    COALESCE(em.open_rate, (0)::numeric) AS email_open_rate,
    COALESCE(em.click_rate, (0)::numeric) AS email_click_rate,
    COALESCE(em.bounce_rate, (0)::numeric) AS email_bounce_rate,
    em.last_sent_at AS email_last_sent_at,
    em.last_opened_at AS email_last_opened_at,
    em.last_clicked_at AS email_last_clicked_at,
    COALESCE(sm.total_sent, 0) AS sms_total_sent,
    COALESCE(sm.total_delivered, 0) AS sms_total_delivered,
    COALESCE(sm.total_clicked, 0) AS sms_total_clicked,
    COALESCE(sm.total_failed, 0) AS sms_total_failed,
    COALESCE(sm.total_replied, 0) AS sms_total_replied,
    COALESCE(sm.total_opt_outs, 0) AS sms_total_opt_outs,
    COALESCE(sm.delivery_rate, (0)::numeric) AS sms_delivery_rate,
    COALESCE(sm.click_rate, (0)::numeric) AS sms_click_rate,
    COALESCE(sm.reply_rate, (0)::numeric) AS sms_reply_rate,
    COALESCE(sm.opt_out_rate, (0)::numeric) AS sms_opt_out_rate,
    COALESCE(sm.avg_time_to_response_minutes, (0)::numeric) AS sms_avg_response_time_minutes,
    COALESCE(sm.engagement_score, (0)::numeric) AS sms_engagement_score,
    sm.last_sent_at AS sms_last_sent_at,
    sm.last_delivered_at AS sms_last_delivered_at,
    sm.last_clicked_at AS sms_last_clicked_at,
    sm.last_replied_at AS sms_last_replied_at,
    sm.last_opt_out_at AS sms_last_opt_out_at,
    ces.overall_score AS engagement_overall_score,
    ces.email_score AS engagement_email_score,
    NULL::numeric AS engagement_sms_score,
    ces.purchase_score AS engagement_purchase_score,
    CASE
      WHEN ces.overall_score IS NULL THEN NULL::text
      WHEN ces.overall_score >= 70 THEN 'hot'::text
      WHEN ces.overall_score >= 40 THEN 'warm'::text
      WHEN ces.overall_score >= 10 THEN 'cold'::text
      ELSE 'dormant'::text
    END AS engagement_tier,
    ces.computed_at AS engagement_last_calculated_at,
    ces.recency_score AS engagement_recency_score
   FROM ((((public.crm_customers c
     LEFT JOIN public.customer_identity_metrics im ON ((im.customer_id = c.id)))
     LEFT JOIN public.customer_email_metrics em ON ((em.customer_id = c.id)))
     LEFT JOIN public.customer_sms_metrics sm ON ((sm.customer_id = c.id)))
     LEFT JOIN public.customer_engagement_scores ces ON ((ces.customer_id = c.id)));
