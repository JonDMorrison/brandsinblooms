CREATE OR REPLACE FUNCTION public.check_send_quota(p_tenant_id uuid, p_domain_id uuid DEFAULT NULL, p_recipient_count integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_domain record;
  v_subscription record;
  v_usage_today integer;
  v_usage_this_hour integer;
  v_result jsonb;
BEGIN
  -- Get domain if specified
  IF p_domain_id IS NOT NULL THEN
    SELECT * INTO v_domain FROM public.email_domains WHERE id = p_domain_id AND tenant_id = p_tenant_id;
    
    IF v_domain IS NULL THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'domain_not_found', 'message', 'Specified domain not found');
    END IF;
    
    -- Check domain status
    IF v_domain.status IN ('pending_dns', 'verifying', 'failed', 'blocked') THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'domain_not_verified', 'message', 'Domain is not verified yet');
    END IF;
    
    IF v_domain.manual_pause THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'domain_paused', 'message', 'Domain sending is manually paused');
    END IF;
    
    -- Update warmup if needed
    PERFORM public.update_domain_warmup(p_domain_id);
    SELECT * INTO v_domain FROM public.email_domains WHERE id = p_domain_id;
    
    -- Check bounce/complaint rates
    IF v_domain.bounce_rate_30d > 0.05 THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'bounce_rate_too_high', 'message', 'Bounce rate exceeds 5%. Domain sending is restricted.');
    END IF;
    
    IF v_domain.complaint_rate_30d > 0.002 THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'complaint_rate_too_high', 'message', 'Spam complaint rate exceeds 0.2%. Domain sending is restricted.');
    END IF;
    
    -- Get today's usage
    SELECT COALESCE(SUM(emails_sent), 0) INTO v_usage_today
    FROM public.email_domain_usage
    WHERE email_domain_id = p_domain_id AND date = CURRENT_DATE;
    
    -- Get this hour's usage
    SELECT COALESCE(SUM(emails_sent), 0) INTO v_usage_this_hour
    FROM public.email_domain_usage
    WHERE email_domain_id = p_domain_id 
    AND date = CURRENT_DATE 
    AND hour = EXTRACT(HOUR FROM now());
    
    -- Check daily limit
    IF v_usage_today + p_recipient_count > v_domain.daily_limit THEN
      RETURN jsonb_build_object(
        'allowed', false, 
        'reason', 'daily_limit_exceeded', 
        'message', format('Daily sending limit (%s) would be exceeded. Used: %s, Requested: %s', 
          v_domain.daily_limit, v_usage_today, p_recipient_count),
        'current_usage', v_usage_today,
        'limit', v_domain.daily_limit
      );
    END IF;
    
    -- Check hourly limit
    IF v_usage_this_hour + p_recipient_count > v_domain.hourly_limit THEN
      RETURN jsonb_build_object(
        'allowed', false, 
        'reason', 'hourly_limit_exceeded', 
        'message', format('Hourly sending limit (%s) would be exceeded. Used: %s, Requested: %s', 
          v_domain.hourly_limit, v_usage_this_hour, p_recipient_count),
        'current_usage', v_usage_this_hour,
        'limit', v_domain.hourly_limit
      );
    END IF;
  END IF;
  
  -- Get subscription and check monthly quota
  SELECT s.* INTO v_subscription
  FROM public.subscriptions s
  JOIN public.users u ON u.id = s.user_id
  WHERE u.tenant_id = p_tenant_id
  LIMIT 1;
  
  IF v_subscription IS NOT NULL AND v_subscription.email_quota IS NOT NULL THEN
    IF COALESCE(v_subscription.email_usage, 0) + p_recipient_count > v_subscription.email_quota THEN
      RETURN jsonb_build_object(
        'allowed', false, 
        'reason', 'monthly_quota_exceeded', 
        'message', format('Monthly email quota (%s) would be exceeded. Used: %s, Requested: %s', 
          v_subscription.email_quota, COALESCE(v_subscription.email_usage, 0), p_recipient_count)
      );
    END IF;
  END IF;
  
  -- All checks passed
  IF v_domain IS NOT NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'domain', jsonb_build_object(
        'id', v_domain.id,
        'domain', v_domain.domain,
        'status', v_domain.status,
        'warmup_stage', v_domain.warmup_stage
      ),
      'sender', jsonb_build_object(
        'from_name', COALESCE(v_domain.default_from_name, 'BloomSuite'),
        'from_email', COALESCE(v_domain.default_from_email, 'noreply@bloomsuite.app')
      ),
      'limits', jsonb_build_object(
        'daily_limit', v_domain.daily_limit,
        'hourly_limit', v_domain.hourly_limit,
        'daily_used', v_usage_today,
        'hourly_used', v_usage_this_hour
      )
    );
  ELSE
    -- Return fallback sender using verified domain
    RETURN jsonb_build_object(
      'allowed', true,
      'domain', null,
      'sender', jsonb_build_object(
        'from_name', 'BloomSuite',
        'from_email', 'noreply@bloomsuite.app'
      ),
      'using_fallback', true
    );
  END IF;
END;
$$;