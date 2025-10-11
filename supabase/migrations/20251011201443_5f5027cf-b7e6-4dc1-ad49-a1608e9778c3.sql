-- Migration Wizard Database Tables (One-time import from Mailchimp/Klaviyo)

-- Provider connections (OAuth tokens, encrypted)
CREATE TABLE IF NOT EXISTS public.provider_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('mailchimp', 'klaviyo')),
  encrypted_access_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  provider_account_id TEXT,
  provider_account_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'expired', 'revoked', 'error')),
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Import jobs (tracks each migration run)
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  provider_connection_id UUID NOT NULL REFERENCES public.provider_connections(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL DEFAULT 'full' CHECK (job_type IN ('preflight', 'full')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'mapping', 'importing', 'completed', 'failed', 'cancelled')),
  current_step TEXT DEFAULT 'connect',
  selected_lists JSONB DEFAULT '[]'::jsonb,
  selected_segments JSONB DEFAULT '[]'::jsonb,
  selected_tags JSONB DEFAULT '[]'::jsonb,
  ai_recommendations JSONB DEFAULT '[]'::jsonb,
  applied_mappings JSONB DEFAULT '{}'::jsonb,
  stats JSONB DEFAULT '{
    "contacts_selected": 0,
    "contacts_imported": 0,
    "contacts_skipped": 0,
    "contacts_failed": 0,
    "segments_created": 0,
    "personas_created": 0,
    "tags_created": 0,
    "suppressions_added": 0
  }'::jsonb,
  error_log JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Import job items (individual contacts being imported)
CREATE TABLE IF NOT EXISTS public.import_job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'imported', 'skipped', 'failed')),
  skip_reason TEXT,
  error_message TEXT,
  raw_data JSONB,
  mapped_customer_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Provider artifacts (tags, segments, lists from provider)
CREATE TABLE IF NOT EXISTS public.provider_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_connection_id UUID NOT NULL REFERENCES public.provider_connections(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('list', 'segment', 'tag', 'group')),
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  member_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- AI mapping suggestions (OpenAI recommendations)
CREATE TABLE IF NOT EXISTS public.ai_mapping_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('tag', 'segment', 'list')),
  source_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  suggested_action TEXT NOT NULL CHECK (suggested_action IN ('create_segment', 'create_persona', 'merge_tag', 'skip')),
  suggested_name TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  rationale TEXT,
  merge_with_existing_id UUID,
  is_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_provider_connections_tenant ON public.provider_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_provider_connections_status ON public.provider_connections(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_tenant ON public.import_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON public.import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_job_items_job ON public.import_job_items(import_job_id);
CREATE INDEX IF NOT EXISTS idx_import_job_items_status ON public.import_job_items(status);
CREATE INDEX IF NOT EXISTS idx_provider_artifacts_connection ON public.provider_artifacts(provider_connection_id);
CREATE INDEX IF NOT EXISTS idx_ai_mapping_suggestions_job ON public.ai_mapping_suggestions(import_job_id);

-- RLS Policies
ALTER TABLE public.provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_job_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_mapping_suggestions ENABLE ROW LEVEL SECURITY;

-- Users can manage their tenant's provider connections
CREATE POLICY "tenant_users_manage_connections" ON public.provider_connections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.tenant_id = provider_connections.tenant_id 
      AND u.id = auth.uid()
    )
  );

-- Users can manage their tenant's import jobs
CREATE POLICY "tenant_users_manage_jobs" ON public.import_jobs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.tenant_id = import_jobs.tenant_id 
      AND u.id = auth.uid()
    )
  );

-- Users can view import job items for their jobs
CREATE POLICY "tenant_users_view_job_items" ON public.import_job_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM import_jobs ij
      JOIN users u ON u.tenant_id = ij.tenant_id
      WHERE ij.id = import_job_items.import_job_id
      AND u.id = auth.uid()
    )
  );

-- Users can view provider artifacts for their connections
CREATE POLICY "tenant_users_view_artifacts" ON public.provider_artifacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM provider_connections pc
      JOIN users u ON u.tenant_id = pc.tenant_id
      WHERE pc.id = provider_artifacts.provider_connection_id
      AND u.id = auth.uid()
    )
  );

-- Users can manage AI suggestions for their jobs
CREATE POLICY "tenant_users_manage_suggestions" ON public.ai_mapping_suggestions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM import_jobs ij
      JOIN users u ON u.tenant_id = ij.tenant_id
      WHERE ij.id = ai_mapping_suggestions.import_job_id
      AND u.id = auth.uid()
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_provider_connections_updated_at
  BEFORE UPDATE ON public.provider_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_import_jobs_updated_at
  BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_import_job_items_updated_at
  BEFORE UPDATE ON public.import_job_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();