-- Reschedule auto-send-campaigns to run every minute (instead of hourly).
-- This ensures scheduled campaigns send close to their scheduled_at time.

DO $do$
DECLARE
  v_command TEXT;
  v_jobid BIGINT;
BEGIN
  -- Prefer reusing the existing command so we don't duplicate URLs/headers.
  SELECT command INTO v_command
  FROM cron.job
  WHERE jobname = 'auto-send-campaigns'
  ORDER BY jobid DESC
  LIMIT 1;

  -- Unschedule any existing auto-send-campaigns jobs (idempotent)
  FOR v_jobid IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'auto-send-campaigns'
  LOOP
    PERFORM cron.unschedule(v_jobid);
  END LOOP;

  IF v_command IS NULL THEN
    RAISE EXCEPTION 'Could not find existing cron.job command for jobname=%; cannot reschedule automatically', 'auto-send-campaigns';
  END IF;

  -- Every minute
  PERFORM cron.schedule(
    'auto-send-campaigns',
    '* * * * *',
    v_command
  );
END;
$do$;
