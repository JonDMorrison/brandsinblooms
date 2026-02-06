-- Add 'paused' to campaign + email queue status constraints.

-- crm_campaigns
ALTER TABLE public.crm_campaigns
  DROP CONSTRAINT IF EXISTS crm_campaigns_status_check;

ALTER TABLE public.crm_campaigns
  ADD CONSTRAINT crm_campaigns_status_check
  CHECK (status IN ('draft', 'scheduled', 'sending', 'paused', 'sent', 'failed'));

-- email_messages
ALTER TABLE public.email_messages
  DROP CONSTRAINT IF EXISTS email_messages_status_check;

DO $$
DECLARE
  c_name TEXT;
BEGIN
  SELECT conname
  INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'public.email_messages'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%IN%queued%';

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.email_messages DROP CONSTRAINT IF EXISTS %I', c_name);
  END IF;
END$$;

ALTER TABLE public.email_messages
  ADD CONSTRAINT email_messages_status_check
  CHECK (status IN ('queued', 'paused', 'sending', 'sent', 'failed', 'skipped'));

-- email_send_jobs
ALTER TABLE public.email_send_jobs
  DROP CONSTRAINT IF EXISTS email_send_jobs_status_check;

DO $$
DECLARE
  c_name TEXT;
BEGIN
  SELECT conname
  INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'public.email_send_jobs'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%IN%pending%';

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.email_send_jobs DROP CONSTRAINT IF EXISTS %I', c_name);
  END IF;
END$$;

ALTER TABLE public.email_send_jobs
  ADD CONSTRAINT email_send_jobs_status_check
  CHECK (status IN ('pending', 'paused', 'in_progress', 'completed', 'failed'));
