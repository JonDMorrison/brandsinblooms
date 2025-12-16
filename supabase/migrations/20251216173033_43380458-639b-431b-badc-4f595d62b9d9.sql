-- Create table for storing Clover connection test results
CREATE TABLE public.clover_connection_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.clover_connections(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  merchant_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  summary TEXT,
  raw_results JSONB NOT NULL DEFAULT '{}',
  counts JSONB DEFAULT '{}',
  errors JSONB DEFAULT '[]',
  duration_ms INTEGER,
  tested_by UUID REFERENCES auth.users(id)
);

-- Create indexes for efficient querying
CREATE INDEX idx_clover_connection_tests_tenant ON public.clover_connection_tests(tenant_id);
CREATE INDEX idx_clover_connection_tests_connection ON public.clover_connection_tests(connection_id);
CREATE INDEX idx_clover_connection_tests_created ON public.clover_connection_tests(created_at DESC);

-- Enable RLS
ALTER TABLE public.clover_connection_tests ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only org/tenant members can access their test results
CREATE POLICY "Users can view own tenant test results"
  ON public.clover_connection_tests FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.tenant_id = clover_connection_tests.tenant_id AND u.id = auth.uid()
  ));

CREATE POLICY "Users can insert own tenant test results"
  ON public.clover_connection_tests FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u WHERE u.tenant_id = clover_connection_tests.tenant_id AND u.id = auth.uid()
  ));

-- Add columns to clover_connections for tracking last test
ALTER TABLE public.clover_connections 
ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_test_status TEXT;