-- Milestone 2: amend email_tracking_events idempotency from
-- 20260103210202_05b16f9e-801c-4000-805e-7f3343a1fb82.sql and
-- 20260314120000_fix_email_tracking_events_idempotency.sql.
--
-- Goal:
-- - keep webhook-delivery replay protection intact
-- - prevent blank key components from participating in semantic/provider indexes
-- - require normalized idempotency fields on new rows without breaking existing data

-- Normalize historical blank strings so rebuilt predicates behave consistently.
UPDATE public.email_tracking_events
SET provider_message_id = NULL
WHERE provider_message_id IS NOT NULL
  AND btrim(provider_message_id) = '';

UPDATE public.email_tracking_events
SET webhook_delivery_id = NULL
WHERE webhook_delivery_id IS NOT NULL
  AND btrim(webhook_delivery_id) = '';

UPDATE public.email_tracking_events
SET event_data = event_data - 'email_id'
WHERE event_data ? 'email_id'
  AND btrim(COALESCE(event_data->>'email_id', '')) = '';

-- Rebuild the semantic unique index so blank derived email ids never collide.
DROP INDEX IF EXISTS public.idx_email_tracking_events_idempotency;
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_tracking_events_idempotency
ON public.email_tracking_events (
  campaign_id,
  customer_email,
  event_type,
  ((event_data->>'email_id')::text)
)
WHERE NULLIF(btrim(event_data->>'email_id'), '') IS NOT NULL;

-- Rebuild the provider tuple index so blank provider ids never disable safe dedupe semantics.
DROP INDEX IF EXISTS public.idx_email_tracking_events_provider_idempotency;
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_tracking_events_provider_idempotency
ON public.email_tracking_events (tenant_id, provider_message_id, event_type, event_ts_provider)
WHERE NULLIF(btrim(provider_message_id), '') IS NOT NULL
  AND event_ts_provider IS NOT NULL;

-- Rebuild the webhook delivery index to ignore accidental blank delivery ids.
DROP INDEX IF EXISTS public.idx_email_tracking_events_webhook_delivery_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_tracking_events_webhook_delivery_id
ON public.email_tracking_events (webhook_delivery_id)
WHERE NULLIF(btrim(webhook_delivery_id), '') IS NOT NULL;

-- Enforce normalized keys for new writes without invalidating historical rows.
ALTER TABLE public.email_tracking_events
  DROP CONSTRAINT IF EXISTS email_tracking_events_provider_message_id_present_chk;

ALTER TABLE public.email_tracking_events
  ADD CONSTRAINT email_tracking_events_provider_message_id_present_chk
  CHECK (NULLIF(btrim(provider_message_id), '') IS NOT NULL) NOT VALID;

ALTER TABLE public.email_tracking_events
  DROP CONSTRAINT IF EXISTS email_tracking_events_event_ts_provider_present_chk;

ALTER TABLE public.email_tracking_events
  ADD CONSTRAINT email_tracking_events_event_ts_provider_present_chk
  CHECK (event_ts_provider IS NOT NULL) NOT VALID;

ALTER TABLE public.email_tracking_events
  DROP CONSTRAINT IF EXISTS email_tracking_events_event_data_email_id_present_chk;

ALTER TABLE public.email_tracking_events
  ADD CONSTRAINT email_tracking_events_event_data_email_id_present_chk
  CHECK (NULLIF(btrim(event_data->>'email_id'), '') IS NOT NULL) NOT VALID;