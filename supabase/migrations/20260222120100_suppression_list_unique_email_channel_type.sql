-- Milestone 5: Make suppression_list a reliable single source of truth for email suppression.
-- Supabase upsert uses ON CONFLICT on column lists, which cannot target partial unique indexes.
-- We dedupe and add a non-partial unique index to support safe upserts.

-- 1) Deduplicate existing email suppressions for the same key.
-- Keep the most recent record by suppressed_at/created_at.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, email, channel, suppression_type
      ORDER BY suppressed_at DESC NULLS LAST, created_at DESC NULLS LAST
    ) AS rn
  FROM public.suppression_list
  WHERE email IS NOT NULL
)
DELETE FROM public.suppression_list s
USING ranked r
WHERE s.id = r.id
  AND r.rn > 1;

-- 2) Add a unique index that PostgREST/Supabase upsert can target.
-- Note: This intentionally disallows multiple historical rows per suppression key.
CREATE UNIQUE INDEX IF NOT EXISTS suppression_list_tenant_email_channel_type_unique
  ON public.suppression_list (tenant_id, email, channel, suppression_type);

-- 3) Reload PostgREST schema cache (best-effort)
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END;
$$;
