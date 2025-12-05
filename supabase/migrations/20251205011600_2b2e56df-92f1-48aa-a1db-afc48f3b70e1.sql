-- Create tier_limits lookup table for subscription tiers
CREATE TABLE IF NOT EXISTS public.tier_limits (
  tier TEXT PRIMARY KEY,
  email_limit INTEGER NOT NULL,
  sms_limit INTEGER NOT NULL,
  email_overage_rate NUMERIC(6,4) DEFAULT 0.002,
  sms_overage_rate NUMERIC(6,4) DEFAULT 0.03,
  includes_website BOOLEAN DEFAULT false,
  price_monthly INTEGER NOT NULL,
  price_annual INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert tier limits
INSERT INTO public.tier_limits (tier, email_limit, sms_limit, email_overage_rate, sms_overage_rate, includes_website, price_monthly, price_annual) VALUES 
  ('seed', 10000, 1000, 0.002, 0.03, false, 199, 1990),
  ('sprout', 20000, 2000, 0.002, 0.03, true, 349, 3490),
  ('bloom', 100000, 5000, 0.002, 0.03, true, 699, 6990),
  ('thrive', -1, 50000, 0, 0.03, true, 1199, 11990)
ON CONFLICT (tier) DO UPDATE SET
  email_limit = EXCLUDED.email_limit,
  sms_limit = EXCLUDED.sms_limit,
  email_overage_rate = EXCLUDED.email_overage_rate,
  sms_overage_rate = EXCLUDED.sms_overage_rate,
  includes_website = EXCLUDED.includes_website,
  price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual,
  updated_at = now();

-- Add new columns to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS tier TEXT CHECK (tier IN ('seed', 'sprout', 'bloom', 'thrive')),
ADD COLUMN IF NOT EXISTS is_founding_customer BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS usage_alert_80_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS usage_alert_100_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS overage_emails_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS overage_sms_this_month INTEGER DEFAULT 0;

-- Create SMS quota check function
CREATE OR REPLACE FUNCTION public.check_sms_quota(
  p_tenant_id UUID,
  p_recipient_count INTEGER
) RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
  v_tier_limits RECORD;
  v_remaining INTEGER;
  v_sms_limit INTEGER;
BEGIN
  -- Get subscription for user in this tenant
  SELECT s.* INTO v_subscription 
  FROM subscriptions s
  JOIN users u ON u.id = s.user_id
  WHERE u.tenant_id = p_tenant_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_subscription', 'message', 'No active subscription found.');
  END IF;
  
  -- Get tier limits if tier is set, otherwise use legacy sms_quota
  IF v_subscription.tier IS NOT NULL THEN
    SELECT * INTO v_tier_limits FROM tier_limits WHERE tier = v_subscription.tier;
    v_sms_limit := v_tier_limits.sms_limit;
  ELSE
    v_sms_limit := COALESCE(v_subscription.sms_quota, 1000);
  END IF;
  
  -- Check if unlimited (-1 means unlimited)
  IF v_sms_limit = -1 THEN
    RETURN jsonb_build_object('allowed', true, 'unlimited', true);
  END IF;
  
  -- Calculate remaining
  v_remaining := v_sms_limit - COALESCE(v_subscription.sms_usage, 0);
  
  IF v_remaining >= p_recipient_count THEN
    RETURN jsonb_build_object('allowed', true, 'remaining', v_remaining, 'limit', v_sms_limit);
  ELSE
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', 'quota_exceeded',
      'message', format('SMS limit reached. You have %s remaining but need %s.', GREATEST(0, v_remaining), p_recipient_count),
      'remaining', GREATEST(0, v_remaining),
      'limit', v_sms_limit,
      'overage_needed', p_recipient_count - v_remaining
    );
  END IF;
END;
$$;

-- Create email quota check function (enhanced version)
CREATE OR REPLACE FUNCTION public.check_email_quota(
  p_tenant_id UUID,
  p_recipient_count INTEGER
) RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
  v_tier_limits RECORD;
  v_remaining INTEGER;
  v_email_limit INTEGER;
