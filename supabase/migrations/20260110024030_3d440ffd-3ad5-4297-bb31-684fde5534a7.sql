-- ============================================================
-- Remove Email Domain Warmup System
-- Domains now go directly to 'active' with full limits (2000/day)
-- Bounce/complaint safety checks are retained
-- ============================================================

-- Drop the old update_domain_warmup function and replace with simplified version
CREATE OR REPLACE FUNCTION public.update_domain_warmup(p_domain_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_domain record;
BEGIN
  SELECT * INTO v_domain FROM public.email_domains WHERE id = p_domain_id;
  
  -- Only process warming_up or active domains
  IF v_domain IS NULL OR v_domain.status NOT IN ('warming_up', 'active') THEN
    RETURN;
  END IF;
  
  -- All warming_up domains should now be active with full limits
  -- Only keep warming_up if bounce/complaint rates are bad
  IF v_domain.status = 'warming_up' THEN
    IF v_domain.bounce_rate_30d > 0.05 OR v_domain.complaint_rate_30d > 0.002 THEN
      -- Bad reputation - keep current limits but stay in warmup
      RETURN;
    END IF;
    
    -- Good reputation - promote to active with full limits
    UPDATE public.email_domains
    SET 
      warmup_stage = 4,
      daily_limit = 2000,
      hourly_limit = 500,
      status = 'active',
      updated_at = now()
    WHERE id = p_domain_id;
  END IF;
END;
$$;

-- Update existing warming_up domains to active (one-time migration)
-- Only promote those with healthy bounce/complaint rates
UPDATE public.email_domains
SET 
  warmup_stage = 4,
  daily_limit = 2000,
  hourly_limit = 500,
  status = 'active',
  updated_at = now()
WHERE 
  status = 'warming_up'
  AND (bounce_rate_30d <= 0.05 OR bounce_rate_30d IS NULL)
  AND (complaint_rate_30d <= 0.002 OR complaint_rate_30d IS NULL);

-- Update check_send_quota to use simplified limits
-- The function should still check bounce/complaint rates for safety
CREATE OR REPLACE FUNCTION public.check_send_quota(
  p_tenant_id uuid,
  p_domain_id uuid DEFAULT NULL,
  p_recipient_count integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_domain record;
  v_usage_today integer;
  v_usage_this_hour integer;
BEGIN
  -- If no domain specified, try to find one
  IF p_domain_id IS NULL THEN
    SELECT * INTO v_domain
    FROM public.email_domains
    WHERE tenant_id = p_tenant_id
    AND status = 'active'
    AND manual_pause = false
    ORDER BY is_entri_managed DESC, created_at DESC
    LIMIT 1;
    
    IF v_domain IS NULL THEN
      -- Fall back to warming_up domains
      SELECT * INTO v_domain
      FROM public.email_domains
      WHERE tenant_id = p_tenant_id
      AND status = 'warming_up'
      AND manual_pause = false
      ORDER BY is_entri_managed DESC, created_at DESC
      LIMIT 1;
    END IF;
    
    IF v_domain IS NULL THEN
      -- No domain found - use fallback
      RETURN jsonb_build_object(
        'allowed', true,
        'using_fallback', true,
        'message', 'Using shared sending domain'
      );
    END IF;
    
    p_domain_id := v_domain.id;
  ELSE
    SELECT * INTO v_domain FROM public.email_domains WHERE id = p_domain_id;
  END IF;
  
  IF v_domain IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'domain_not_found', 'message', 'Domain not found.');
  END IF;
  
  IF v_domain.manual_pause THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'domain_paused', 'message', 'Domain is manually paused.');
  END IF;
  
  IF v_domain.status NOT IN ('warming_up', 'active') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'domain_not_ready', 'message', 'Domain is not ready for sending.');
  END IF;
  
  -- Check bounce/complaint rates (safety check retained)
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
      'reason', 'daily_limit_reached',
      'message', format('Daily sending limit of %s emails reached.', v_domain.daily_limit),
      'limits', jsonb_build_object(
        'daily_limit', v_domain.daily_limit,
        'daily_used', v_usage_today,
        'requested', p_recipient_count
      )
    );
  END IF;
  
  -- Check hourly limit
  IF v_usage_this_hour + p_recipient_count > v_domain.hourly_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'hourly_limit_reached',
      'message', format('Hourly sending limit of %s emails reached. Try again in the next hour.', v_domain.hourly_limit),
      'limits', jsonb_build_object(
        'hourly_limit', v_domain.hourly_limit,
        'hourly_used', v_usage_this_hour,
        'requested', p_recipient_count
      )
    );
  END IF;
  
  -- All checks passed
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
      'from_email', COALESCE(v_domain.default_from_email, 'noreply@' || v_domain.domain)
    ),
    'limits', jsonb_build_object(
      'daily_limit', v_domain.daily_limit,
      'hourly_limit', v_domain.hourly_limit,
      'daily_used', v_usage_today,
      'hourly_used', v_usage_this_hour
    ),
    'using_fallback', false
  );
END;
$$;