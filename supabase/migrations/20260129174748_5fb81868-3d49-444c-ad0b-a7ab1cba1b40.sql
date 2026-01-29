-- Create or ensure the 'assets' bucket exists and is public
-- This bucket hosts embed.js, embed.css for third-party website embedding

INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public read access to all files in the assets bucket
CREATE POLICY "Public read access for assets bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'assets');

-- Allow authenticated users to upload to assets bucket (admin only pattern)
-- This can be further restricted by adding role checks
CREATE POLICY "Authenticated users can upload to assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'assets');

-- Allow authenticated users to update their uploads in assets bucket
CREATE POLICY "Authenticated users can update assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'assets');

-- Allow authenticated users to delete from assets bucket
CREATE POLICY "Authenticated users can delete assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'assets');