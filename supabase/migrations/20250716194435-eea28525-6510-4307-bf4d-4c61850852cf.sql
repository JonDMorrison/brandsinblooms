-- Create customer_timeline table for tracking all customer activities
CREATE TABLE public.customer_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('email_sent', 'sms_sent', 'email_opened', 'email_clicked', 'purchase', 'segment_added', 'tag_added')),
  campaign_id UUID,
  campaign_name TEXT,
  purchase_amount DECIMAL,
  product_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_timeline ENABLE ROW LEVEL SECURITY;

-- Create policy for customer timeline
CREATE POLICY "Users can manage timeline for their tenant customers" 
ON public.customer_timeline 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM crm_customers c
  JOIN users u ON u.tenant_id = c.tenant_id
  WHERE c.id = customer_timeline.customer_id 
  AND u.id = auth.uid()
));

-- Add indexes for performance
CREATE INDEX idx_customer_timeline_customer_id ON public.customer_timeline(customer_id);
CREATE INDEX idx_customer_timeline_activity_type ON public.customer_timeline(activity_type);
CREATE INDEX idx_customer_timeline_created_at ON public.customer_timeline(created_at);

-- Update crm_campaigns to include standardized metrics
ALTER TABLE public.crm_campaigns 
ALTER COLUMN metrics SET DEFAULT '{"sent": 0, "delivered": 0, "opened": 0, "clicked": 0, "bounced": 0, "unsubscribed": 0, "revenue": 0}'::jsonb;

-- Update crm_sms_campaigns to include standardized metrics  
ALTER TABLE public.crm_sms_campaigns 
ALTER COLUMN metrics SET DEFAULT '{"sent": 0, "delivered": 0, "opened": 0, "clicked": 0, "bounced": 0, "unsubscribed": 0, "revenue": 0}'::jsonb;

-- Add additional fields to integration_logs for enhanced sync tracking
ALTER TABLE public.integration_logs ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE public.integration_logs ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.integration_logs ADD COLUMN IF NOT EXISTS can_retry BOOLEAN DEFAULT true;
ALTER TABLE public.integration_logs ADD COLUMN IF NOT EXISTS rollback_available BOOLEAN DEFAULT false;

-- Create trigger for customer_timeline updated_at
CREATE OR REPLACE FUNCTION public.update_customer_timeline_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_timeline_updated_at
BEFORE UPDATE ON public.customer_timeline
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_timeline_updated_at();