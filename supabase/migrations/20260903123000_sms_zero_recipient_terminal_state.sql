-- A campaign with no eligible recipients is a visible terminal failure, not a
-- campaign that remains in "sending" forever.
UPDATE public.crm_sms_campaigns c
SET status = 'failed',
    enqueue_status = 'failed',
    enqueued = false,
    sent_at = NULL,
    enqueue_claimed_at = NULL,
    enqueue_claimed_by = NULL,
    updated_at = now()
WHERE c.status = 'sending'
  AND c.enqueue_status = 'enqueued'
  AND coalesce(c.total_enqueued, 0) = 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.sms_messages m
    WHERE m.campaign_id = c.id
  );
