-- Fix crm_customers RLS policy to properly validate INSERT operations
-- Drop existing policy and recreate with explicit WITH CHECK clause

DROP POLICY IF EXISTS "Users can manage customers for their tenant" ON crm_customers;

-- Create separate policies for each operation for better control
CREATE POLICY "Users can view customers for their tenant"
ON crm_customers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.tenant_id = crm_customers.tenant_id 
    AND u.id = auth.uid()
  )
);

CREATE POLICY "Users can insert customers for their tenant"
ON crm_customers FOR INSERT
WITH CHECK (
  -- Ensure user_id matches authenticated user
  user_id = auth.uid()
  AND
  -- Ensure tenant_id matches user's tenant
  tenant_id = (
    SELECT tenant_id 
    FROM users 
    WHERE id = auth.uid()
  )
  AND
  -- Ensure tenant_id is not null
  tenant_id IS NOT NULL
);

CREATE POLICY "Users can update customers for their tenant"
ON crm_customers FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.tenant_id = crm_customers.tenant_id 
    AND u.id = auth.uid()
  )
)
WITH CHECK (
  tenant_id = (
    SELECT tenant_id 
    FROM users 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete customers for their tenant"
ON crm_customers FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.tenant_id = crm_customers.tenant_id 
    AND u.id = auth.uid()
  )
);

-- Ensure all auth users have a public.users entry with tenant_id
-- This handles the case where users were created but don't have tenant_id set
DO $$
DECLARE
  auth_user RECORD;
  new_tenant_id UUID;
  user_name TEXT;
BEGIN
  FOR auth_user IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.users u ON u.id = au.id
    WHERE u.tenant_id IS NULL OR u.id IS NULL
  LOOP
    -- Extract name from email or metadata
    user_name := COALESCE(
      auth_user.raw_user_meta_data->>'full_name',
      SPLIT_PART(auth_user.email, '@', 1)
    );
    
    -- Create a new tenant for this user if they don't have one
    INSERT INTO tenants (name, slug, is_active)
    VALUES (
      COALESCE(user_name, 'Organization'),
      LOWER(REGEXP_REPLACE(COALESCE(auth_user.email, gen_random_uuid()::text), '[^a-z0-9]+', '-', 'g')),
      true
    )
    RETURNING id INTO new_tenant_id;
    
    -- Upsert the user record with tenant_id
    INSERT INTO public.users (id, name, email, tenant_id, role, created_by_user_id)
    VALUES (auth_user.id, user_name, auth_user.email, new_tenant_id, 'admin', auth_user.id)
    ON CONFLICT (id) DO UPDATE 
    SET tenant_id = EXCLUDED.tenant_id
    WHERE users.tenant_id IS NULL;
  END LOOP;
END $$;