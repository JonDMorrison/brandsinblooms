-- Create customer_consents table for tracking opt-in/opt-out status
CREATE TABLE customer_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  status TEXT NOT NULL CHECK (status IN ('opted_in', 'opted_out', 'suppressed')),
  consent_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, channel)
);

CREATE INDEX idx_customer_consents_customer ON customer_consents(customer_id);
CREATE INDEX idx_customer_consents_status ON customer_consents(status);

-- Create crm_tags table for tag definitions
CREATE TABLE crm_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_crm_tags_tenant ON crm_tags(tenant_id);

-- Create customer_tags junction table
CREATE TABLE customer_tags (
  contact_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES crm_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (contact_id, tag_id)
);

CREATE INDEX idx_customer_tags_contact ON customer_tags(contact_id);
CREATE INDEX idx_customer_tags_tag ON customer_tags(tag_id);

-- Create customer_sources table for import tracking
CREATE TABLE customer_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('mailchimp', 'klaviyo', 'lightspeed', 'manual')),
  source_id TEXT,
  imported_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, source_type)
);

CREATE INDEX idx_customer_sources_customer ON customer_sources(customer_id);
CREATE INDEX idx_customer_sources_tenant ON customer_sources(tenant_id);
CREATE INDEX idx_customer_sources_type ON customer_sources(source_type);

-- Enable RLS on all new tables
ALTER TABLE customer_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sources ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_consents
CREATE POLICY "Users can view consents for their tenant customers"
  ON customer_consents FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM crm_customers 
      WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert consents for their tenant customers"
  ON customer_consents FOR INSERT
  WITH CHECK (
    customer_id IN (
      SELECT id FROM crm_customers 
      WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can update consents for their tenant customers"
  ON customer_consents FOR UPDATE
  USING (
    customer_id IN (
      SELECT id FROM crm_customers 
      WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

-- RLS Policies for crm_tags
CREATE POLICY "Users can view tags for their tenant"
  ON crm_tags FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert tags for their tenant"
  ON crm_tags FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update tags for their tenant"
  ON crm_tags FOR UPDATE
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- RLS Policies for customer_tags
CREATE POLICY "Users can view customer tags for their tenant"
  ON customer_tags FOR SELECT
  USING (
    contact_id IN (
      SELECT id FROM crm_customers 
      WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert customer tags for their tenant"
  ON customer_tags FOR INSERT
  WITH CHECK (
    contact_id IN (
      SELECT id FROM crm_customers 
      WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete customer tags for their tenant"
  ON customer_tags FOR DELETE
  USING (
    contact_id IN (
      SELECT id FROM crm_customers 
      WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

-- RLS Policies for customer_sources
CREATE POLICY "Users can view sources for their tenant customers"
  ON customer_sources FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert sources for their tenant customers"
  ON customer_sources FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update sources for their tenant customers"
  ON customer_sources FOR UPDATE
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );