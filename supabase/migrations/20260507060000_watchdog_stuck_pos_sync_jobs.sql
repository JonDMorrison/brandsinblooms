-- Watchdog for stuck POS sync infrastructure.
--
-- Background: today's outage stranded 3 Patio Gardens Lightspeed
-- sync jobs in 'in_progress' for 9.5+ hours because cron auth was
-- broken and the worker couldn't process them. Also stranded
-- Burnett's VMX sync (last successful run 2026-05-03; new sync
-- attempts couldn't authenticate). The send-pipeline side already
-- has process-email-send-queue's auto-finalize-stuck-campaigns
-- guard from earlier today (commit b7a01221) — this migration
-- mirrors that pattern for the POS side.
--
-- Two checks:
--   1. pos_sync_jobs_v2 rows in 'in_progress' with last_progress_at
--      older than 30 minutes — auto-mark as 'failed' so the next
--      worker tick re-attempts cleanly. last_error captures the
--      remediation context.
--
--   2. pos_connections marked is_active=true whose last_sync_at is
--      older than 2 hours — mark sync_status='error' and append a
--      stall marker (sync_error text + settings.stall_detected_at).
--      pos_connections.sync_status has a CHECK constraint that
--      allows only ('pending','syncing','success','error'), so
--      'error' is the closest fit. The settings json marker makes
--      the stall cause inspectable.
--
-- Run via pg_cron every 5 minutes. SECURITY DEFINER so the function
-- can be called by the cron worker without service-role headers.
--
-- Verified live during this commit: cleared all 3 Patio Gardens
-- stuck jobs (0e85b072, cb122705, c2a7d0da) and flagged 2 stale
-- connections (Burnett VMX, Fezion Garden Center seed).

CREATE OR REPLACE FUNCTION public.recover_stuck_pos_sync_jobs(
  p_stuck_after_minutes integer DEFAULT 30
)
RETURNS TABLE(
  failed_jobs integer,
  stalled_connections integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_jobs_cutoff timestamptz := v_now - make_interval(mins => GREATEST(p_stuck_after_minutes, 5));
  v_conn_cutoff timestamptz := v_now - interval '2 hours';
  v_failed_count integer := 0;
  v_stalled_count integer := 0;
BEGIN
  WITH stuck AS (
    UPDATE public.pos_sync_jobs_v2 j
    SET
      status = 'failed',
      completed_at = v_now,
      updated_at = v_now,
      last_error = COALESCE(NULLIF(j.last_error, ''), '')
        || CASE WHEN COALESCE(j.last_error, '') = '' THEN '' ELSE E'\n' END
        || 'Auto-recovered by recover_stuck_pos_sync_jobs at '
        || v_now::text
        || ': job had no progress for >'
        || GREATEST(p_stuck_after_minutes, 5)::text
        || ' minutes. Worker will re-queue on next tick.'
    WHERE j.status = 'in_progress'
      AND COALESCE(j.last_progress_at, j.started_at, j.updated_at) < v_jobs_cutoff
    RETURNING j.id
  )
  SELECT count(*)::int INTO v_failed_count FROM stuck;

  -- pos_connections.sync_status CHECK only allows
  -- ('pending','syncing','success','error'). Use 'error' for the
  -- stall state and stash the trigger metadata in settings (jsonb)
  -- so the cause is inspectable. Skip rows that already carry a
  -- stall marker so re-running the watchdog doesn't keep updating
  -- timestamps on the same connection.
  WITH stalled AS (
    UPDATE public.pos_connections c
    SET sync_status = 'error',
        sync_error = COALESCE(NULLIF(c.sync_error, ''), '')
          || CASE WHEN COALESCE(c.sync_error, '') = '' THEN '' ELSE E'\n' END
          || 'Stall detected at ' || v_now::text
          || ': last_sync_at older than 2h while is_active=true.',
        settings = COALESCE(c.settings, '{}'::jsonb)
                   || jsonb_build_object(
                        'stall_detected_at', v_now,
                        'stall_reason', 'no_sync_in_2h_while_active'
                      )
    WHERE c.is_active = true
      AND c.last_sync_at IS NOT NULL
      AND c.last_sync_at < v_conn_cutoff
      AND COALESCE(c.settings->>'stall_detected_at', '') = ''
    RETURNING c.id
  )
  SELECT count(*)::int INTO v_stalled_count FROM stalled;

  RETURN QUERY SELECT v_failed_count, v_stalled_count;
END
$function$;

GRANT EXECUTE ON FUNCTION public.recover_stuck_pos_sync_jobs(integer) TO service_role;

-- Schedule the watchdog every 5 minutes. Idempotent.
DO $cron$
BEGIN
  PERFORM cron.unschedule('recover-stuck-pos-sync-jobs');
EXCEPTION WHEN OTHERS THEN
  NULL;
END
$cron$;

SELECT cron.schedule(
  'recover-stuck-pos-sync-jobs',
  '*/5 * * * *',
  $cron_call$ SELECT public.recover_stuck_pos_sync_jobs(); $cron_call$
);
