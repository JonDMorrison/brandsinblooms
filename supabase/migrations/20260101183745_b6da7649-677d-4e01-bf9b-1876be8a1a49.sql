-- ============================================
-- SCHEDULED AUTOMATION TASKS - PHASE 1
-- ============================================

-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- 1. Create automation_runs table
-- Tracks each customer's journey through an automation
-- ============================================
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES public.crm_automations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled', 'failed')),
  current_step_index INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 0,
  next_step_scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  trigger_data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(automation_id, customer_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_automation_runs_next_step 
  ON public.automation_runs(next_step_scheduled_at) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_automation_runs_tenant_status 
  ON public.automation_runs(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_automation_runs_automation 
  ON public.automation_runs(automation_id, status);

CREATE INDEX IF NOT EXISTS idx_automation_runs_customer 
  ON public.automation_runs(customer_id);

-- ============================================
-- 2. Add missing fields to crm_outbox
-- ============================================
ALTER TABLE public.crm_outbox 
  ADD COLUMN IF NOT EXISTS automation_run_id UUID REFERENCES public.automation_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS step_index INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by TEXT;

-- Create index for pending message processing
CREATE INDEX IF NOT EXISTS idx_crm_outbox_pending 
  ON public.crm_outbox(scheduled_at, priority, status) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_crm_outbox_locked 
  ON public.crm_outbox(locked_until) 
  WHERE status = 'pending' AND locked_until IS NOT NULL;

-- ============================================
-- 3. Enable Row Level Security
-- ============================================
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their tenant's automation runs
CREATE POLICY "Users can view their tenant automation runs"
  ON public.automation_runs
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert automation runs for their tenant
CREATE POLICY "Users can insert automation runs for their tenant"
  ON public.automation_runs
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Policy: Users can update their tenant's automation runs
CREATE POLICY "Users can update their tenant automation runs"
  ON public.automation_runs
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Policy: Service role can do everything (for edge functions)
CREATE POLICY "Service role full access to automation_runs"
  ON public.automation_runs
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 4. Create trigger for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.update_automation_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_automation_runs_updated_at ON public.automation_runs;
CREATE TRIGGER update_automation_runs_updated_at
  BEFORE UPDATE ON public.automation_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_automation_runs_updated_at();

-- ============================================
-- 5. Create helper function to advance automation step
-- ============================================
CREATE OR REPLACE FUNCTION public.advance_automation_step(
  p_run_id UUID,
  p_next_scheduled_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_run RECORD;
BEGIN
  -- Get current run state
  SELECT * INTO v_run FROM public.automation_runs WHERE id = p_run_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if already completed
  IF v_run.status IN ('completed', 'cancelled', 'failed') THEN
    RETURN FALSE;
  END IF;
  
  -- Advance step
  IF v_run.current_step_index + 1 >= v_run.total_steps THEN
    -- All steps completed
    UPDATE public.automation_runs
    SET 
      status = 'completed',
      current_step_index = v_run.total_steps,
      completed_at = now(),
      next_step_scheduled_at = NULL
    WHERE id = p_run_id;
  ELSE
    -- Move to next step
    UPDATE public.automation_runs
    SET 
      current_step_index = current_step_index + 1,
      next_step_scheduled_at = p_next_scheduled_at
    WHERE id = p_run_id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;