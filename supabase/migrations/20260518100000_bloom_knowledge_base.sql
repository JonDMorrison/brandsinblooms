CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.bloom_knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL CHECK (btrim(title) <> ''),
  content TEXT,
  chunk_count INTEGER NOT NULL DEFAULT 0 CHECK (chunk_count >= 0),
  status TEXT NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'processing', 'ready', 'failed')),
  error_message TEXT,
  source_file TEXT NOT NULL CHECK (btrim(source_file) <> ''),
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'txt', 'docx')),
  processing_progress INTEGER NOT NULL DEFAULT 0
    CHECK (processing_progress BETWEEN 0 AND 100),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bloom_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.bloom_knowledge_documents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  content TEXT NOT NULL CHECK (btrim(content) <> ''),
  embedding vector(1536) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bloom_knowledge_chunks_document_index_key UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_bloom_knowledge_documents_tenant_status_time
  ON public.bloom_knowledge_documents (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bloom_knowledge_documents_tenant_user_time
  ON public.bloom_knowledge_documents (tenant_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bloom_knowledge_chunks_document_index
  ON public.bloom_knowledge_chunks (document_id, chunk_index ASC);

CREATE INDEX IF NOT EXISTS idx_bloom_knowledge_chunks_tenant_document
  ON public.bloom_knowledge_chunks (tenant_id, document_id);

CREATE INDEX IF NOT EXISTS idx_bloom_knowledge_chunks_embedding_cosine
  ON public.bloom_knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

ALTER TABLE public.bloom_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloom_knowledge_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bloom_knowledge_documents_select_tenant" ON public.bloom_knowledge_documents;
CREATE POLICY "bloom_knowledge_documents_select_tenant"
  ON public.bloom_knowledge_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_knowledge_documents.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_knowledge_documents_insert_tenant" ON public.bloom_knowledge_documents;
CREATE POLICY "bloom_knowledge_documents_insert_tenant"
  ON public.bloom_knowledge_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_knowledge_documents.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_knowledge_documents_update_tenant" ON public.bloom_knowledge_documents;
CREATE POLICY "bloom_knowledge_documents_update_tenant"
  ON public.bloom_knowledge_documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_knowledge_documents.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_knowledge_documents.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_knowledge_documents_delete_tenant" ON public.bloom_knowledge_documents;
CREATE POLICY "bloom_knowledge_documents_delete_tenant"
  ON public.bloom_knowledge_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_knowledge_documents.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_knowledge_documents_service_role_all" ON public.bloom_knowledge_documents;
CREATE POLICY "bloom_knowledge_documents_service_role_all"
  ON public.bloom_knowledge_documents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "bloom_knowledge_chunks_select_tenant" ON public.bloom_knowledge_chunks;
CREATE POLICY "bloom_knowledge_chunks_select_tenant"
  ON public.bloom_knowledge_chunks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_knowledge_chunks.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_knowledge_chunks_service_role_all" ON public.bloom_knowledge_chunks;
CREATE POLICY "bloom_knowledge_chunks_service_role_all"
  ON public.bloom_knowledge_chunks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.bloom_knowledge_documents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.bloom_knowledge_chunks FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bloom_knowledge_documents TO authenticated;
GRANT SELECT ON TABLE public.bloom_knowledge_chunks TO authenticated;

GRANT ALL ON TABLE public.bloom_knowledge_documents TO service_role;
GRANT ALL ON TABLE public.bloom_knowledge_chunks TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_bloom_knowledge_documents_updated_at'
  ) THEN
    CREATE TRIGGER update_bloom_knowledge_documents_updated_at
      BEFORE UPDATE ON public.bloom_knowledge_documents
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bloom-uploads',
  'bloom-uploads',
  false,
  10485760,
  ARRAY[
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg'
  ];

DROP POLICY IF EXISTS "Tenant users can upload Bloom attachments" ON storage.objects;
CREATE POLICY "Tenant users can upload Bloom attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'bloom-uploads'
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id::text = (storage.foldername(name))[1]
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.bloom_conversations c
          ON c.tenant_id = u.tenant_id
         AND c.user_id = u.id
        WHERE u.id = auth.uid()
          AND u.tenant_id::text = (storage.foldername(name))[1]
          AND c.id::text = (storage.foldername(name))[2]
      )
      OR EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.bloom_knowledge_documents d
          ON d.tenant_id = u.tenant_id
        WHERE u.id = auth.uid()
          AND u.tenant_id::text = (storage.foldername(name))[1]
          AND (storage.foldername(name))[2] = 'knowledge'
          AND d.id::text = (storage.foldername(name))[3]
          AND d.source_file = name
      )
    )
  );

DROP POLICY IF EXISTS "Tenant users can delete their Bloom attachments" ON storage.objects;
CREATE POLICY "Tenant users can delete their Bloom attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'bloom-uploads'
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id::text = (storage.foldername(name))[1]
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.bloom_conversations c
          ON c.tenant_id = u.tenant_id
         AND c.user_id = u.id
        WHERE u.id = auth.uid()
          AND u.tenant_id::text = (storage.foldername(name))[1]
          AND c.id::text = (storage.foldername(name))[2]
      )
      OR EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.bloom_knowledge_documents d
          ON d.tenant_id = u.tenant_id
        WHERE u.id = auth.uid()
          AND u.tenant_id::text = (storage.foldername(name))[1]
          AND (storage.foldername(name))[2] = 'knowledge'
          AND d.id::text = (storage.foldername(name))[3]
      )
    )
  );

CREATE OR REPLACE FUNCTION public.match_bloom_knowledge_chunks(
  p_tenant_id UUID,
  p_query_embedding vector(1536),
  p_match_count INTEGER DEFAULT 5,
  p_min_similarity DOUBLE PRECISION DEFAULT 0
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  tenant_id UUID,
  document_title TEXT,
  chunk_index INTEGER,
  content TEXT,
  metadata JSONB,
  similarity DOUBLE PRECISION
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
  SELECT
    c.id AS chunk_id,
    c.document_id,
    c.tenant_id,
    d.title AS document_title,
    c.chunk_index,
    c.content,
    c.metadata,
    1 - (c.embedding <=> p_query_embedding) AS similarity
  FROM public.bloom_knowledge_chunks c
  JOIN public.bloom_knowledge_documents d
    ON d.id = c.document_id
   AND d.tenant_id = c.tenant_id
  WHERE c.tenant_id = p_tenant_id
    AND d.status = 'ready'
    AND (
      auth.role() = 'service_role'
      OR EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.tenant_id = p_tenant_id
      )
    )
    AND 1 - (c.embedding <=> p_query_embedding) >= COALESCE(p_min_similarity, 0)
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT LEAST(GREATEST(COALESCE(p_match_count, 5), 1), 20);
$function$;

REVOKE ALL ON FUNCTION public.match_bloom_knowledge_chunks(UUID, vector, INTEGER, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_bloom_knowledge_chunks(UUID, vector, INTEGER, DOUBLE PRECISION) TO authenticated, service_role;