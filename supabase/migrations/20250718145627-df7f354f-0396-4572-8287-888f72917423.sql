-- Create tables for email tracking
CREATE TABLE IF NOT EXISTS public.email_tracking_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed')),
  event_data JSONB DEFAULT '{}',
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_tracking_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view tracking events for their campaigns"
ON public.email_tracking_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.crm_campaigns cc
    JOIN public.users u ON u.tenant_id = cc.tenant_id
    WHERE cc.id = email_tracking_events.campaign_id
    AND u.id = auth.uid()
  )
);

CREATE POLICY "System can insert tracking events"
ON public.email_tracking_events
FOR INSERT
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_email_tracking_events_campaign_id ON public.email_tracking_events(campaign_id);
CREATE INDEX idx_email_tracking_events_type ON public.email_tracking_events(event_type);
CREATE INDEX idx_email_tracking_events_email ON public.email_tracking_events(customer_email);
CREATE INDEX idx_email_tracking_events_created_at ON public.email_tracking_events(created_at);

-- Create function to update campaign metrics based on tracking events
CREATE OR REPLACE FUNCTION public.update_campaign_metrics_from_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Create trigger to automatically update metrics
CREATE TRIGGER update_campaign_metrics_trigger
  AFTER INSERT ON public.email_tracking_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_campaign_metrics_from_events();

-- Add updated_at trigger
CREATE TRIGGER update_email_tracking_events_updated_at
  BEFORE UPDATE ON public.email_tracking_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();