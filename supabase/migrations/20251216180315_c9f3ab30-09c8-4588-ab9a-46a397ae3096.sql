-- Align Clover test harness RLS policies with canonical POS integration pattern

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own tenant test results" ON public.clover_connection_tests;
DROP POLICY IF EXISTS "Users can insert own tenant test results" ON public.clover_connection_tests;

-- Recreate with canonical naming and exact predicate pattern
CREATE POLICY "Users can view their tenant's Clover test results"
  ON public.clover_connection_tests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = clover_connection_tests.tenant_id
    )
  );

CREATE POLICY "Users can insert their tenant's Clover test results"
  ON public.clover_connection_tests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = clover_connection_tests.tenant_id
    )
  );

-- Add missing UPDATE policy (matching Square pattern)
CREATE POLICY "Users can update their tenant's Clover test results"
  ON public.clover_connection_tests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = clover_connection_tests.tenant_id
    )
  );

-- Add missing DELETE policy (matching Square pattern)
CREATE POLICY "Users can delete their tenant's Clover test results"
  ON public.clover_connection_tests FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = clover_connection_tests.tenant_id
    )
  );