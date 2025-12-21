-- Step 1: Add missing SMS metrics columns
ALTER TABLE public.customer_sms_metrics 
  ADD COLUMN IF NOT EXISTS total_opt_outs INTEGER DEFAULT 0;

ALTER TABLE public.customer_sms_metrics 
  ADD COLUMN IF NOT EXISTS opt_out_rate NUMERIC DEFAULT 0;

ALTER TABLE public.customer_sms_metrics 
  ADD COLUMN IF NOT EXISTS avg_time_to_response_minutes NUMERIC;

ALTER TABLE public.customer_sms_metrics 
  ADD COLUMN IF NOT EXISTS last_opt_out_at TIMESTAMPTZ;

ALTER TABLE public.customer_sms_metrics 
  ADD COLUMN IF NOT EXISTS engagement_score NUMERIC DEFAULT 0;