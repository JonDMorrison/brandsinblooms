-- Create missing SMS tables and enhance existing ones

-- Create sms_messages table for individual message tracking
CREATE TABLE IF NOT EXISTS public.sms_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.crm_sms_campaigns(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'bounced')) DEFAULT 'queued',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  twilio_sid TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sms_automations table for drip campaigns
CREATE TABLE IF NOT EXISTS public.sms_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT CHECK (trigger_type IN ('signup', 'purchase', 'abandoned_cart', 'birthday', 'manual')) NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  flow JSONB NOT NULL, -- Array of steps: [{ step: 1, delay_hours: 0, message: "Welcome!" }]
  status TEXT CHECK (status IN ('active', 'paused', 'draft')) DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sms_automation_logs table for tracking automation sends
CREATE TABLE IF NOT EXISTS public.sms_automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID REFERENCES public.sms_automations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  message_id UUID REFERENCES public.sms_messages(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('scheduled', 'sent', 'failed', 'skipped')) DEFAULT 'scheduled',
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_automation_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sms_messages
CREATE POLICY "Users can manage SMS messages for their tenant campaigns"
ON public.sms_messages FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.crm_sms_campaigns c
  JOIN public.users u ON u.tenant_id = c.tenant_id
  WHERE c.id = sms_messages.campaign_id AND u.id = auth.uid()
));

-- Create RLS policies for sms_automations
CREATE POLICY "Users can manage SMS automations for their tenant"
ON public.sms_automations FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.users u
  WHERE u.tenant_id = sms_automations.tenant_id AND u.id = auth.uid()
));

-- Create RLS policies for sms_automation_logs
CREATE POLICY "Users can view SMS automation logs for their tenant"
ON public.sms_automation_logs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.sms_automations a
  JOIN public.users u ON u.tenant_id = a.tenant_id
  WHERE a.id = sms_automation_logs.automation_id AND u.id = auth.uid()
));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sms_messages_campaign_id ON public.sms_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_customer_id ON public.sms_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_status ON public.sms_messages(status);
CREATE INDEX IF NOT EXISTS idx_sms_messages_scheduled_at ON public.sms_messages(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_sms_automations_tenant_id ON public.sms_automations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sms_automations_status ON public.sms_automations(status);
CREATE INDEX IF NOT EXISTS idx_sms_automations_trigger_type ON public.sms_automations(trigger_type);

CREATE INDEX IF NOT EXISTS idx_sms_automation_logs_automation_id ON public.sms_automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_sms_automation_logs_customer_id ON public.sms_automation_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_sms_automation_logs_scheduled_at ON public.sms_automation_logs(scheduled_at);

-- Create update triggers
CREATE OR REPLACE FUNCTION public.update_sms_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_sms_automations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sms_messages_updated_at
  BEFORE UPDATE ON public.sms_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sms_messages_updated_at();

CREATE TRIGGER update_sms_automations_updated_at
  BEFORE UPDATE ON public.sms_automations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sms_automations_updated_at();