-- Create storage bucket for company assets (logos, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for authenticated users to upload their own assets
CREATE POLICY "Users can upload their own company assets"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'company-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create policy for authenticated users to update their own assets
CREATE POLICY "Users can update their own company assets"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'company-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create policy for public read access to company assets
CREATE POLICY "Company assets are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'company-assets');

-- Create policy for users to delete their own assets
CREATE POLICY "Users can delete their own company assets"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'company-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);