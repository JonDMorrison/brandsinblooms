-- Fix email_tracking_events idempotency so distinct event types don't collide,
-- and dedupe provider retries via webhook_delivery_id.

-- 1) Drop any overly-coarse unique index that keys on event_data->>'email_id' but omits event_type.
DO $$
DECLARE
  idx RECORD;
BEGIN
  FOR idx IN (
    SELECT schemaname, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'email_tracking_events'
      AND indexdef ILIKE 'create unique index%'
      AND indexdef ILIKE '%event_data%'
      AND indexdef ILIKE '%email_id%'
      AND indexdef NOT ILIKE '%event_type%'
  ) LOOP
    RAISE NOTICE 'Dropping overly-coarse unique index %: %', idx.indexname, idx.indexdef;
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', idx.schemaname, idx.indexname);
  END LOOP;
END $$;

-- 2) Ensure the intended idempotency index exists (campaign + recipient + event_type + provider email_id).
DROP INDEX IF EXISTS public.idx_email_tracking_events_idempotency;
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_tracking_events_idempotency
ON public.email_tracking_events (
  campaign_id,
  customer_email,
  event_type,
  ((event_data->>'email_id')::text)
)
WHERE event_data->>'email_id' IS NOT NULL;

-- 3) Dedupe any existing duplicate rows for the same webhook delivery id, then enforce uniqueness.
WITH keepers AS (
  SELECT DISTINCT ON (webhook_delivery_id)
    webhook_delivery_id,
    id AS keep_id
  FROM public.email_tracking_events
  WHERE webhook_delivery_id IS NOT NULL
  ORDER BY webhook_delivery_id, created_at ASC, id::text ASC
),
dups AS (
  SELECT e.id
  FROM public.email_tracking_events e
  JOIN keepers k
    ON k.webhook_delivery_id = e.webhook_delivery_id
  WHERE e.webhook_delivery_id IS NOT NULL
    AND e.id <> k.keep_id
)
DELETE FROM public.email_tracking_events e
USING dups d
WHERE e.id = d.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_tracking_events_webhook_delivery_id
ON public.email_tracking_events (webhook_delivery_id)
WHERE webhook_delivery_id IS NOT NULL;
