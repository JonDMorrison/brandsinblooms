
-- Fix RLS policies for tenants table to allow proper tenant creation during onboarding

-- Drop existing restrictive policy that might be blocking inserts
DROP POLICY IF EXISTS "Users can view tenants they belong to" ON public.tenants;

-- Create a more permissive SELECT policy that handles users without tenants
CREATE POLICY "Users can view accessible tenants" 
  ON public.tenants 
  FOR SELECT 
  USING (
    -- Allow users to see tenants they belong to
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.tenant_id = tenants.id 
      AND u.id = auth.uid()
    )
    -- Also allow users to see tenants during onboarding (when they don't have a tenant yet)
    OR NOT EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() 
      AND u.tenant_id IS NOT NULL
    )
  );

-- Add INSERT policy to allow authenticated users to create tenants during onboarding
CREATE POLICY "Authenticated users can create tenants" 
  ON public.tenants 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Add UPDATE policy for users to update tenants they belong to
CREATE POLICY "Users can update their tenant" 
  ON public.tenants 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.tenant_id = tenants.id 
      AND u.id = auth.uid()
    )
  );

-- Add DELETE policy for tenant owners (optional, for completeness)
CREATE POLICY "Users can delete their tenant" 
  ON public.tenants 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.tenant_id = tenants.id 
      AND u.id = auth.uid()
    )
  );
