-- Create pos_sync_jobs table for chain-based sync queue
CREATE TABLE public.pos_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL,
  connection_type text NOT NULL CHECK (connection_type IN ('square', 'clover', 'lightspeed')),
  sync_type text NOT NULL CHECK (sync_type IN ('customers', 'sales', 'products', 'full')),
  
  -- Job status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  
  -- Pagination cursor/offset for resume
  cursor text,
  page_offset integer DEFAULT 0,
  page_size integer DEFAULT 100,
  
  -- Progress tracking
  total_fetched integer DEFAULT 0,
  total_synced integer DEFAULT 0,
  total_failed integer DEFAULT 0,
  current_page integer DEFAULT 0,
  
  -- Chain control
  is_first_page boolean DEFAULT true,
  has_more_pages boolean DEFAULT true,
  
  -- Error handling
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  error_message text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- Indexes for efficient polling and queries
CREATE INDEX idx_pos_sync_jobs_status ON pos_sync_jobs(status, created_at);
CREATE INDEX idx_pos_sync_jobs_tenant ON pos_sync_jobs(tenant_id, connection_type);
CREATE INDEX idx_pos_sync_jobs_connection ON pos_sync_jobs(connection_id, sync_type);

-- Enable RLS
ALTER TABLE public.pos_sync_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view sync jobs for their tenant
CREATE POLICY "Users can view sync jobs for their tenant" 
ON pos_sync_jobs 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.tenant_id = pos_sync_jobs.tenant_id 
  AND u.id = auth.uid()
));

-- RLS Policy: Users can insert sync jobs for their tenant
CREATE POLICY "Users can insert sync jobs for their tenant" 
ON pos_sync_jobs 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.tenant_id = pos_sync_jobs.tenant_id 
  AND u.id = auth.uid()
));

-- RLS Policy: Users can update sync jobs for their tenant
CREATE POLICY "Users can update sync jobs for their tenant" 
ON pos_sync_jobs 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.tenant_id = pos_sync_jobs.tenant_id 
  AND u.id = auth.uid()
));

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_pos_sync_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pos_sync_jobs_updated_at
BEFORE UPDATE ON pos_sync_jobs
FOR EACH ROW
EXECUTE FUNCTION update_pos_sync_jobs_updated_at();