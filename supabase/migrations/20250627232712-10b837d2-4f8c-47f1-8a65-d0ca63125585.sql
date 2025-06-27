
-- Create table to track per-tenant theme status (generated/skipped)
CREATE TABLE IF NOT EXISTS user_theme_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  user_id uuid REFERENCES auth.users(id),
  theme_id text NOT NULL, -- Using text since themes might be identified by strings
  status text CHECK (status IN ('generated', 'skipped')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '1 year') -- Skip expires after 1 year
);

-- Create unique index to prevent duplicate entries per tenant/user/theme
CREATE UNIQUE INDEX IF NOT EXISTS uts_tenant_user_theme_idx
  ON user_theme_status (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), user_id, theme_id);

-- Add RLS policies
ALTER TABLE user_theme_status ENABLE ROW LEVEL SECURITY;

-- Users can only see their own theme status
CREATE POLICY "Users can view their own theme status" 
  ON user_theme_status 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can insert their own theme status
CREATE POLICY "Users can create their own theme status" 
  ON user_theme_status 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own theme status
CREATE POLICY "Users can update their own theme status" 
  ON user_theme_status 
  FOR UPDATE 
  USING (auth.uid() = user_id);
