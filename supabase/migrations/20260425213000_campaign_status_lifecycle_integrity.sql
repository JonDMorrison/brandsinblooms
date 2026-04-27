-- Align crm_campaigns statuses with the queue-first send pipeline and add queue timing.

ALTER TABLE public.crm_campaigns
  ADD COLUMN IF NOT EXISTS queued_at timestamptz;

COMMENT ON COLUMN public.crm_campaigns.queued_at IS
  'Timestamp when the campaign was accepted into the send queue.';

ALTER TABLE public.crm_campaigns
  DROP CONSTRAINT IF EXISTS crm_campaigns_status_check;

ALTER TABLE public.crm_campaigns
  ADD CONSTRAINT crm_campaigns_status_check
  CHECK (
    status IN (
      'draft',
      'scheduled',
      'queued',
      'partially_queued',
      'sending',
      'paused',
      'sent',
      'sent_with_errors',
      'failed'
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_crm_campaigns_queued_at_service_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.queued_at IS NOT NULL
      AND current_user NOT IN ('service_role', 'postgres') THEN
      RAISE EXCEPTION 'queued_at is managed by the send pipeline';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.queued_at IS DISTINCT FROM OLD.queued_at
    AND current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'queued_at is managed by the send pipeline';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_campaigns_enforce_queued_at_service_role
ON public.crm_campaigns;

CREATE TRIGGER crm_campaigns_enforce_queued_at_service_role
BEFORE INSERT OR UPDATE ON public.crm_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.enforce_crm_campaigns_queued_at_service_role();

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END;
$$;