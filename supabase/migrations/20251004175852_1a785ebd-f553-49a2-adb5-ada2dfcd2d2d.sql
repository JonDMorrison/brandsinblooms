-- Add image generation tracking columns to content_tasks
ALTER TABLE content_tasks 
ADD COLUMN IF NOT EXISTS image_generation_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS image_generation_error TEXT,
ADD COLUMN IF NOT EXISTS image_generated_at TIMESTAMPTZ;

-- Create storage bucket for AI-generated images
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-generated-images', 'ai-generated-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the bucket
CREATE POLICY "Users can view AI generated images"
ON storage.objects FOR SELECT
USING (bucket_id = 'ai-generated-images');

CREATE POLICY "Users can upload their own AI generated images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'ai-generated-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own AI generated images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'ai-generated-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);