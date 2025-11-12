-- ===================================================
-- PHASE 1: Enhanced Import Jobs Table for Background Processing
-- ===================================================

-- Add progress tracking columns to import_jobs if they don't exist
ALTER TABLE public.import_jobs 
ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_stage TEXT,
ADD COLUMN IF NOT EXISTS estimated_completion_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS error_details JSONB,
ADD COLUMN IF NOT EXISTS batch_stats JSONB DEFAULT '{
  "total_batches": 0,
  "completed_batches": 0,
  "failed_batches": 0,
  "contacts_per_batch": 100
}'::jsonb;

-- Create index for real-time queries
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_status 
ON public.import_jobs(user_id, status, created_at DESC);

-- Enable RLS
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for import_jobs
DROP POLICY IF EXISTS "Users can view their own import jobs" ON public.import_jobs;
CREATE POLICY "Users can view their own import jobs"
ON public.import_jobs FOR SELECT
USING (
  auth.uid() IN (
    SELECT id FROM public.users WHERE tenant_id = import_jobs.tenant_id
  )
);

DROP POLICY IF EXISTS "Users can insert their own import jobs" ON public.import_jobs;
CREATE POLICY "Users can insert their own import jobs"
ON public.import_jobs FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "Users can update their own import jobs" ON public.import_jobs;
CREATE POLICY "Users can update their own import jobs"
ON public.import_jobs FOR UPDATE
USING (
  auth.uid() IN (
    SELECT id FROM public.users WHERE tenant_id = import_jobs.tenant_id
  )
);

-- Enable realtime for import_jobs table
ALTER TABLE public.import_jobs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.import_jobs;

-- Create function to update progress
CREATE OR REPLACE FUNCTION public.update_import_job_progress(
  p_job_id UUID,
  p_progress_percentage INTEGER,
  p_current_stage TEXT,
  p_batch_stats JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_estimated_completion TIMESTAMP WITH TIME ZONE;
  v_elapsed_seconds NUMERIC;
  v_total_seconds NUMERIC;
BEGIN
  -- Calculate estimated completion based on progress
  IF p_progress_percentage > 0 AND p_progress_percentage < 100 THEN
    SELECT EXTRACT(EPOCH FROM (now() - created_at)) INTO v_elapsed_seconds
    FROM public.import_jobs WHERE id = p_job_id;
    
    v_total_seconds := (v_elapsed_seconds / p_progress_percentage) * 100;
    v_estimated_completion := now() + (v_total_seconds - v_elapsed_seconds) * INTERVAL '1 second';
  END IF;

  -- Update job with progress
  UPDATE public.import_jobs
  SET 
    progress_percentage = p_progress_percentage,
    current_stage = p_current_stage,
    estimated_completion_at = v_estimated_completion,
    batch_stats = COALESCE(p_batch_stats, batch_stats),
    updated_at = now()
  WHERE id = p_job_id;
END;
$$;

-- Create function to log batch errors
CREATE OR REPLACE FUNCTION public.log_import_batch_error(
  p_job_id UUID,
  p_batch_number INTEGER,
  p_error_message TEXT,
  p_failed_items JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.import_jobs
  SET 
    error_details = COALESCE(error_details, '[]'::jsonb) || jsonb_build_object(
      'batch', p_batch_number,
      'error', p_error_message,
      'failed_items', p_failed_items,
      'timestamp', now()
    ),
    batch_stats = jsonb_set(
      batch_stats,
      '{failed_batches}',
      ((batch_stats->>'failed_batches')::integer + 1)::text::jsonb
    ),
    updated_at = now()
  WHERE id = p_job_id;
END;
$$;