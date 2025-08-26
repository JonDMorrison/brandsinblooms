
-- 1) Add website_url column if it doesn't exist
ALTER TABLE public.company_profiles
ADD COLUMN IF NOT EXISTS website_url text;

-- 2) Optional convenience RPC to mark onboarding complete
CREATE OR REPLACE FUNCTION public.mark_onboarding_completed(p_company text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.company_profiles
     SET onboarding_completed_at = now(),
         company_name = COALESCE(company_name, p_company),
         updated_at = now()
   WHERE user_id = auth.uid();
END;
$$;

-- 3) Ensure a basic index on user_id (safe if it already exists)
CREATE INDEX IF NOT EXISTS idx_company_profiles_user_id
  ON public.company_profiles(user_id);
