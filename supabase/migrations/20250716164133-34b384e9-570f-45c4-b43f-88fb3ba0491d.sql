-- Create CRM tables for BloomSuite garden center platform

-- CRM Customers table
CREATE TABLE public.crm_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  sms_opt_in BOOLEAN DEFAULT false,
  sms_opt_in_at TIMESTAMP WITH TIME ZONE,
  persona TEXT CHECK (persona IN ('newbie', 'struggler', 'regular', 'expert')),
  tags TEXT[],
  last_purchase_date DATE,
  lifetime_value DECIMAL(10,2),
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, email)
);

-- CRM Segments table
CREATE TABLE public.crm_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB DEFAULT '{}',
  customer_count INTEGER DEFAULT 0,
  auto_update BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- CRM Campaigns table
CREATE TABLE public.crm_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  subject_line TEXT,
  content TEXT,
  segment_id UUID REFERENCES public.crm_segments(id),
  status TEXT CHECK (status IN ('draft', 'scheduled', 'sent')) DEFAULT 'draft',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- CRM Email Sends table for tracking individual deliveries
CREATE TABLE public.crm_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT CHECK (status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained')) DEFAULT 'queued',
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_email_sends ENABLE ROW LEVEL SECURITY;

-- RLS Policies for crm_customers
CREATE POLICY "Users can manage customers for their tenant" 
ON public.crm_customers 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.tenant_id = crm_customers.tenant_id 
    AND u.id = auth.uid()
  )
);

-- RLS Policies for crm_segments
CREATE POLICY "Users can manage segments for their tenant" 
ON public.crm_segments 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.tenant_id = crm_segments.tenant_id 
    AND u.id = auth.uid()
  )
);

-- RLS Policies for crm_campaigns
CREATE POLICY "Users can manage campaigns for their tenant" 
ON public.crm_campaigns 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.tenant_id = crm_campaigns.tenant_id 
    AND u.id = auth.uid()
  )
);

-- RLS Policies for crm_email_sends
CREATE POLICY "Users can view email sends for their campaigns" 
ON public.crm_email_sends 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.crm_campaigns c
    JOIN public.users u ON u.tenant_id = c.tenant_id
    WHERE c.id = crm_email_sends.campaign_id 
    AND u.id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_crm_customers_tenant_id ON public.crm_customers(tenant_id);
CREATE INDEX idx_crm_customers_email ON public.crm_customers(email);
CREATE INDEX idx_crm_customers_persona ON public.crm_customers(persona);
CREATE INDEX idx_crm_segments_tenant_id ON public.crm_segments(tenant_id);
CREATE INDEX idx_crm_campaigns_tenant_id ON public.crm_campaigns(tenant_id);
CREATE INDEX idx_crm_campaigns_segment_id ON public.crm_campaigns(segment_id);
CREATE INDEX idx_crm_email_sends_campaign_id ON public.crm_email_sends(campaign_id);
CREATE INDEX idx_crm_email_sends_customer_id ON public.crm_email_sends(customer_id);

-- Create update triggers
CREATE OR REPLACE FUNCTION public.update_crm_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_crm_segments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_crm_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_crm_customers_updated_at
  BEFORE UPDATE ON public.crm_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crm_customers_updated_at();

CREATE TRIGGER update_crm_segments_updated_at
  BEFORE UPDATE ON public.crm_segments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crm_segments_updated_at();

CREATE TRIGGER update_crm_campaigns_updated_at
  BEFORE UPDATE ON public.crm_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crm_campaigns_updated_at();

-- Update company_profiles to include CRM feature flag
UPDATE public.company_profiles 
SET feature_flags = feature_flags || '{"crm_enabled": false}'::jsonb
WHERE feature_flags IS NOT NULL;