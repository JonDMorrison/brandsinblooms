-- BLOOM-FIX-01: align append-only Bloom policies with tenant-scoped CRM event patterns.

DO $$
BEGIN
  IF to_regclass('public.bloom_tool_executions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.bloom_tool_executions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "bloom_tool_executions_select_own" ON public.bloom_tool_executions';
    EXECUTE 'DROP POLICY IF EXISTS "bloom_tool_executions_insert_own" ON public.bloom_tool_executions';
    EXECUTE 'DROP POLICY IF EXISTS "bloom_tool_executions_select_tenant" ON public.bloom_tool_executions';
    EXECUTE 'DROP POLICY IF EXISTS "bloom_tool_executions_insert_tenant" ON public.bloom_tool_executions';

    EXECUTE $policy$
      CREATE POLICY "bloom_tool_executions_select_tenant"
        ON public.bloom_tool_executions
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND u.tenant_id = bloom_tool_executions.tenant_id
          )
        )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "bloom_tool_executions_insert_tenant"
        ON public.bloom_tool_executions
        FOR INSERT
        TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND u.tenant_id = bloom_tool_executions.tenant_id
          )
        )
    $policy$;
  END IF;

  IF to_regclass('public.bloom_audit_log') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.bloom_audit_log ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "bloom_audit_log_select_own" ON public.bloom_audit_log';
    EXECUTE 'DROP POLICY IF EXISTS "bloom_audit_log_insert_own" ON public.bloom_audit_log';
    EXECUTE 'DROP POLICY IF EXISTS "bloom_audit_log_select_tenant" ON public.bloom_audit_log';
    EXECUTE 'DROP POLICY IF EXISTS "bloom_audit_log_insert_tenant" ON public.bloom_audit_log';

    EXECUTE $policy$
      CREATE POLICY "bloom_audit_log_select_tenant"
        ON public.bloom_audit_log
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND u.tenant_id = bloom_audit_log.tenant_id
          )
        )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "bloom_audit_log_insert_tenant"
        ON public.bloom_audit_log
        FOR INSERT
        TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND u.tenant_id = bloom_audit_log.tenant_id
          )
        )
    $policy$;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';