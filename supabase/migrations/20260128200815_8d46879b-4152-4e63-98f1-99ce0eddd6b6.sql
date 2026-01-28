-- ============================================================
-- Form Automation Execution Logging Schema
-- Provides full observability for form-triggered automations
-- ============================================================

-- Create dedicated table for form automation execution logs
CREATE TABLE IF NOT EXISTS public.form_automation_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  automation_id UUID NOT NULL REFERENCES public.crm_automations(id) ON DELETE CASCADE,
  automation_run_id UUID REFERENCES public.automation_runs(id) ON DELETE SET NULL,
  submission_id UUID NOT NULL,
  customer_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  
  -- Execution status
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'skipped')),
  step_type TEXT, -- 'email', 'notification', 'delay'
  step_index INTEGER,
  
  -- Timing
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Failure tracking
  failure_reason TEXT,
  error_details JSONB,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  
  -- Context
  trigger_event_id UUID,
  node_id TEXT,
  recipient TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.form_automation_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant's execution logs"
  ON public.form_automation_executions
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

-- ============================================================
-- Indexes for efficient querying
-- ============================================================

-- Query by submission (support: "show me all automation actions for this form submission")
CREATE INDEX idx_form_auto_exec_submission 
  ON public.form_automation_executions(submission_id, executed_at DESC);

-- Query by automation (support: "show me all executions for this automation")
CREATE INDEX idx_form_auto_exec_automation 
  ON public.form_automation_executions(automation_id, executed_at DESC);

-- Query by status (operations: "show me all failed executions")
CREATE INDEX idx_form_auto_exec_status 
  ON public.form_automation_executions(status, executed_at DESC)
  WHERE status IN ('failed', 'running');

-- Query by tenant + time range (dashboard)
CREATE INDEX idx_form_auto_exec_tenant_time 
  ON public.form_automation_executions(tenant_id, executed_at DESC);

-- Retry queue processing
CREATE INDEX idx_form_auto_exec_retry_queue 
  ON public.form_automation_executions(next_retry_at, retry_count)
  WHERE status = 'failed' AND retry_count < max_retries AND next_retry_at IS NOT NULL;

-- ============================================================
-- Add retry tracking to automation_trigger_events
-- ============================================================
ALTER TABLE public.automation_trigger_events 
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ;

-- ============================================================
-- Helper function to log execution with proper error handling
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_form_automation_execution(
  p_tenant_id UUID,
  p_automation_id UUID,
  p_automation_run_id UUID,
  p_submission_id UUID,
  p_customer_id UUID,
  p_status TEXT,
  p_step_type TEXT DEFAULT NULL,
  p_step_index INTEGER DEFAULT NULL,
  p_failure_reason TEXT DEFAULT NULL,
  p_error_details JSONB DEFAULT NULL,
  p_trigger_event_id UUID DEFAULT NULL,
  p_node_id TEXT DEFAULT NULL,
  p_recipient TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_execution_id UUID;
BEGIN
  INSERT INTO public.form_automation_executions (
    tenant_id, automation_id, automation_run_id, submission_id, customer_id,
    status, step_type, step_index, failure_reason, error_details,
    trigger_event_id, node_id, recipient, metadata,
    started_at, completed_at, duration_ms
  ) VALUES (
    p_tenant_id, p_automation_id, p_automation_run_id, p_submission_id, p_customer_id,
    p_status, p_step_type, p_step_index, p_failure_reason, p_error_details,
    p_trigger_event_id, p_node_id, p_recipient, p_metadata,
    CASE WHEN p_status IN ('running', 'completed', 'failed') THEN now() ELSE NULL END,
    CASE WHEN p_status IN ('completed', 'failed', 'skipped') THEN now() ELSE NULL END,
    NULL
  )
  RETURNING id INTO v_execution_id;
  
  RETURN v_execution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute to authenticated users (for edge functions)
GRANT EXECUTE ON FUNCTION public.log_form_automation_execution TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_form_automation_execution TO service_role;