-- Phase 1: Add media_urls column to SMS tables
ALTER TABLE sms_messages ADD COLUMN media_urls jsonb DEFAULT '[]'::jsonb;
ALTER TABLE crm_sms_campaigns ADD COLUMN media_urls jsonb DEFAULT '[]'::jsonb;

-- Phase 2: Create media-mms storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('media-mms', 'media-mms', true);

-- Phase 3: Create storage policies for media-mms bucket
CREATE POLICY "Users can upload media files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'media-mms' AND auth.uid() IS NOT NULL);

CREATE POLICY "Media files are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'media-mms');

CREATE POLICY "Users can update their own media files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'media-mms' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own media files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'media-mms' AND auth.uid() IS NOT NULL);

-- Phase 4: Migrate existing image_url data to media_urls format
UPDATE sms_messages 
SET media_urls = CASE 
  WHEN (SELECT image_url FROM content_tasks WHERE content_tasks.id = sms_messages.customer_id) IS NOT NULL 
  THEN jsonb_build_array((SELECT image_url FROM content_tasks WHERE content_tasks.id = sms_messages.customer_id))
  ELSE '[]'::jsonb
END;

UPDATE crm_sms_campaigns 
SET media_urls = CASE 
  WHEN image_url IS NOT NULL 
  THEN jsonb_build_array(image_url)
  ELSE '[]'::jsonb
END;