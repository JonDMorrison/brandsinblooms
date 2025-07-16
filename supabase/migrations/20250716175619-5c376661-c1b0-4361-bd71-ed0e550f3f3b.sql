-- Create crm_automations table for workflow automation
CREATE TABLE public.crm_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id UUID,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('welcome', 'segment_joined', 'purchase_delay', 'seasonal', 'manual')),
  trigger_conditions JSONB DEFAULT '{}'::jsonb,
  workflow_steps JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_automations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage automations for their tenant" 
ON public.crm_automations 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.tenant_id = crm_automations.tenant_id 
  AND u.id = auth.uid()
));

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_crm_automations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_crm_automations_updated_at
BEFORE UPDATE ON public.crm_automations
FOR EACH ROW
EXECUTE FUNCTION public.update_crm_automations_updated_at();