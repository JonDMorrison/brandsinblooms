-- Create public bucket for AI-generated campaign images
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-images', 'campaign-images', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access for campaign images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own campaign images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own campaign images" ON storage.objects;

-- Allow public read access
CREATE POLICY "Public read access for campaign images"
ON storage.objects FOR SELECT
USING (bucket_id = 'campaign-images');

-- Allow authenticated users to upload their own images
CREATE POLICY "Users can upload their own campaign images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'campaign-images' 
  AND auth.uid() IS NOT NULL
);

-- Allow users to delete their own images
CREATE POLICY "Users can delete their own campaign images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'campaign-images' 
  AND auth.uid() IS NOT NULL
);