-- Add new columns to email_domains table for warmup, limits, and reputation tracking
ALTER TABLE public.email_domains 
ADD COLUMN IF NOT EXISTS default_from_name text,
ADD COLUMN IF NOT EXISTS default_from_email text,
ADD COLUMN IF NOT EXISTS warmup_stage integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS warmup_started_at timestamptz,
ADD COLUMN IF NOT EXISTS daily_limit integer DEFAULT 50,
ADD COLUMN IF NOT EXISTS hourly_limit integer DEFAULT 25,
ADD COLUMN IF NOT EXISTS total_sent_30d integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_bounces_30d integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_complaints_30d integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS bounce_rate_30d numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS complaint_rate_30d numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS manual_pause boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS dns_records jsonb;

-- Add unique constraint on tenant_id + domain
ALTER TABLE public.email_domains 
DROP CONSTRAINT IF EXISTS email_domains_tenant_domain_unique;
ALTER TABLE public.email_domains 
ADD CONSTRAINT email_domains_tenant_domain_unique UNIQUE (tenant_id, domain);

-- Create email_domain_usage table for tracking daily/hourly usage
CREATE TABLE IF NOT EXISTS public.email_domain_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_domain_id uuid NOT NULL REFERENCES public.email_domains(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  date date NOT NULL,
  hour integer NOT NULL CHECK (hour >= 0 AND hour < 24),
  emails_sent integer DEFAULT 0,
  bounces integer DEFAULT 0,
  complaints integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (email_domain_id, date, hour)
);

-- Enable RLS on email_domain_usage
ALTER TABLE public.email_domain_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_domain_usage
CREATE POLICY "Users can view their tenant domain usage"
ON public.email_domain_usage FOR SELECT
USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Service role can manage domain usage"
ON public.email_domain_usage FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_email_domain_usage_domain_date ON public.email_domain_usage(email_domain_id, date);
CREATE INDEX IF NOT EXISTS idx_email_domain_usage_tenant_date ON public.email_domain_usage(tenant_id, date);

-- Add from_email_domain_id to crm_campaigns for custom sender selection
ALTER TABLE public.crm_campaigns
ADD COLUMN IF NOT EXISTS from_email_domain_id uuid REFERENCES public.email_domains(id),
ADD COLUMN IF NOT EXISTS send_blocked_reason text;

-- Function to update warmup stage and limits based on days since verification
CREATE OR REPLACE FUNCTION public.update_domain_warmup(p_domain_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_domain record;
  v_days_warming integer;
  v_new_stage integer;
  v_new_daily_limit integer;
  v_new_status text;
BEGIN
  SELECT * INTO v_domain FROM public.email_domains WHERE id = p_domain_id;
  
  IF v_domain IS NULL OR v_domain.status NOT IN ('warming_up', 'active') THEN
    RETURN;
  END IF;
  
  -- Calculate days since warmup started
  v_days_warming := EXTRACT(DAY FROM (now() - COALESCE(v_domain.warmup_started_at, v_domain.created_at)));
  
  -- Determine warmup stage and limits
  IF v_days_warming >= 15 THEN
    v_new_stage := 4;
    v_new_daily_limit := 2000;
    v_new_status := 'active';
  ELSIF v_days_warming >= 8 THEN
    v_new_stage := 3;
    v_new_daily_limit := 500;
    v_new_status := 'warming_up';
  ELSIF v_days_warming >= 4 THEN
    v_new_stage := 2;
    v_new_daily_limit := 150;
    v_new_status := 'warming_up';
  ELSE
    v_new_stage := 1;
    v_new_daily_limit := 50;
    v_new_status := 'warming_up';
  END IF;
  
  -- Check bounce/complaint rates before promoting to active
  IF v_new_status = 'active' AND (v_domain.bounce_rate_30d > 0.05 OR v_domain.complaint_rate_30d > 0.002) THEN
    v_new_status := 'warming_up'; -- Stay in warmup if rates are bad
  END IF;
  
  -- Update domain
  UPDATE public.email_domains
  SET 
    warmup_stage = v_new_stage,
    daily_limit = v_new_daily_limit,
    hourly_limit = GREATEST(v_new_daily_limit / 4, 25),
    status = v_new_status,
    updated_at = now()
  WHERE id = p_domain_id;
END;
$$;

-- Function to check if sending is allowed and get sender details
CREATE OR REPLACE FUNCTION public.check_send_quota(
  p_tenant_id uuid,
  p_domain_id uuid,
  p_recipient_count integer
)
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
        'from_email', COALESCE(v_domain.default_from_email, 'noreply@bloomsuite.email')
      ),
      'limits', jsonb_build_object(
        'daily_limit', v_domain.daily_limit,
        'hourly_limit', v_domain.hourly_limit,
        'daily_used', v_usage_today,
        'hourly_used', v_usage_this_hour
      )
    );
  ELSE
    -- Return fallback sender
    RETURN jsonb_build_object(
      'allowed', true,
      'domain', null,
      'sender', jsonb_build_object(
        'from_name', 'BloomSuite',
        'from_email', 'noreply@bloomsuite.email'
      ),
      'using_fallback', true
    );
  END IF;
