-- Phase 4: Add Square-specific tracking columns to crm_customers
ALTER TABLE crm_customers 
ADD COLUMN IF NOT EXISTS square_customer_id TEXT,
ADD COLUMN IF NOT EXISTS square_last_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS square_group_ids TEXT[];

-- Index for faster Square customer lookups
CREATE INDEX IF NOT EXISTS idx_crm_customers_square_id 
ON crm_customers(tenant_id, square_customer_id) 
WHERE square_customer_id IS NOT NULL;

-- Index for finding customers by POS source
CREATE INDEX IF NOT EXISTS idx_crm_customers_pos_source 
ON crm_customers(tenant_id, pos_source) 
WHERE pos_source IS NOT NULL;