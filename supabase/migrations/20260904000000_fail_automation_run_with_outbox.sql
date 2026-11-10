-- A terminal outbox failure and its parent journey must commit together.
-- Keeping this in a trigger prevents a crashed worker from leaving an active
-- run whose required message has already failed.

CREATE OR REPLACE FUNCTION public.fail_automation_run_with_outbox()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.automation_runs AS run
  SET status = 'failed',
      error_message = format(
        'Step %s failed: %s',
        NEW.step_index,
        coalesce(nullif(NEW.error_message, ''), 'Delivery failed')
      ),
      completed_at = coalesce(run.completed_at, now()),
      next_step_scheduled_at = NULL,
      updated_at = now()
  WHERE run.id = NEW.automation_run_id
    AND run.tenant_id = NEW.tenant_id
    AND run.status = 'active';

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_automation_run_with_outbox()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_automation_run_with_outbox()
  TO service_role;

DROP TRIGGER IF EXISTS fail_automation_run_with_outbox
  ON public.crm_outbox;
CREATE TRIGGER fail_automation_run_with_outbox
AFTER UPDATE OF status ON public.crm_outbox
FOR EACH ROW
WHEN (
  NEW.status = 'failed'
  AND OLD.status IS DISTINCT FROM NEW.status
  AND NEW.automation_run_id IS NOT NULL
)
EXECUTE FUNCTION public.fail_automation_run_with_outbox();

COMMENT ON FUNCTION public.fail_automation_run_with_outbox()
IS 'Atomically marks an active automation run failed when its outbox delivery reaches terminal failure.';
