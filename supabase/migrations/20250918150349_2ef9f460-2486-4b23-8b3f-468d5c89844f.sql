-- Create junction table for customer-persona relationships (many-to-many)
CREATE TABLE public.customer_personas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  persona_id UUID NOT NULL REFERENCES public.crm_personas(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id, persona_id)
);

-- Enable RLS
ALTER TABLE public.customer_personas ENABLE ROW LEVEL SECURITY;

-- Create policies for customer_personas
CREATE POLICY "Users can manage customer personas for their tenant"
ON public.customer_personas
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.crm_customers c
    JOIN public.users u ON u.tenant_id = c.tenant_id
    WHERE c.id = customer_personas.customer_id 
    AND u.id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_customer_personas_updated_at
  BEFORE UPDATE ON public.customer_personas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add support for predefined personas (non-UUID IDs)
ALTER TABLE public.customer_personas 
ADD COLUMN predefined_persona_id TEXT;

-- Allow either persona_id (UUID for custom) or predefined_persona_id (text for predefined)
ALTER TABLE public.customer_personas 
DROP CONSTRAINT customer_personas_persona_id_fkey;

-- Make persona_id nullable since we now support predefined personas too
ALTER TABLE public.customer_personas 
ALTER COLUMN persona_id DROP NOT NULL;

-- Add check constraint to ensure exactly one persona type is specified
ALTER TABLE public.customer_personas 
ADD CONSTRAINT check_exactly_one_persona_type 
CHECK (
  (persona_id IS NOT NULL AND predefined_persona_id IS NULL) OR
  (persona_id IS NULL AND predefined_persona_id IS NOT NULL)
);

-- Update unique constraint to include both persona types
ALTER TABLE public.customer_personas 
DROP CONSTRAINT customer_personas_customer_id_persona_id_key;

ALTER TABLE public.customer_personas 
ADD CONSTRAINT unique_customer_persona 
UNIQUE (customer_id, persona_id, predefined_persona_id);