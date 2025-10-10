-- Enable pg_trgm extension first for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add indexes for crm_customers table to optimize large-scale queries
CREATE INDEX IF NOT EXISTS idx_crm_customers_email ON public.crm_customers(email);
CREATE INDEX IF NOT EXISTS idx_crm_customers_persona_id ON public.crm_customers(persona_id);
CREATE INDEX IF NOT EXISTS idx_crm_customers_created_at ON public.crm_customers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_customers_sms_opt_in ON public.crm_customers(sms_opt_in) WHERE sms_opt_in = true;
CREATE INDEX IF NOT EXISTS idx_crm_customers_tenant_id ON public.crm_customers(tenant_id);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_crm_customers_tenant_persona ON public.crm_customers(tenant_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_crm_customers_search ON public.crm_customers USING gin ((first_name || ' ' || last_name || ' ' || email) gin_trgm_ops);

-- Add index for customer_segments join table
CREATE INDEX IF NOT EXISTS idx_customer_segments_customer_id ON public.customer_segments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_segments_segment_id ON public.customer_segments(segment_id);

-- Add index for email tracking
CREATE INDEX IF NOT EXISTS idx_email_tracking_customer ON public.email_tracking_events(customer_email);
CREATE INDEX IF NOT EXISTS idx_email_tracking_campaign ON public.email_tracking_events(campaign_id, event_type);

COMMENT ON INDEX idx_crm_customers_search IS 'Fuzzy text search index for customer names and emails';