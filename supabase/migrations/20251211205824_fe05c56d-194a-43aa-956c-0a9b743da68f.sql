-- SMS Warmup Foundation Migration
-- Adds warmup tracking to SMS sending identities

-- 1. Add warmup columns to twilio_phone_numbers (idempotent)
ALTER TABLE public.twilio_phone_numbers
  ADD COLUMN IF NOT EXISTS messaging_service_sid TEXT,
  ADD COLUMN IF NOT EXISTS warmup_stage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_limit INTEGER,
  ADD COLUMN IF NOT EXISTS daily_sent_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS healthy_days_counter INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_stage_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_rate_30d NUMERIC,
  ADD COLUMN IF NOT EXISTS bounce_rate_30d NUMERIC;

-- Add index for efficient lookups by messaging_service_sid
CREATE INDEX IF NOT EXISTS idx_twilio_phone_numbers_messaging_service_sid 
  ON public.twilio_phone_numbers(messaging_service_sid) 
  WHERE messaging_service_sid IS NOT NULL;

-- 2. Create SMS warmup stage rules table
CREATE TABLE IF NOT EXISTS public.sms_warmup_stage_rules (
  stage INTEGER PRIMARY KEY,
  daily_limit INTEGER NOT NULL,
  required_healthy_days INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed SMS warmup stage rules (idempotent)
INSERT INTO public.sms_warmup_stage_rules (stage, daily_limit, required_healthy_days) VALUES
  (0, 50, 3),
  (1, 200, 5),
  (2, 500, 7),
  (3, 2000, 14),
  (4, 1000000, 0)
ON CONFLICT (stage) DO UPDATE SET
  daily_limit = EXCLUDED.daily_limit,
  required_healthy_days = EXCLUDED.required_healthy_days;

-- Enable RLS on sms_warmup_stage_rules
ALTER TABLE public.sms_warmup_stage_rules ENABLE ROW LEVEL SECURITY;

-- Read-only policy for all users (rules are global reference data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sms_warmup_stage_rules' 
    AND policyname = 'Anyone can view SMS warmup rules'
  ) THEN
    CREATE POLICY "Anyone can view SMS warmup rules" 
      ON public.sms_warmup_stage_rules
      FOR SELECT USING (true);
  END IF;
END $$;

-- 3. Create SQL helper function to get SMS warmup info
CREATE OR REPLACE FUNCTION public.get_sms_warmup_info(
  p_phone_number TEXT DEFAULT NULL,
  p_messaging_service_sid TEXT DEFAULT NULL
)
RETURNS TABLE(
  sending_identity_id UUID,
  phone_number TEXT,
  messaging_service_sid TEXT,
  warmup_stage INTEGER,
  daily_limit INTEGER,
  daily_sent_count INTEGER,
  remaining_today INTEGER,
  healthy_days_counter INTEGER,
  last_stage_updated_at TIMESTAMPTZ,
  last_reset_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as sending_identity_id,
    t.phone_number,
    t.messaging_service_sid,
    t.warmup_stage,
    COALESCE(r.daily_limit, t.daily_limit, 50) as daily_limit,
    COALESCE(t.daily_sent_count, 0) as daily_sent_count,
    GREATEST(0, COALESCE(r.daily_limit, t.daily_limit, 50) - COALESCE(t.daily_sent_count, 0)) as remaining_today,
    COALESCE(t.healthy_days_counter, 0) as healthy_days_counter,
    t.last_stage_updated_at,
    t.last_reset_at
  FROM public.twilio_phone_numbers t
  LEFT JOIN public.sms_warmup_stage_rules r ON r.stage = t.warmup_stage
  WHERE 
    (p_phone_number IS NOT NULL AND t.phone_number = p_phone_number)
    OR (p_messaging_service_sid IS NOT NULL AND t.messaging_service_sid = p_messaging_service_sid);
END;
$$;