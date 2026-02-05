-- Ensure email_send_jobs has the columns required for crash-safe claiming.

ALTER TABLE public.email_send_jobs
  ADD COLUMN IF NOT EXISTS recipient_message_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_by TEXT,
  ADD COLUMN IF NOT EXISTS claim_token UUID;

CREATE INDEX IF NOT EXISTS idx_email_send_jobs_claimable
  ON public.email_send_jobs (status, claimed_at, created_at)
  WHERE status IN ('pending', 'in_progress');

NOTIFY pgrst, 'reload schema';
