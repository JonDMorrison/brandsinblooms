-- BLOOM-FIX-09: allow tenant-scoped Bloom audit log reads for master admins.

DO $$
BEGIN
  IF to_regclass('public.bloom_audit_log') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "bloom_audit_log_admin_select" ON public.bloom_audit_log';

    EXECUTE $policy$
      CREATE POLICY "bloom_audit_log_admin_select"
        ON public.bloom_audit_log
        FOR SELECT
        TO authenticated
        USING (
          public.is_master_admin(auth.uid())
          AND EXISTS (
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