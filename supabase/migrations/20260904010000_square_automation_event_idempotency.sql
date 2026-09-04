-- Square webhooks may be delivered more than once and payment.updated may
-- repeat the same completed payment. Give each automation/provider event a
-- durable key so a retry can repair partial work without starting a duplicate
-- customer journey.

ALTER TABLE public.automation_trigger_events
  ADD COLUMN IF NOT EXISTS source_event_key text;

ALTER TABLE public.automation_trigger_events
  DROP CONSTRAINT IF EXISTS automation_trigger_events_source_event_key_check;
ALTER TABLE public.automation_trigger_events
  ADD CONSTRAINT automation_trigger_events_source_event_key_check
  CHECK (
    source_event_key IS NULL
    OR length(btrim(source_event_key)) BETWEEN 1 AND 500
  );

CREATE UNIQUE INDEX IF NOT EXISTS automation_trigger_events_source_unique
  ON public.automation_trigger_events(
    tenant_id,
    automation_id,
    source_event_key
  );

COMMENT ON COLUMN public.automation_trigger_events.source_event_key IS
  'Stable provider event identity used to suppress duplicate automation enrollment during webhook retries.';
