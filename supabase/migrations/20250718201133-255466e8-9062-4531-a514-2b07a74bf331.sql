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

-- Function to update campaign metrics from events
CREATE OR REPLACE FUNCTION public.update_campaign_metrics_from_events()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the campaign metrics in real-time
  UPDATE public.crm_campaigns 
  SET metrics = (
    SELECT jsonb_build_object(
      'sent', COALESCE((SELECT COUNT(*) FROM public.email_tracking_events WHERE campaign_id = NEW.campaign_id AND event_type = 'sent'), 0),
      'delivered', COALESCE((SELECT COUNT(*) FROM public.email_tracking_events WHERE campaign_id = NEW.campaign_id AND event_type = 'delivered'), 0),
      'opened', COALESCE((SELECT COUNT(DISTINCT customer_email) FROM public.email_tracking_events WHERE campaign_id = NEW.campaign_id AND event_type = 'opened'), 0),
      'clicked', COALESCE((SELECT COUNT(DISTINCT customer_email) FROM public.email_tracking_events WHERE campaign_id = NEW.campaign_id AND event_type = 'clicked'), 0),
      'bounced', COALESCE((SELECT COUNT(*) FROM public.email_tracking_events WHERE campaign_id = NEW.campaign_id AND event_type = 'bounced'), 0),
      'unsubscribed', COALESCE((SELECT COUNT(*) FROM public.email_tracking_events WHERE campaign_id = NEW.campaign_id AND event_type = 'unsubscribed'), 0),
      'revenue', COALESCE((metrics->>'revenue')::numeric, 0)
    )
  )
  WHERE id = NEW.campaign_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update metrics when events are inserted
DROP TRIGGER IF EXISTS update_campaign_metrics_trigger ON public.email_tracking_events;
CREATE TRIGGER update_campaign_metrics_trigger
  AFTER INSERT ON public.email_tracking_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_campaign_metrics_from_events();