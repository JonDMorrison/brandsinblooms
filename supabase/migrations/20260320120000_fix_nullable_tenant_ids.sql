-- FIX: [issue #7] - crm_customers.tenant_id must be NOT NULL for tenant isolation
-- FIX: [issue #8] - crm_campaigns.tenant_id must be NOT NULL for tenant isolation
-- FIX: [issue #9] - crm_segments.tenant_id must be NOT NULL for tenant isolation

-- First, delete any orphaned rows with NULL tenant_id
DELETE FROM crm_customers WHERE tenant_id IS NULL;
DELETE FROM crm_campaigns WHERE tenant_id IS NULL;
DELETE FROM crm_segments WHERE tenant_id IS NULL;

-- Add NOT NULL constraints
ALTER TABLE crm_customers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE crm_campaigns ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE crm_segments ALTER COLUMN tenant_id SET NOT NULL;

-- FIX: [issue #10] - Add INSERT/UPDATE RLS policies for crm_email_sends
CREATE POLICY "Users can insert email sends for their tenant" ON crm_email_sends
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = crm_email_sends.tenant_id)
  );

CREATE POLICY "Users can update email sends for their tenant" ON crm_email_sends
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = crm_email_sends.tenant_id)
  );

-- FIX: [issue #11] - Add FK constraint and tenant_id to customer_timeline
ALTER TABLE customer_timeline
  ADD CONSTRAINT fk_customer_timeline_customer
  FOREIGN KEY (customer_id) REFERENCES crm_customers(id) ON DELETE CASCADE;

ALTER TABLE customer_timeline ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

UPDATE customer_timeline ct SET tenant_id = (
  SELECT cc.tenant_id FROM crm_customers cc WHERE cc.id = ct.customer_id
) WHERE ct.tenant_id IS NULL;

ALTER TABLE customer_timeline ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_timeline_tenant_id ON customer_timeline(tenant_id);
