-- Reconcile historical crm_campaigns rollups with the event ledger.
--
-- Rollups written before the click/clicked and open/opened stream
-- unification disagreed with email_tracking_events (e.g. campaigns with
-- hundreds of ledger clickers but total_clicks = 0 or 1). The canonical
-- definition lives in get_campaign_derived_metrics and already counts
-- both event-name streams as unique recipients per lower(customer_email),
-- with open_rate/click_rate over successful reach (delivered minus hard
-- bounces); the stale rows simply predate it and were never recomputed.
--
-- Re-running the canonical recompute for every campaign converges all
-- rollup columns and the metrics jsonb. Idempotent: recomputing an
-- already-correct campaign rewrites the same values.
DO $$
BEGIN
  PERFORM public.recompute_campaign_metrics(id) FROM public.crm_campaigns;
END;
$$;
