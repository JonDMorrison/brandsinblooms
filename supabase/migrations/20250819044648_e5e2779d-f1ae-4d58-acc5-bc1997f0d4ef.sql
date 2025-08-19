-- Add unique constraint on tenant_id and domain to support upsert operations
-- This ensures one domain per tenant and enables proper conflict resolution
alter table public.email_domains 
add constraint unique_tenant_domain unique (tenant_id, domain);