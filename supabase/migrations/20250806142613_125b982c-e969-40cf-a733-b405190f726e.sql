-- Create user_integrations table for storing Twilio credentials
CREATE TABLE IF NOT EXISTS public.user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID,
  integration_type TEXT NOT NULL, -- 'twilio', 'sendgrid', etc.
  credentials JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

-- Create policies for user_integrations
CREATE POLICY "Users can manage integrations for their tenant" 
ON public.user_integrations 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.tenant_id = user_integrations.tenant_id 
  AND u.id = auth.uid()
));

-- Create crm_outbox table for message queue
CREATE TABLE IF NOT EXISTS public.crm_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  automation_id UUID,
  customer_id UUID NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('sms', 'email')),
  recipient TEXT NOT NULL, -- phone or email
  content TEXT NOT NULL,
  subject TEXT, -- for emails
  template_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'sent', 'failed', 'retrying')),
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_outbox ENABLE ROW LEVEL SECURITY;

-- Create policies for crm_outbox
CREATE POLICY "Users can manage outbox for their tenant" 
ON public.crm_outbox 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.tenant_id = crm_outbox.tenant_id 
  AND u.id = auth.uid()
));

-- Create crm_message_logs table for delivery tracking
CREATE TABLE IF NOT EXISTS public.crm_message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id UUID REFERENCES public.crm_outbox(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  message_type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL,
  external_id TEXT, -- Twilio SID, SendGrid message ID, etc.
  delivered_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_message_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for crm_message_logs
CREATE POLICY "Users can view message logs for their tenant" 
ON public.crm_message_logs 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.tenant_id = crm_message_logs.tenant_id 
  AND u.id = auth.uid()
));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_outbox_status_scheduled ON public.crm_outbox(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_crm_outbox_tenant_customer ON public.crm_outbox(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_message_logs_outbox ON public.crm_message_logs(outbox_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_tenant_type ON public.user_integrations(tenant_id, integration_type);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION public.update_user_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_crm_outbox_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_integrations_updated_at
  BEFORE UPDATE ON public.user_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_integrations_updated_at();

CREATE TRIGGER update_crm_outbox_updated_at
  BEFORE UPDATE ON public.crm_outbox
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crm_outbox_updated_at();

-- Create RPC function for creating automation from draft
CREATE OR REPLACE FUNCTION public.create_automation_from_draft(
  draft_id UUID,
  template_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  automation_record RECORD;
  new_automation_id UUID;
  template_timeline JSONB;
BEGIN
  -- Get the draft automation
  SELECT * INTO automation_record
  FROM public.crm_automations
  WHERE id = draft_id
  AND EXISTS (
    SELECT 1 FROM users u 
    WHERE u.tenant_id = crm_automations.tenant_id 
    AND u.id = auth.uid()
  );
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft automation not found or access denied';
  END IF;
  
  -- Generate new automation ID
  new_automation_id := gen_random_uuid();
  
  -- Set default timeline from template if provided
  IF template_key IS NOT NULL THEN
    -- In a real implementation, you'd fetch from campaignTemplates
    -- For now, set a simple default timeline
    template_timeline := jsonb_build_array(
      jsonb_build_object(
        'type', 'sms',
        'delayMin', 5,
        'text', 'Welcome to our loyalty program!'
      )
    );
  ELSE
    template_timeline := automation_record.workflow_steps;
  END IF;
  
  -- Create the new automation
  INSERT INTO public.crm_automations (
    id,
    tenant_id,
    user_id,
    name,
    trigger_type,
    trigger_conditions,
    workflow_steps,
    is_active,
    template_source
  ) VALUES (
    new_automation_id,
    automation_record.tenant_id,
    automation_record.user_id,
    automation_record.name,
    automation_record.trigger_type,
    automation_record.trigger_conditions,
    template_timeline,
    true, -- Activate the automation
    template_key
  );
  
  -- Delete the draft
  DELETE FROM public.crm_automations WHERE id = draft_id;
  
  RETURN new_automation_id;
END;
$$;