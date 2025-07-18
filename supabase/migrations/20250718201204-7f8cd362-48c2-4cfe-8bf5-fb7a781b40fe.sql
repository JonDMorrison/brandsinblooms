-- Add analytics fields to crm_campaigns table
ALTER TABLE public.crm_campaigns 
ADD COLUMN IF NOT EXISTS total_sent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_opens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS open_rate DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS click_rate DECIMAL(5,2) DEFAULT 0.00;

-- Create email tracking events table for detailed analytics
CREATE TABLE IF NOT EXISTS public.email_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed')),
  event_data JSONB DEFAULT '{}',
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_events_campaign_id ON public.email_tracking_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON public.email_tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_created_at ON public.email_tracking_events(created_at);

-- Enable RLS on email tracking events
ALTER TABLE public.email_tracking_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view events for their campaigns" ON public.email_tracking_events;
DROP POLICY IF EXISTS "System can insert tracking events" ON public.email_tracking_events;

-- Create RLS policy for email tracking events
CREATE POLICY "Users can view events for their campaigns" ON public.email_tracking_events
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.crm_campaigns cc
    JOIN public.users u ON u.tenant_id = cc.tenant_id
    WHERE cc.id = email_tracking_events.campaign_id 
    AND u.id = auth.uid()
  )
);

-- Create policy for inserting tracking events (for webhooks)
CREATE POLICY "System can insert tracking events" ON public.email_tracking_events
FOR INSERT WITH CHECK (true);