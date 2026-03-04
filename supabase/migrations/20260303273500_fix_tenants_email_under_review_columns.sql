BEGIN;

-- Repair migration: ensure tenants have email_under_review fields.
-- Some environments are missing these columns but governance logic expects them.

ALTER TABLE IF EXISTS public.tenants
  ADD COLUMN IF NOT EXISTS email_under_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_under_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_under_review_reason TEXT,
  ADD COLUMN IF NOT EXISTS email_under_review_details JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
