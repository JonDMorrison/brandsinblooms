-- Create crm_automation_logs table for tracking automation execution
CREATE TABLE public.crm_automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  step_index INTEGER NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('email', 'sms')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed')) DEFAULT 'queued',
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_automation_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage automation logs for their tenant" 
ON public.crm_automation_logs 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM crm_automations a
  JOIN users u ON u.tenant_id = a.tenant_id
  WHERE a.id = crm_automation_logs.automation_id 
  AND u.id = auth.uid()
));

-- Create indexes for performance
CREATE INDEX idx_automation_logs_automation_id ON public.crm_automation_logs(automation_id);
CREATE INDEX idx_automation_logs_customer_id ON public.crm_automation_logs(customer_id);
CREATE INDEX idx_automation_logs_status ON public.crm_automation_logs(status);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_crm_automation_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_crm_automation_logs_updated_at
BEFORE UPDATE ON public.crm_automation_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_crm_automation_logs_updated_at();