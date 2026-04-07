-- Fix admin_tenant_overview view:
-- 1. last_activity_at: use auth.users.last_sign_in_at instead of users.last_sign_in_at (which is never populated)
-- 2. location: use company_profiles.city/state_province/country instead of tenants.city/region/country (which are never populated)
-- 3. Remove epoch fallback so NULL means "never" instead of 1970-01-01

CREATE OR REPLACE VIEW admin_tenant_overview AS
SELECT
  t.id as tenant_id,
  t.name as company_name,
  COALESCE(t.website, cp.website, '') as website,
  COALESCE(cp.city, '') as city,
  COALESCE(cp.state_province, '') as region,
  COALESCE(cp.country, '') as country,
  COALESCE(cp.onboarding_completed_at, cp.crm_onboarding_completed_at) as onboarding_completed_at,
  t.created_at as tenant_created_at,
  t.archived_at,
  u.email as primary_contact_email,
  COALESCE(u.full_name, u.name, '') as primary_contact_name,
  au.last_sign_in_at as primary_contact_last_login,
  s.plan,
  CASE
    WHEN s.end_date > now() AND s.deleted_at IS NULL THEN 'active'
    WHEN s.end_date <= now() THEN 'expired'
    ELSE 'canceled'
  END as subscription_status,
  s.start_date as trial_start,
  s.end_date as trial_end,
  s.end_date as current_period_end,
  GREATEST(
    au.last_sign_in_at,
    t.last_event_at
  ) as last_activity_at,
  (s.plan = 'free_trial') as is_trialing,
  (s.plan != 'free_trial' AND s.end_date > now() AND s.deleted_at IS NULL) as is_paid_active,
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
  SELECT au.*
  FROM auth.users au
  WHERE au.id = u.id
  LIMIT 1
) au ON true
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
