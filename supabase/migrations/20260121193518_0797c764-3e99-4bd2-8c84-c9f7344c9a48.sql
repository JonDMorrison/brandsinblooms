-- Add unique constraint on suppression_list for (tenant_id, email, suppression_type)
-- This enables proper upsert behavior for the "Clean Bounces" feature

CREATE UNIQUE INDEX IF NOT EXISTS suppression_list_tenant_email_type_unique 
ON public.suppression_list (tenant_id, email, suppression_type) 
WHERE email IS NOT NULL AND lifted_at IS NULL;