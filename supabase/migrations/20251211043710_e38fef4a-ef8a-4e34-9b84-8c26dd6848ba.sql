-- Create assets bucket for social icons and other static assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public read access to assets bucket
CREATE POLICY "Public read access for assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'assets');

-- Allow authenticated users to upload to assets bucket
CREATE POLICY "Authenticated users can upload assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'assets' AND auth.role() = 'authenticated');

-- Allow service role to manage assets
CREATE POLICY "Service role can manage assets"
ON storage.objects FOR ALL
USING (bucket_id = 'assets')
WITH CHECK (bucket_id = 'assets');