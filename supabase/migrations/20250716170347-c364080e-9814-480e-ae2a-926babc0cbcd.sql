-- Create SMS campaigns table
CREATE TABLE public.crm_sms_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID,
  user_id UUID,
  segment_id UUID REFERENCES public.crm_segments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  metrics JSONB DEFAULT '{"messages_sent": 0, "delivered": 0, "failed": 0, "opt_outs": 0}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_sms_campaigns ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage SMS campaigns for their tenant" 
ON public.crm_sms_campaigns 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.tenant_id = crm_sms_campaigns.tenant_id 
  AND u.id = auth.uid()
));

-- Create indexes
CREATE INDEX idx_crm_sms_campaigns_tenant_id ON public.crm_sms_campaigns(tenant_id);
CREATE INDEX idx_crm_sms_campaigns_segment_id ON public.crm_sms_campaigns(segment_id);
CREATE INDEX idx_crm_sms_campaigns_status ON public.crm_sms_campaigns(status);

-- Create update trigger
CREATE OR REPLACE FUNCTION public.update_crm_sms_campaigns_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_crm_sms_campaigns_updated_at
BEFORE UPDATE ON public.crm_sms_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_crm_sms_campaigns_updated_at();