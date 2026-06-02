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
      JOIN public.bloom_conversations c
        ON c.tenant_id = u.tenant_id
       AND c.user_id = u.id
      WHERE u.id = auth.uid()
        AND u.tenant_id::text = (storage.foldername(name))[1]
        AND c.id::text = (storage.foldername(name))[2]
    )
  );

DROP POLICY IF EXISTS "Tenant users can read Bloom attachments" ON storage.objects;
CREATE POLICY "Tenant users can read Bloom attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'bloom-uploads'
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id::text = (storage.foldername(name))[1]
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
      JOIN public.bloom_conversations c
        ON c.tenant_id = u.tenant_id
       AND c.user_id = u.id
      WHERE u.id = auth.uid()
        AND u.tenant_id::text = (storage.foldername(name))[1]
        AND c.id::text = (storage.foldername(name))[2]
    )
  );