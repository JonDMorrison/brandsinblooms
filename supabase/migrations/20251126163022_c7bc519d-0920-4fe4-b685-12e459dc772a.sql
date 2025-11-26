
-- Add unique constraint on crm_customers (tenant_id, email) for Square sync upserts
ALTER TABLE public.crm_customers
ADD CONSTRAINT crm_customers_tenant_email_unique UNIQUE (tenant_id, email);

-- Add index for better query performance on this constraint
CREATE INDEX IF NOT EXISTS idx_crm_customers_tenant_email ON public.crm_customers(tenant_id, email);
