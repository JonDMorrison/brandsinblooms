-- Create crm_personas table for customer personas
CREATE TABLE public.crm_personas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  persona_name TEXT NOT NULL,
  persona_description TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Prevent duplicate persona names per tenant
  UNIQUE(tenant_id, persona_name)
);

-- Enable RLS
ALTER TABLE public.crm_personas ENABLE ROW LEVEL SECURITY;

-- Create policies for persona access
CREATE POLICY "Users can manage personas for their tenant"
ON public.crm_personas
FOR ALL
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.tenant_id = crm_personas.tenant_id 
  AND u.id = auth.uid()
));

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_crm_personas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_crm_personas_updated_at
BEFORE UPDATE ON public.crm_personas
FOR EACH ROW
EXECUTE FUNCTION public.update_crm_personas_updated_at();