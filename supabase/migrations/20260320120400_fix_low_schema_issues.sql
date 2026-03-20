-- FIX: [issue #67] - Add FK constraint for pos_customers.tenant_id
ALTER TABLE pos_customers ADD CONSTRAINT fk_pos_customers_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FIX: [issue #68] - Add missing indexes for crm_customer_links lookup columns
CREATE INDEX IF NOT EXISTS idx_crm_customer_links_crm_customer_id ON crm_customer_links(crm_customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_customer_links_pos_customer_id ON crm_customer_links(pos_customer_id);
