CREATE TABLE IF NOT EXISTS public.bloom_conversation_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.bloom_conversations(id) ON DELETE CASCADE,
  resource_type TEXT,
  resource_id UUID,
  content TEXT NOT NULL,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bloom_conversation_exports_lookup
  ON public.bloom_conversation_exports (
    tenant_id,
    user_id,
    exported_at DESC
  );

ALTER TABLE public.bloom_conversation_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bloom_conversation_exports_select_own" ON public.bloom_conversation_exports;
CREATE POLICY "bloom_conversation_exports_select_own"
  ON public.bloom_conversation_exports
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_conversation_exports.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_conversation_exports_insert_own" ON public.bloom_conversation_exports;
CREATE POLICY "bloom_conversation_exports_insert_own"
  ON public.bloom_conversation_exports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_conversation_exports.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_conversation_exports_update_own" ON public.bloom_conversation_exports;
CREATE POLICY "bloom_conversation_exports_update_own"
  ON public.bloom_conversation_exports
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_conversation_exports.tenant_id
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_conversation_exports.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_conversation_exports_delete_own" ON public.bloom_conversation_exports;
CREATE POLICY "bloom_conversation_exports_delete_own"
  ON public.bloom_conversation_exports
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_conversation_exports.tenant_id
    )
  );

REVOKE ALL ON TABLE public.bloom_conversation_exports FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bloom_conversation_exports TO authenticated;
GRANT ALL ON TABLE public.bloom_conversation_exports TO service_role;
