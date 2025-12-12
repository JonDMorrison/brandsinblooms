-- Add last_health_evaluated_at column for idempotent daily health evaluation
ALTER TABLE public.twilio_phone_numbers 
ADD COLUMN IF NOT EXISTS last_health_evaluated_at timestamptz;