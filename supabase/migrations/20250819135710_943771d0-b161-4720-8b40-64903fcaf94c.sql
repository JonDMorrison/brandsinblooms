-- Enable RLS and add policies for the new tables
ALTER TABLE public.domain_connect_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_dns_records ENABLE ROW LEVEL SECURITY;

-- RLS policies for domain_connect_sessions
CREATE POLICY "Tenant users can manage domain connect sessions" 
ON public.domain_connect_sessions FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.users u 
  WHERE u.tenant_id = domain_connect_sessions.tenant_id AND u.id = auth.uid()
));

-- RLS policies for email_dns_records  
CREATE POLICY "Tenant users can view DNS records" 
ON public.email_dns_records FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.email_domains d 
  JOIN public.users u ON u.tenant_id = d.tenant_id 
  WHERE d.id = email_dns_records.email_domain_id AND u.id = auth.uid()
));