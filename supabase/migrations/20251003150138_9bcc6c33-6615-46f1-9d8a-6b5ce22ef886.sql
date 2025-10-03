-- Fix signup: ensure ON CONFLICT (user_id) works by enforcing uniqueness
-- 1) Deduplicate company_profiles by user_id (keep most recent)
WITH ranked AS (
  SELECT 
    id,
    user_id,
    updated_at,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id 
      ORDER BY 
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM public.company_profiles
)
DELETE FROM public.company_profiles cp
USING ranked r
WHERE cp.id = r.id
  AND r.rn > 1;

-- 2) Add a unique constraint on company_profiles.user_id so ON CONFLICT works
DO $$
BEGIN
  -- Create unique index if missing
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND indexname = 'idx_company_profiles_user_id_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_company_profiles_user_id_unique 
      ON public.company_profiles(user_id);
  END IF;

  -- Attach constraint to the index if missing
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint 
    WHERE conname = 'company_profiles_user_id_key'
      AND conrelid = 'public.company_profiles'::regclass
  ) THEN
    ALTER TABLE public.company_profiles
      ADD CONSTRAINT company_profiles_user_id_key 
      UNIQUE USING INDEX idx_company_profiles_user_id_unique;
  END IF;
END$$;

-- Note: handle_new_user_team() already uses ON CONFLICT (user_id) DO UPDATE
-- After this migration, the signup trigger chain should complete without errors.