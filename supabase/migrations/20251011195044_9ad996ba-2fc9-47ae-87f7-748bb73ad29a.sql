-- Create customer_additional_fields table for dynamic data storage
CREATE TABLE public.customer_additional_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  field_value TEXT,
  field_type TEXT DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'email', 'phone', 'url', 'boolean')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id, field_name)
);

-- Create index for fast customer lookups
CREATE INDEX idx_customer_additional_fields_customer_id ON public.customer_additional_fields(customer_id);

-- Create index for field name searches
CREATE INDEX idx_customer_additional_fields_field_name ON public.customer_additional_fields(field_name);

-- Create index for tenant isolation
CREATE INDEX idx_customer_additional_fields_tenant_id ON public.customer_additional_fields(tenant_id);

-- Enable RLS
ALTER TABLE public.customer_additional_fields ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view additional fields for customers in their tenant
CREATE POLICY "Users can view additional fields for their tenant customers"
ON public.customer_additional_fields
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.crm_customers c
    JOIN public.users u ON u.tenant_id = c.tenant_id
    WHERE c.id = customer_additional_fields.customer_id
    AND u.id = auth.uid()
  )
);

-- Policy: Users can insert additional fields for their tenant customers
CREATE POLICY "Users can insert additional fields for their tenant customers"
ON public.customer_additional_fields
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_customers c
    JOIN public.users u ON u.tenant_id = c.tenant_id
    WHERE c.id = customer_additional_fields.customer_id
    AND u.id = auth.uid()
  )
  AND tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
);

-- Policy: Users can update additional fields for their tenant customers
CREATE POLICY "Users can update additional fields for their tenant customers"
ON public.customer_additional_fields
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_customers c
    JOIN public.users u ON u.tenant_id = c.tenant_id
    WHERE c.id = customer_additional_fields.customer_id
    AND u.id = auth.uid()
  )
);

-- Policy: Users can delete additional fields for their tenant customers
CREATE POLICY "Users can delete additional fields for their tenant customers"
ON public.customer_additional_fields
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_customers c
    JOIN public.users u ON u.tenant_id = c.tenant_id
    WHERE c.id = customer_additional_fields.customer_id
    AND u.id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_customer_additional_fields_updated_at
  BEFORE UPDATE ON public.customer_additional_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();