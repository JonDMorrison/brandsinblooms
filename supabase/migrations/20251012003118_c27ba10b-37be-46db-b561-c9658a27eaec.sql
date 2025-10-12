-- Fix import_jobs table (remove invalid FK)

-- Drop the bad constraint if it exists
ALTER TABLE IF EXISTS public.import_jobs 
  DROP CONSTRAINT IF EXISTS import_jobs_tenant_id_fkey;

-- Recreate import_jobs properly if needed
DROP TABLE IF EXISTS public.import_jobs CASCADE;

CREATE TABLE public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('mailchimp', 'klaviyo')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  config JSONB NOT NULL DEFAULT '{}',
  report JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_jobs_user_id ON public.import_jobs(user_id);
CREATE INDEX idx_import_jobs_tenant_id ON public.import_jobs(tenant_id);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage import jobs for their tenant" ON public.import_jobs;
CREATE POLICY "Users can manage import jobs for their tenant"
  ON public.import_jobs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users u
    WHERE u.tenant_id = import_jobs.tenant_id AND u.id = auth.uid()
  ));