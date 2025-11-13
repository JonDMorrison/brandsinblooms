-- Create migration_jobs table
CREATE TABLE IF NOT EXISTS public.migration_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  source_platform TEXT NOT NULL, -- 'square', 'clover', 'shopify', 'csv', etc.
  job_type TEXT NOT NULL, -- 'import', 'export', 'sync'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'paused', 'completed', 'failed', 'cancelled'
  progress_current INTEGER DEFAULT 0,
  progress_total INTEGER DEFAULT 0,
  progress_percentage NUMERIC(5,2) DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  paused_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb, -- Store job-specific config, source credentials, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  CONSTRAINT valid_job_type CHECK (job_type IN ('import', 'export', 'sync'))
);

-- Create migration_job_logs table
CREATE TABLE IF NOT EXISTS public.migration_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.migration_jobs(id) ON DELETE CASCADE,
  log_level TEXT NOT NULL DEFAULT 'info', -- 'info', 'warning', 'error', 'success'
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_log_level CHECK (log_level IN ('info', 'warning', 'error', 'success'))
);

-- Create migration_artifacts table
CREATE TABLE IF NOT EXISTS public.migration_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.migration_jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  artifact_type TEXT NOT NULL, -- 'customer', 'order', 'product', etc.
  source_id TEXT, -- Original ID from source platform
  target_id UUID, -- ID in our database
  mapping_data JSONB DEFAULT '{}'::jsonb, -- Store field mappings and transformation data
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed', 'skipped'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_artifact_status CHECK (status IN ('pending', 'success', 'failed', 'skipped'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_migration_jobs_tenant_id ON public.migration_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_user_id ON public.migration_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_status ON public.migration_jobs(status);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_created_at ON public.migration_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_migration_job_logs_job_id ON public.migration_job_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_migration_artifacts_job_id ON public.migration_artifacts(job_id);
CREATE INDEX IF NOT EXISTS idx_migration_artifacts_tenant_id ON public.migration_artifacts(tenant_id);

-- Enable Row Level Security
ALTER TABLE public.migration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_artifacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for migration_jobs
CREATE POLICY "Users can view their own tenant's migration jobs"
  ON public.migration_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.tenant_id = migration_jobs.tenant_id
    )
  );

CREATE POLICY "Users can insert migration jobs for their tenant"
  ON public.migration_jobs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.tenant_id = migration_jobs.tenant_id
    )
  );

CREATE POLICY "Users can update their own tenant's migration jobs"
  ON public.migration_jobs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.tenant_id = migration_jobs.tenant_id
    )
  );

-- RLS Policies for migration_job_logs
CREATE POLICY "Users can view logs for their tenant's jobs"
  ON public.migration_job_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.migration_jobs mj
      JOIN public.users u ON u.tenant_id = mj.tenant_id
      WHERE mj.id = migration_job_logs.job_id AND u.id = auth.uid()
    )
  );

CREATE POLICY "System can insert logs"
  ON public.migration_job_logs FOR INSERT
  WITH CHECK (true);

-- RLS Policies for migration_artifacts
CREATE POLICY "Users can view artifacts for their tenant"
  ON public.migration_artifacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.tenant_id = migration_artifacts.tenant_id
    )
  );

CREATE POLICY "System can insert artifacts"
  ON public.migration_artifacts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update artifacts"
  ON public.migration_artifacts FOR UPDATE
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_migration_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_migration_artifacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_migration_jobs_updated_at
  BEFORE UPDATE ON public.migration_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_migration_jobs_updated_at();

CREATE TRIGGER update_migration_artifacts_updated_at
  BEFORE UPDATE ON public.migration_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_migration_artifacts_updated_at();

-- Enable realtime for migration_jobs
ALTER PUBLICATION supabase_realtime ADD TABLE public.migration_jobs;