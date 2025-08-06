-- Add persona support to campaigns and automations

-- Add persona_ids column to crm_campaigns
ALTER TABLE public.crm_campaigns 
ADD COLUMN IF NOT EXISTS persona_ids UUID[] DEFAULT '{}';

-- Add persona_targeting to crm_automations
ALTER TABLE public.crm_automations 
ADD COLUMN IF NOT EXISTS persona_targeting JSONB DEFAULT '{"persona_ids": [], "conditions": []}';

-- Create campaign_personas junction table for many-to-many relationships
CREATE TABLE IF NOT EXISTS public.campaign_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  persona_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(campaign_id, persona_id)
);

-- Enable RLS on campaign_personas
ALTER TABLE public.campaign_personas ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for campaign_personas
CREATE POLICY "Users can manage campaign personas for their tenant campaigns"
ON public.campaign_personas
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM crm_campaigns c
    JOIN users u ON u.tenant_id = c.tenant_id
    WHERE c.id = campaign_personas.campaign_id 
    AND u.id = auth.uid()
  )
);

-- Create automation_personas junction table for many-to-many relationships
CREATE TABLE IF NOT EXISTS public.automation_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL,
  persona_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(automation_id, persona_id)
);

-- Enable RLS on automation_personas
ALTER TABLE public.automation_personas ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for automation_personas
CREATE POLICY "Users can manage automation personas for their tenant automations"
ON public.automation_personas
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM crm_automations a
    JOIN users u ON u.tenant_id = a.tenant_id
    WHERE a.id = automation_personas.automation_id 
    AND u.id = auth.uid()
  )
);

-- Update crm_personas table to ensure proper structure
ALTER TABLE public.crm_personas 
ADD COLUMN IF NOT EXISTS tenant_id UUID,
ADD COLUMN IF NOT EXISTS user_id UUID;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_campaign_personas_campaign_id ON public.campaign_personas(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_personas_persona_id ON public.campaign_personas(persona_id);
CREATE INDEX IF NOT EXISTS idx_automation_personas_automation_id ON public.automation_personas(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_personas_persona_id ON public.automation_personas(persona_id);
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_persona_ids ON public.crm_campaigns USING GIN(persona_ids);
CREATE INDEX IF NOT EXISTS idx_crm_automations_persona_targeting ON public.crm_automations USING GIN(persona_targeting);