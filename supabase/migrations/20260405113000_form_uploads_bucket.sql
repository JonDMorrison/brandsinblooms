INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'form-uploads',
  'form-uploads',
  false,
  26214400
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = 26214400;

DROP POLICY IF EXISTS "Public temp uploads for published forms" ON storage.objects;
CREATE POLICY "Public temp uploads for published forms"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'form-uploads' AND
    (storage.foldername(name))[1] = 'temp' AND
    EXISTS (
      SELECT 1
      FROM public.forms f
      WHERE f.embed_key = (storage.foldername(name))[2]
        AND f.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Tenant users can read finalized form uploads" ON storage.objects;
CREATE POLICY "Tenant users can read finalized form uploads"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'form-uploads' AND
    (storage.foldername(name))[1] = 'tenants' AND
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id::text = (storage.foldername(name))[2]
    )
  );