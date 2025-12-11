-- Create warmup_stage_rules table
CREATE TABLE IF NOT EXISTS public.warmup_stage_rules (
  stage INTEGER PRIMARY KEY,
  daily_limit INTEGER NOT NULL,
  required_healthy_days INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Seed warmup stage rules
INSERT INTO public.warmup_stage_rules (stage, daily_limit, required_healthy_days) VALUES
  (0, 50, 3),
  (1, 200, 5),
  (2, 500, 7),
  (3, 2000, 14),
  (4, 999999, 0)
ON CONFLICT (stage) DO UPDATE SET
  daily_limit = EXCLUDED.daily_limit,
  required_healthy_days = EXCLUDED.required_healthy_days;

-- Create domain_send_log table
CREATE TABLE IF NOT EXISTS public.domain_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES public.email_domains(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.crm_campaigns(id) ON DELETE SET NULL,
  emails_sent INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  warmup_stage INTEGER NOT NULL,
  daily_limit_at_send INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_domain_send_log_domain_date 
  ON public.domain_send_log(domain_id, sent_at DESC);

-- Add healthy_days_counter and last_stage_updated_at to email_domains if not exists
ALTER TABLE public.email_domains 
  ADD COLUMN IF NOT EXISTS healthy_days_counter INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_stage_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ADD COLUMN IF NOT EXISTS daily_sent_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_daily_reset_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Enable RLS on new tables
ALTER TABLE public.warmup_stage_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_send_log ENABLE ROW LEVEL SECURITY;

-- Warmup rules are read-only for all authenticated users
CREATE POLICY "Anyone can view warmup rules" ON public.warmup_stage_rules
  FOR SELECT USING (true);

-- Domain send log policies
CREATE POLICY "Tenant users can view domain send logs" ON public.domain_send_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM email_domains d
      JOIN users u ON u.tenant_id = d.tenant_id
      WHERE d.id = domain_send_log.domain_id AND u.id = auth.uid()
    )
  );

CREATE POLICY "System can insert domain send logs" ON public.domain_send_log
  FOR INSERT WITH CHECK (true);

-- Create function to get remaining daily limit for a domain
CREATE OR REPLACE FUNCTION public.get_domain_remaining_limit(p_domain_id UUID)
RETURNS TABLE(
  domain_id UUID,
  warmup_stage INTEGER,
  daily_limit INTEGER,
  daily_sent_count INTEGER,
  remaining_limit INTEGER,
  healthy_days_counter INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id as domain_id,
    d.warmup_stage,
    COALESCE(r.daily_limit, d.daily_limit) as daily_limit,
    COALESCE(d.daily_sent_count, 0) as daily_sent_count,
    GREATEST(0, COALESCE(r.daily_limit, d.daily_limit) - COALESCE(d.daily_sent_count, 0)) as remaining_limit,
    COALESCE(d.healthy_days_counter, 0) as healthy_days_counter
  FROM public.email_domains d
  LEFT JOIN public.warmup_stage_rules r ON r.stage = d.warmup_stage
  WHERE d.id = p_domain_id;
END;
$$;