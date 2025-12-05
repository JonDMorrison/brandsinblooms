-- Create crm_email_consent_events table for audit trail
CREATE TABLE public.crm_email_consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('opt_in', 'opt_out', 'opt_in_request_sent', 'imported_unknown', 'updated_by_admin')),
  source TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_crm_email_consent_events_lookup 
ON public.crm_email_consent_events(tenant_id, customer_id, created_at DESC);

CREATE INDEX idx_crm_email_consent_events_tenant 
ON public.crm_email_consent_events(tenant_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.crm_email_consent_events ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view consent events for their tenant"
ON public.crm_email_consent_events
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM users u
  WHERE u.tenant_id = crm_email_consent_events.tenant_id
  AND u.id = auth.uid()
));

CREATE POLICY "Users can insert consent events for their tenant"
ON public.crm_email_consent_events
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM users u
  WHERE u.tenant_id = crm_email_consent_events.tenant_id
  AND u.id = auth.uid()
));

-- Create crm_email_preference_tokens table for secure preference links
CREATE TABLE public.crm_email_preference_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL DEFAULT 'opt_in_request',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for token lookups
CREATE INDEX idx_crm_email_preference_tokens_token 
ON public.crm_email_preference_tokens(token);

CREATE INDEX idx_crm_email_preference_tokens_customer 
ON public.crm_email_preference_tokens(customer_id);

-- Enable RLS
ALTER TABLE public.crm_email_preference_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies - tokens can be accessed by tenant users or publicly via token
CREATE POLICY "Users can manage preference tokens for their tenant"
ON public.crm_email_preference_tokens
FOR ALL
USING (EXISTS (
  SELECT 1 FROM users u
  WHERE u.tenant_id = crm_email_preference_tokens.tenant_id
  AND u.id = auth.uid()
));

-- Allow public read access via token for preference page (service role will handle this)
CREATE POLICY "Public can read tokens by token value"
ON public.crm_email_preference_tokens
FOR SELECT
USING (true);

-- Helper function to get consent statistics for a tenant
CREATE OR REPLACE FUNCTION public.get_email_consent_stats(p_tenant_id UUID)
RETURNS TABLE(
  total_customers BIGINT,
  opted_in_count BIGINT,
  opted_out_count BIGINT,
  unknown_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COUNT(*) as total_customers,
    COUNT(*) FILTER (WHERE email_opt_in = true) as opted_in_count,
    COUNT(*) FILTER (WHERE email_opt_in = false) as opted_out_count,
    COUNT(*) FILTER (WHERE email_opt_in IS NULL AND email IS NOT NULL) as unknown_count
  FROM crm_customers
  WHERE tenant_id = p_tenant_id
    AND email IS NOT NULL;
$$;