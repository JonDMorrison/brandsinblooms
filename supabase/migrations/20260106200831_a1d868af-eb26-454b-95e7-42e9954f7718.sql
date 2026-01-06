-- Create sms_demo_sends table to log demo SMS sends
CREATE TABLE public.sms_demo_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone text NOT NULL,
  message text NOT NULL,
  media_url text,
  status text NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'mobile_text_alerts',
  provider_payload jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_demo_sends ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sends
CREATE POLICY "Users can view their own sms_demo_sends"
  ON public.sms_demo_sends
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own sends
CREATE POLICY "Users can insert their own sms_demo_sends"
  ON public.sms_demo_sends
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sends (for status updates)
CREATE POLICY "Users can update their own sms_demo_sends"
  ON public.sms_demo_sends
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create index for rate limiting queries
CREATE INDEX idx_sms_demo_sends_user_created ON public.sms_demo_sends(user_id, created_at DESC);