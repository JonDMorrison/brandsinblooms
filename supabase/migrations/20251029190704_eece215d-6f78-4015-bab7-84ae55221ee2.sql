-- Add RLS policies to allow authenticated users to manage their own oauth state tokens
-- Ensure RLS is enabled (it should already be, but harmless if already enabled)
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own state rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'oauth_states' AND policyname = 'Users can insert their own oauth states'
  ) THEN
    CREATE POLICY "Users can insert their own oauth states"
    ON public.oauth_states
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Allow authenticated users to delete their own state rows (cleanup/failures)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'oauth_states' AND policyname = 'Users can delete their own oauth states'
  ) THEN
    CREATE POLICY "Users can delete their own oauth states"
    ON public.oauth_states
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;

-- Allow authenticated users to select their own state rows (not strictly required, but useful for debugging)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'oauth_states' AND policyname = 'Users can select their own oauth states'
  ) THEN
    CREATE POLICY "Users can select their own oauth states"
    ON public.oauth_states
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;
