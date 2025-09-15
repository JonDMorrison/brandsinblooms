-- Admin Console Upgrade: Create admin security and tenant overview

-- 1. Create admin allowlist table
CREATE TABLE IF NOT EXISTS app_admin_emails (
  email text PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now(),
  created_by text
);

-- Insert super admin emails from existing setup
INSERT INTO app_admin_emails (email, created_by) 
VALUES 
  ('jon@getclear.ca', 'system'),
  ('jeff@brandsinblooms.com', 'system')
ON CONFLICT (email) DO NOTHING;

-- 2. Add missing columns to tenants if they don't exist
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS region text;  
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS last_event_at timestamp with time zone;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

-- 3. Add missing columns to users if they don't exist  
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sign_in_at timestamp with time zone;

-- 4. Create admin tenant overview view
CREATE OR REPLACE VIEW admin_tenant_overview AS
SELECT
  t.id as tenant_id,
  t.name as company_name,
  t.website,
  COALESCE(t.city, '') as city,
  COALESCE(t.region, '') as region,
  COALESCE(t.country, '') as country,
  cp.onboarding_completed_at,
  t.created_at as tenant_created_at,
  t.archived_at,
  -- primary contact: user with earliest created_at 
  u.email as primary_contact_email,
  COALESCE(u.full_name, u.name, '') as primary_contact_name,
  u.last_sign_in_at as primary_contact_last_login,
  s.plan,
  s.status as subscription_status,
  s.start_date as trial_start,
  s.end_date as trial_end,
  s.end_date as current_period_end,
  -- activity: choose your signal
  GREATEST(
    COALESCE(u.last_sign_in_at, 'epoch'::timestamptz),
    COALESCE(t.last_event_at, 'epoch'::timestamptz)
  ) as last_activity_at,
  -- derived flags
  (s.plan = 'free_trial') as is_trialing,
  (s.plan != 'free_trial' AND s.end_date > now()) as is_paid_active,
  (now() <= s.end_date) as trial_not_expired,
  (t.archived_at IS NULL) as is_active
FROM tenants t
LEFT JOIN LATERAL (
  SELECT u.*
  FROM users u
  WHERE u.tenant_id = t.id
  ORDER BY u.created_at ASC
  LIMIT 1
) u ON true
LEFT JOIN LATERAL (
  SELECT cp.*
  FROM company_profiles cp
  WHERE cp.user_id = u.id
  LIMIT 1
) cp ON true
LEFT JOIN LATERAL (
  SELECT s.*
  FROM subscriptions s
  WHERE s.user_id = u.id
  ORDER BY s.updated_at DESC
  LIMIT 1
) s ON true;

-- 5. Create secure admin RPC for listing tenants
CREATE OR REPLACE FUNCTION admin_list_tenants(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL, -- 'trialing' | 'active' | 'canceled' | null
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  tenant_id uuid,
  company_name text,
  website text,
  city text,
  region text,
  country text,
  onboarding_completed_at timestamptz,
  tenant_created_at timestamptz,
  primary_contact_email text,
  primary_contact_name text,
  primary_contact_last_login timestamptz,
  plan text,
  subscription_status text,
  trial_start timestamptz,
  trial_end timestamptz,
  current_period_end timestamptz,
  last_activity_at timestamptz,
  is_trialing boolean,
  is_paid_active boolean,
  trial_not_expired boolean,
  is_active boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT current_setting('request.jwt.claims', true)::json ->> 'email' as email
  ),
  authz AS (
    SELECT 1 FROM app_admin_emails a JOIN me ON a.email = me.email
  )
  SELECT 
    v.tenant_id,
    v.company_name,
    v.website,
    v.city,
    v.region,
    v.country,
    v.onboarding_completed_at,
    v.tenant_created_at,
    v.primary_contact_email,
    v.primary_contact_name,
    v.primary_contact_last_login,
    v.plan,
    v.subscription_status,
    v.trial_start,
    v.trial_end,
    v.current_period_end,
    v.last_activity_at,
    v.is_trialing,
    v.is_paid_active,
    v.trial_not_expired,
    v.is_active
  FROM admin_tenant_overview v
  WHERE EXISTS (SELECT 1 FROM authz)
    AND (p_status IS NULL OR 
         (p_status = 'trialing' AND v.is_trialing) OR
         (p_status = 'active' AND v.is_paid_active) OR  
         (p_status = 'canceled' AND NOT v.is_active))
    AND (
      p_search IS NULL
      OR v.company_name ILIKE '%' || p_search || '%'
      OR v.primary_contact_email ILIKE '%' || p_search || '%'
      OR v.website ILIKE '%' || p_search || '%'
    )
  ORDER BY v.last_activity_at DESC NULLS LAST, v.tenant_created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- 6. Create admin action RPCs
CREATE OR REPLACE FUNCTION admin_toggle_tenant_active(p_tenant_id uuid, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE 
  me text;
BEGIN
  SELECT current_setting('request.jwt.claims', true)::json ->> 'email' INTO me;
  IF NOT EXISTS (SELECT 1 FROM app_admin_emails WHERE email = me) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE tenants
  SET 
    archived_at = CASE WHEN p_active THEN NULL ELSE now() END,
    updated_at = now()
  WHERE id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_extend_trial(p_tenant_id uuid, p_days int)
RETURNS void
LANGUAGE plpgsql  
SECURITY DEFINER
AS $$
DECLARE 
  me text;
  user_record RECORD;
BEGIN
  SELECT current_setting('request.jwt.claims', true)::json ->> 'email' INTO me;
  IF NOT EXISTS (SELECT 1 FROM app_admin_emails WHERE email = me) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Find the primary user for this tenant
  SELECT u.id INTO user_record
  FROM users u 
  WHERE u.tenant_id = p_tenant_id
  ORDER BY u.created_at ASC
  LIMIT 1;

  IF user_record.id IS NOT NULL THEN
    UPDATE subscriptions
    SET 
      end_date = COALESCE(end_date, now()) + (p_days || ' days')::interval,
      updated_at = now()
    WHERE user_id = user_record.id;
  END IF;
END;
$$;

-- 7. Create admin stats RPC
CREATE OR REPLACE FUNCTION admin_get_stats()
RETURNS TABLE (
  total_tenants bigint,
  active_trials bigint,
  paid_active bigint,
  inactive_tenants bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT current_setting('request.jwt.claims', true)::json ->> 'email' as email
  ),
  authz AS (
    SELECT 1 FROM app_admin_emails a JOIN me ON a.email = me.email
  )
  SELECT 
    COUNT(*) as total_tenants,
    COUNT(*) FILTER (WHERE is_trialing) as active_trials,
    COUNT(*) FILTER (WHERE is_paid_active) as paid_active,
    COUNT(*) FILTER (WHERE NOT is_active) as inactive_tenants
  FROM admin_tenant_overview v
  WHERE EXISTS (SELECT 1 FROM authz);
$$;

-- 8. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_updated ON subscriptions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_tenant_created ON users(tenant_id, created_at ASC);