-- Stop the last scheduled social-media workers. Their edge endpoints also
-- return 410, but removing the schedules avoids pointless minute-by-minute
-- invocations and makes the retirement explicit at the control plane.
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('queue-worker-scheduler');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'could not find valid entry%' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    PERFORM cron.unschedule('insights-worker-scheduler');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'could not find valid entry%' THEN
      RAISE;
    END IF;
  END;
END;
$$;
