-- The per-event recompute path is already in place — the
-- email-tracking-webhook handler calls recompute_campaign_metrics
-- after each event ingest at supabase/functions/email-tracking-webhook/
-- index.ts:1186 and :1268. Manual sampling against Mother's Day
-- and Top Coaching campaigns confirmed the calculation is correct
-- when invoked. The remaining gap is historical: campaigns whose
-- rollup_refreshed_at predates later events (because the per-event
-- recompute was added after those events landed, OR because a webhook
-- delivery failed and the recompute was skipped).
--
-- This migration:
--   1. One-shot backfill — recompute every sent / sending crm_campaigns
--      row so historical rollups match the event ledger.
--   2. Safety-net function — recompute_recent_campaign_rollups —
--      that re-runs recompute on campaigns updated in the last 7 days,
--      bounded so cron stays cheap.
--   3. pg_cron schedule (every 5 minutes) calling that function as a
--      defense-in-depth against any webhook-missed recompute.
--
-- Per the work order, the webhook event path remains the primary
-- (sub-second freshness) path; this cron only catches missed events.

-- 1. One-shot backfill of historical rollups
DO $backfill$
DECLARE
  v_campaign_id uuid;
  v_count integer := 0;
BEGIN
  FOR v_campaign_id IN
    SELECT id FROM public.crm_campaigns
    WHERE status IN ('sent', 'sending', 'sent_with_errors', 'partially_queued')
  LOOP
    BEGIN
      PERFORM public.recompute_campaign_metrics(v_campaign_id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill skipped campaign % (% / %)', v_campaign_id, SQLSTATE, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'Backfilled rollups for % campaigns', v_count;
END
$backfill$;

-- 2. Safety-net function: recompute campaigns recently active. Uses
--    rollup_refreshed_at so we skip campaigns that the per-event
--    webhook path has kept fresh, only catching ones that drifted.
CREATE OR REPLACE FUNCTION public.recompute_recent_campaign_rollups(
  p_max_age_days integer DEFAULT 7,
  p_max_campaigns integer DEFAULT 200
)
RETURNS TABLE(recomputed integer, skipped integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_recomputed integer := 0;
  v_skipped integer := 0;
  v_campaign_id uuid;
  v_cutoff timestamptz := NOW() - make_interval(days => p_max_age_days);
BEGIN
  FOR v_campaign_id IN
    SELECT c.id
    FROM public.crm_campaigns c
    WHERE c.status IN ('sent', 'sending', 'sent_with_errors', 'partially_queued')
      AND COALESCE(c.sent_at, c.send_started_at, c.updated_at) >= v_cutoff
      -- Only recompute campaigns whose rollup is older than the most
      -- recent event we have for them, so we don't waste cycles on
      -- campaigns the webhook is keeping current.
      AND EXISTS (
        SELECT 1 FROM public.email_tracking_events e
        WHERE e.campaign_id = c.id
          AND e.created_at > COALESCE(c.rollup_refreshed_at, 'epoch'::timestamptz)
      )
    ORDER BY COALESCE(c.sent_at, c.send_started_at, c.updated_at) DESC
    LIMIT p_max_campaigns
  LOOP
    BEGIN
      PERFORM public.recompute_campaign_metrics(v_campaign_id);
      v_recomputed := v_recomputed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_skipped := v_skipped + 1;
      RAISE LOG 'recompute_recent_campaign_rollups: skipped % (%)', v_campaign_id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT v_recomputed, v_skipped;
END
$function$;

GRANT EXECUTE ON FUNCTION public.recompute_recent_campaign_rollups(integer, integer) TO service_role;

-- 3. Schedule the safety-net every 5 minutes via pg_cron
DO $cron$
BEGIN
  PERFORM cron.unschedule('recompute-recent-campaign-rollups');
EXCEPTION WHEN OTHERS THEN
  NULL;
END
$cron$;

SELECT cron.schedule(
  'recompute-recent-campaign-rollups',
  '*/5 * * * *',
  $cron_call$ SELECT public.recompute_recent_campaign_rollups(); $cron_call$
);
