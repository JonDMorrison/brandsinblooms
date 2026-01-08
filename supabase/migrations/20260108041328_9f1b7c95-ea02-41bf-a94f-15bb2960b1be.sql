-- Fix crm_outbox status constraint to include all used statuses
-- Current: queued, processing, sent, failed, retrying
-- Adding: pending (for scheduled), skipped (for skipped steps)

ALTER TABLE public.crm_outbox DROP CONSTRAINT IF EXISTS crm_outbox_status_check;

ALTER TABLE public.crm_outbox ADD CONSTRAINT crm_outbox_status_check 
  CHECK (status = ANY (ARRAY['queued'::text, 'pending'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'retrying'::text, 'skipped'::text]));

COMMENT ON CONSTRAINT crm_outbox_status_check ON public.crm_outbox IS 
'Valid statuses: queued (ready to send), pending (scheduled for later), processing (being sent), sent, failed, retrying, skipped';