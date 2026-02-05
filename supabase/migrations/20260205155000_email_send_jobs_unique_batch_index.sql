-- Ensure `email_send_jobs` supports upsert on (campaign_id, batch_index)
-- Required for ON CONFLICT (campaign_id,batch_index)

-- Safety: ensure column exists
ALTER TABLE public.email_send_jobs
  ADD COLUMN IF NOT EXISTS batch_index INTEGER NOT NULL DEFAULT 0;

-- Create the unique index that matches the upsert conflict target
-- If duplicates exist, ON CONFLICT cannot work and the index cannot be created.
-- Keep the newest job per (campaign_id, batch_index) and delete the rest.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY campaign_id, batch_index
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.email_send_jobs
)
DELETE FROM public.email_send_jobs j
USING ranked r
WHERE j.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_send_jobs_campaign_batch
  ON public.email_send_jobs (campaign_id, batch_index);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
