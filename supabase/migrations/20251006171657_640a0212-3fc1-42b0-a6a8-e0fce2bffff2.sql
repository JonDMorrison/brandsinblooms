-- Fix RLS for plans: allow inserts by the owner
-- This addresses failures when launching a plan ("round") due to missing INSERT policy

-- Drop existing all-encompassing policy to replace with more explicit policies
DROP POLICY IF EXISTS "Users can manage their own plans" ON public.plans;

-- Create explicit policies for each operation
CREATE POLICY "Users can insert their own plans"
  ON public.plans
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own plans"
  ON public.plans
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own plans"
  ON public.plans
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plans"
  ON public.plans
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);