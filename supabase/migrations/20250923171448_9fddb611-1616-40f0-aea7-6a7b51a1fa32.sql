-- Create storage bucket for content thumbnails
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('content-thumbnails', 'content-thumbnails', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp']);

-- Create RLS policies for content thumbnails
CREATE POLICY "Content thumbnails are publicly viewable" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'content-thumbnails');

CREATE POLICY "Authenticated users can upload content thumbnails" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'content-thumbnails' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their content thumbnails" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'content-thumbnails' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their content thumbnails" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'content-thumbnails' AND auth.role() = 'authenticated');