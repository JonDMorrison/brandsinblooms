-- Fix check_send_quota to use constructed email when default_from_email is NULL
CREATE OR REPLACE FUNCTION public.check_send_quota(p_tenant_id uuid, p_domain_id uuid DEFAULT NULL::uuid, p_recipient_count integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_domain record;
  v_tenant record;
  v_subscription record;
  v_usage_today integer;
  v_usage_this_hour integer;
  v_from_email text;
BEGIN
  -- Get tenant info including fallback email
  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  
  -- Get domain if specified
  IF p_domain_id IS NOT NULL THEN
    SELECT * INTO v_domain FROM public.email_domains WHERE id = p_domain_id AND tenant_id = p_tenant_id;
    
    IF v_domain IS NULL THEN
      -- Domain not found, fall back to tenant fallback
      RETURN jsonb_build_object(
        'allowed', true,
        'domain', null,
        'sender', jsonb_build_object(
          'from_name', COALESCE(v_tenant.fallback_from_name, 'BloomSuite'),
          'from_email', COALESCE(v_tenant.fallback_sender_email, 'noreply@bloomsuite.app')
        ),
        'using_fallback', true,
        'fallback_type', CASE 
          WHEN v_tenant.fallback_sender_email IS NOT NULL THEN 'tenant_platform'
          ELSE 'generic_platform'
        END
      );
    END IF;
    
    -- Check domain status
    IF v_domain.status IN ('pending_dns', 'verifying', 'failed', 'blocked') THEN
      -- Domain not ready, use fallback
      RETURN jsonb_build_object(
        'allowed', true,
        'domain', null,
        'sender', jsonb_build_object(
          'from_name', COALESCE(v_tenant.fallback_from_name, 'BloomSuite'),
          'from_email', COALESCE(v_tenant.fallback_sender_email, 'noreply@bloomsuite.app')
        ),
        'using_fallback', true,
        'fallback_type', CASE 
          WHEN v_tenant.fallback_sender_email IS NOT NULL THEN 'tenant_platform'
          ELSE 'generic_platform'
        END,
        'reason', 'domain_not_verified'
      );
    END IF;
    
    IF v_domain.manual_pause THEN
      -- Domain paused, use fallback
      RETURN jsonb_build_object(
        'allowed', true,
        'domain', null,
        'sender', jsonb_build_object(
          'from_name', COALESCE(v_tenant.fallback_from_name, 'BloomSuite'),
          'from_email', COALESCE(v_tenant.fallback_sender_email, 'noreply@bloomsuite.app')
        ),
        'using_fallback', true,
        'fallback_type', CASE 
          WHEN v_tenant.fallback_sender_email IS NOT NULL THEN 'tenant_platform'
          ELSE 'generic_platform'
        END,
        'reason', 'domain_paused'
      );
    END IF;
    
    -- Update warmup if needed
    PERFORM public.update_domain_warmup(p_domain_id);
    SELECT * INTO v_domain FROM public.email_domains WHERE id = p_domain_id;
    
    -- Check bounce/complaint rates - if too high, use fallback instead of blocking
    IF v_domain.bounce_rate_30d > 0.05 OR v_domain.complaint_rate_30d > 0.002 THEN
      RETURN jsonb_build_object(
        'allowed', true,
        'domain', null,
        'sender', jsonb_build_object(
          'from_name', COALESCE(v_tenant.fallback_from_name, 'BloomSuite'),
          'from_email', COALESCE(v_tenant.fallback_sender_email, 'noreply@bloomsuite.app')
        ),
        'using_fallback', true,
        'fallback_type', CASE 
          WHEN v_tenant.fallback_sender_email IS NOT NULL THEN 'tenant_platform'
          ELSE 'generic_platform'
        END,
        'reason', 'reputation_issue'
      );
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
    
    -- Check daily limit - if exceeded, use fallback
    IF v_usage_today + p_recipient_count > v_domain.daily_limit THEN
      RETURN jsonb_build_object(
        'allowed', true,
        'domain', null,
        'sender', jsonb_build_object(
          'from_name', COALESCE(v_tenant.fallback_from_name, 'BloomSuite'),
          'from_email', COALESCE(v_tenant.fallback_sender_email, 'noreply@bloomsuite.app')
        ),
        'using_fallback', true,
        'fallback_type', CASE 
          WHEN v_tenant.fallback_sender_email IS NOT NULL THEN 'tenant_platform'
          ELSE 'generic_platform'
        END,
        'reason', 'daily_limit_exceeded',
        'limits', jsonb_build_object(
          'daily_limit', v_domain.daily_limit,
          'daily_used', v_usage_today
        )
      );
    END IF;
    
    -- Check hourly limit - if exceeded, use fallback
    IF v_usage_this_hour + p_recipient_count > v_domain.hourly_limit THEN
      RETURN jsonb_build_object(
        'allowed', true,
        'domain', null,
        'sender', jsonb_build_object(
          'from_name', COALESCE(v_tenant.fallback_from_name, 'BloomSuite'),
          'from_email', COALESCE(v_tenant.fallback_sender_email, 'noreply@bloomsuite.app')
        ),
        'using_fallback', true,
        'fallback_type', CASE 
          WHEN v_tenant.fallback_sender_email IS NOT NULL THEN 'tenant_platform'
          ELSE 'generic_platform'
        END,
        'reason', 'hourly_limit_exceeded',
        'limits', jsonb_build_object(
          'hourly_limit', v_domain.hourly_limit,
          'hourly_used', v_usage_this_hour
        )
      );
    END IF;
  ELSE
    -- No domain specified, try to find an active one
    SELECT * INTO v_domain 
    FROM public.email_domains 
    WHERE tenant_id = p_tenant_id 
    AND status IN ('warming_up', 'active')
    AND manual_pause = false
    AND bounce_rate_30d <= 0.05
    AND complaint_rate_30d <= 0.002
    ORDER BY is_entri_managed DESC, created_at DESC
    LIMIT 1;
  END IF;
  
  -- Get subscription and check monthly quota (optional)
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
  
  -- All checks passed - determine which sender to use
  -- FIX: Use the domain if it exists, constructing email from domain name if default_from_email is NULL
  IF v_domain IS NOT NULL THEN
    -- Construct the from_email: use default_from_email if set, otherwise mail@domain
    v_from_email := COALESCE(v_domain.default_from_email, 'mail@' || v_domain.domain);
    
    -- Get fresh usage counts for valid domain
    IF v_usage_today IS NULL THEN
      SELECT COALESCE(SUM(emails_sent), 0) INTO v_usage_today
      FROM public.email_domain_usage
      WHERE email_domain_id = v_domain.id AND date = CURRENT_DATE;
    END IF;
    
    IF v_usage_this_hour IS NULL THEN
      SELECT COALESCE(SUM(emails_sent), 0) INTO v_usage_this_hour
      FROM public.email_domain_usage
      WHERE email_domain_id = v_domain.id 
      AND date = CURRENT_DATE 
      AND hour = EXTRACT(HOUR FROM now());
    END IF;
    
    -- Use verified custom domain
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
        'from_email', v_from_email
      ),
      'limits', jsonb_build_object(
        'daily_limit', v_domain.daily_limit,
        'hourly_limit', v_domain.hourly_limit,
        'daily_used', COALESCE(v_usage_today, 0),
        'hourly_used', COALESCE(v_usage_this_hour, 0)
      ),
      'using_fallback', false
    );
  ELSE
    -- No valid domain, use tenant fallback or generic
    RETURN jsonb_build_object(
      'allowed', true,
      'domain', null,
      'sender', jsonb_build_object(
        'from_name', COALESCE(v_tenant.fallback_from_name, 'BloomSuite'),
        'from_email', COALESCE(v_tenant.fallback_sender_email, 'noreply@bloomsuite.app')
      ),
      'using_fallback', true,
      'fallback_type', CASE 
        WHEN v_tenant.fallback_sender_email IS NOT NULL THEN 'tenant_platform'
        ELSE 'generic_platform'
      END
    );
  END IF;
END;
$function$;