BEGIN
  -- Get subscription for user in this tenant
  SELECT s.* INTO v_subscription 
  FROM subscriptions s
  JOIN users u ON u.id = s.user_id
  WHERE u.tenant_id = p_tenant_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_subscription', 'message', 'No active subscription found.');
  END IF;
  
  -- Get tier limits if tier is set, otherwise use legacy email_quota
  IF v_subscription.tier IS NOT NULL THEN
    SELECT * INTO v_tier_limits FROM tier_limits WHERE tier = v_subscription.tier;
    v_email_limit := v_tier_limits.email_limit;
  ELSE
    v_email_limit := COALESCE(v_subscription.email_quota, 10000);
  END IF;
  
  -- Check if unlimited (-1 means unlimited)
  IF v_email_limit = -1 THEN
    RETURN jsonb_build_object('allowed', true, 'unlimited', true);
  END IF;
  
  -- Calculate remaining
  v_remaining := v_email_limit - COALESCE(v_subscription.email_usage, 0);
  
  IF v_remaining >= p_recipient_count THEN
    RETURN jsonb_build_object('allowed', true, 'remaining', v_remaining, 'limit', v_email_limit);
  ELSE
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', 'quota_exceeded',
      'message', format('Email limit reached. You have %s remaining but need %s.', GREATEST(0, v_remaining), p_recipient_count),
      'remaining', GREATEST(0, v_remaining),
      'limit', v_email_limit,
      'overage_needed', p_recipient_count - v_remaining
    );
  END IF;
END;
$$;

-- Create function to get usage stats
CREATE OR REPLACE FUNCTION public.get_usage_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
  v_tier_limits RECORD;
  v_email_limit INTEGER;
  v_sms_limit INTEGER;
  v_email_percent NUMERIC;
  v_sms_percent NUMERIC;
BEGIN
  -- Get subscription
  SELECT * INTO v_subscription 
  FROM subscriptions 
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'No subscription found');
  END IF;
  
  -- Get limits from tier or legacy columns
  IF v_subscription.tier IS NOT NULL THEN
    SELECT * INTO v_tier_limits FROM tier_limits WHERE tier = v_subscription.tier;
    v_email_limit := v_tier_limits.email_limit;
    v_sms_limit := v_tier_limits.sms_limit;
  ELSE
    v_email_limit := COALESCE(v_subscription.email_quota, 10000);
    v_sms_limit := COALESCE(v_subscription.sms_quota, 1000);
  END IF;
  
  -- Calculate percentages (handle unlimited case)
  IF v_email_limit > 0 THEN
    v_email_percent := ROUND((COALESCE(v_subscription.email_usage, 0)::NUMERIC / v_email_limit) * 100, 1);
  ELSE
    v_email_percent := 0;
  END IF;
  
  IF v_sms_limit > 0 THEN
    v_sms_percent := ROUND((COALESCE(v_subscription.sms_usage, 0)::NUMERIC / v_sms_limit) * 100, 1);
  ELSE
    v_sms_percent := 0;
  END IF;
  
  RETURN jsonb_build_object(
    'tier', COALESCE(v_subscription.tier, 'legacy'),
    'is_founding_customer', COALESCE(v_subscription.is_founding_customer, false),
    'email', jsonb_build_object(
      'used', COALESCE(v_subscription.email_usage, 0),
      'limit', v_email_limit,
      'remaining', GREATEST(0, v_email_limit - COALESCE(v_subscription.email_usage, 0)),
      'percent', v_email_percent,
      'unlimited', v_email_limit = -1,
      'overage_this_month', COALESCE(v_subscription.overage_emails_this_month, 0),
      'overage_rate', COALESCE(v_tier_limits.email_overage_rate, 0.002)
    ),
    'sms', jsonb_build_object(
      'used', COALESCE(v_subscription.sms_usage, 0),
      'limit', v_sms_limit,
      'remaining', GREATEST(0, v_sms_limit - COALESCE(v_subscription.sms_usage, 0)),
      'percent', v_sms_percent,
      'unlimited', v_sms_limit = -1,
      'overage_this_month', COALESCE(v_subscription.overage_sms_this_month, 0),
      'overage_rate', COALESCE(v_tier_limits.sms_overage_rate, 0.03)
    ),
    'billing_interval', v_subscription.billing_interval,
    'end_date', v_subscription.end_date,
    'plan', v_subscription.plan
  );
END;
$$;

-- Enable RLS on tier_limits (read-only for all authenticated users)
ALTER TABLE public.tier_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tier_limits" ON public.tier_limits
  FOR SELECT USING (true);