-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing tables if they exist (to fix schema issues)
DROP TABLE IF EXISTS public.ai_mapping_suggestions CASCADE;
DROP TABLE IF EXISTS public.provider_artifacts CASCADE;

-- Create provider_artifacts table
CREATE TABLE public.provider_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('mailchimp', 'klaviyo')),
  artifact_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  member_count INTEGER DEFAULT 0,
  data JSONB DEFAULT '[]'::jsonb,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ai_mapping_suggestions table
CREATE TABLE public.ai_mapping_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  artifact_id UUID NOT NULL REFERENCES public.provider_artifacts(id) ON DELETE CASCADE,
  suggested_action TEXT NOT NULL CHECK (suggested_action IN ('map_existing', 'create_new', 'skip')),
  target_segment_id UUID,
  target_persona_id UUID,
  new_segment_name TEXT,
  new_persona_name TEXT,
  confidence_score NUMERIC DEFAULT 0.75,
  rationale TEXT,
  suggestion_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_provider_artifacts_import_job ON public.provider_artifacts(import_job_id);
CREATE INDEX idx_provider_artifacts_tenant ON public.provider_artifacts(tenant_id);
CREATE INDEX idx_ai_suggestions_import_job ON public.ai_mapping_suggestions(import_job_id);
CREATE INDEX idx_ai_suggestions_artifact ON public.ai_mapping_suggestions(artifact_id);

-- Enable RLS
ALTER TABLE public.provider_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_mapping_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage artifacts for their tenant"
  ON public.provider_artifacts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users u
    WHERE u.tenant_id = provider_artifacts.tenant_id AND u.id = auth.uid()
  ));

CREATE POLICY "Users can manage suggestions for their tenant"
  ON public.ai_mapping_suggestions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users u
    WHERE u.tenant_id = ai_mapping_suggestions.tenant_id AND u.id = auth.uid()
  ));