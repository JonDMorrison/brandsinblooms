-- Set high fixed daily limit (5000) for all email domains, removing warmup restrictions
UPDATE email_domains
SET 
  daily_limit = 5000,
  hourly_limit = 1000,
  warmup_stage = 4,
  status = CASE WHEN status = 'warming_up' THEN 'active' ELSE status END
WHERE daily_limit < 5000;

-- Update the check_send_quota function to use high default limits and skip warmup blocking
CREATE OR REPLACE FUNCTION public.check_send_quota(
  p_tenant_id uuid,
  p_domain_id uuid DEFAULT NULL,
  p_recipient_count integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain record;
  v_tenant record;
  v_usage_today integer;
  v_usage_this_hour integer;
  v_high_daily_limit integer := 5000;
  v_high_hourly_limit integer := 1000;
BEGIN
  -- Get tenant info
  SELECT * INTO v_tenant FROM tenants WHERE id = p_tenant_id;
  
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'tenant_not_found',
      'message', 'Tenant not found'
    );
  END IF;

  -- If no domain specified, allow with fallback sender
  IF p_domain_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'domain', null,
      'sender', jsonb_build_object(
        'from_name', COALESCE(v_tenant.fallback_from_name, 'BloomSuite'),
        'from_email', COALESCE(v_tenant.fallback_sender_email, 'noreply@bloomsuite.app')
      ),
      'using_fallback', true,
      'fallback_type', 'no_domain_specified',
      'limits', jsonb_build_object(
        'daily_limit', v_high_daily_limit,
        'daily_used', 0
      )
    );
  END IF;

  -- Get domain info
  SELECT * INTO v_domain FROM email_domains WHERE id = p_domain_id AND tenant_id = p_tenant_id;
  
  IF v_domain IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'domain', null,
      'sender', jsonb_build_object(
        'from_name', COALESCE(v_tenant.fallback_from_name, 'BloomSuite'),
        'from_email', COALESCE(v_tenant.fallback_sender_email, 'noreply@bloomsuite.app')
      ),
      'using_fallback', true,
      'fallback_type', 'domain_not_found',
      'limits', jsonb_build_object(
        'daily_limit', v_high_daily_limit,
        'daily_used', 0
      )
    );
  END IF;

  -- Check if domain is active
  IF v_domain.status NOT IN ('active', 'warming_up') THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'domain', null,
      'sender', jsonb_build_object(
        'from_name', COALESCE(v_tenant.fallback_from_name, 'BloomSuite'),
        'from_email', COALESCE(v_tenant.fallback_sender_email, 'noreply@bloomsuite.app')
      ),
      'using_fallback', true,
      'fallback_type', 'domain_not_active',
      'reason', 'domain_status_' || v_domain.status,
      'limits', jsonb_build_object(
        'daily_limit', v_high_daily_limit,
        'daily_used', 0
      )
    );
  END IF;

  -- Get today's usage from domain_send_log
  SELECT COALESCE(SUM(emails_sent), 0) INTO v_usage_today
  FROM domain_send_log
  WHERE domain_id = p_domain_id
    AND created_at >= CURRENT_DATE;

  -- Get this hour's usage
  SELECT COALESCE(SUM(emails_sent), 0) INTO v_usage_this_hour
  FROM domain_send_log
  WHERE domain_id = p_domain_id
    AND created_at >= date_trunc('hour', now());

  -- Use high limits (5000/day, 1000/hour) - no truncation
  -- Only warn, don't block
  RETURN jsonb_build_object(
    'allowed', true,
    'domain', jsonb_build_object(
      'id', v_domain.id,
      'domain', v_domain.domain,
      'status', v_domain.status,
      'warmup_stage', COALESCE(v_domain.warmup_stage, 4)
    ),
    'sender', jsonb_build_object(
      'from_name', v_domain.default_from_name,
      'from_email', v_domain.default_from_email
    ),
    'using_fallback', false,
    'limits', jsonb_build_object(
      'daily_limit', v_high_daily_limit,
      'hourly_limit', v_high_hourly_limit,
      'daily_used', v_usage_today,
      'hourly_used', v_usage_this_hour
    )
  );
END;
$$;