END;
$$;

-- Function to record email sending usage
CREATE OR REPLACE FUNCTION public.record_email_usage(
  p_domain_id uuid,
  p_tenant_id uuid,
  p_count integer,
  p_bounces integer DEFAULT 0,
  p_complaints integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.email_domain_usage (
    email_domain_id, tenant_id, date, hour, emails_sent, bounces, complaints
  ) VALUES (
    p_domain_id, p_tenant_id, CURRENT_DATE, EXTRACT(HOUR FROM now())::integer, p_count, p_bounces, p_complaints
  )
  ON CONFLICT (email_domain_id, date, hour) 
  DO UPDATE SET 
    emails_sent = email_domain_usage.emails_sent + p_count,
    bounces = email_domain_usage.bounces + p_bounces,
    complaints = email_domain_usage.complaints + p_complaints,
    updated_at = now();
    
  -- Update 30-day rolling stats on domain
  IF p_domain_id IS NOT NULL THEN
    UPDATE public.email_domains
    SET 
      total_sent_30d = COALESCE(total_sent_30d, 0) + p_count,
      total_bounces_30d = COALESCE(total_bounces_30d, 0) + p_bounces,
      total_complaints_30d = COALESCE(total_complaints_30d, 0) + p_complaints,
      bounce_rate_30d = CASE 
        WHEN COALESCE(total_sent_30d, 0) + p_count > 0 
        THEN (COALESCE(total_bounces_30d, 0) + p_bounces)::numeric / (COALESCE(total_sent_30d, 0) + p_count)
        ELSE 0
      END,
      complaint_rate_30d = CASE 
        WHEN COALESCE(total_sent_30d, 0) + p_count > 0 
        THEN (COALESCE(total_complaints_30d, 0) + p_complaints)::numeric / (COALESCE(total_sent_30d, 0) + p_count)
        ELSE 0
      END,
      updated_at = now()
    WHERE id = p_domain_id;
  END IF;
END;
$$;

-- Function to auto-pause domain if reputation degrades
CREATE OR REPLACE FUNCTION public.check_domain_reputation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Auto-pause if bounce rate exceeds 8% or complaint rate exceeds 0.5%
  IF NEW.bounce_rate_30d > 0.08 OR NEW.complaint_rate_30d > 0.005 THEN
    NEW.status := 'paused';
    NEW.notes := COALESCE(NEW.notes, '') || 
      format(E'\n[%s] Auto-paused due to reputation issues. Bounce: %s%%, Complaints: %s%%', 
        now()::date, 
        round(NEW.bounce_rate_30d * 100, 2), 
        round(NEW.complaint_rate_30d * 100, 3));
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for reputation monitoring
DROP TRIGGER IF EXISTS trigger_check_domain_reputation ON public.email_domains;
CREATE TRIGGER trigger_check_domain_reputation
BEFORE UPDATE ON public.email_domains
FOR EACH ROW
WHEN (NEW.bounce_rate_30d IS DISTINCT FROM OLD.bounce_rate_30d OR 
      NEW.complaint_rate_30d IS DISTINCT FROM OLD.complaint_rate_30d)
EXECUTE FUNCTION public.check_domain_reputation();

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_email_domain_usage_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_email_domain_usage_updated_at ON public.email_domain_usage;
CREATE TRIGGER trigger_email_domain_usage_updated_at
BEFORE UPDATE ON public.email_domain_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_email_domain_usage_updated_at();