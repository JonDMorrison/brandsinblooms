-- Add 'sms' to allowed post_type values in content_tasks table
ALTER TABLE content_tasks 
DROP CONSTRAINT IF EXISTS content_tasks_post_type_check;

ALTER TABLE content_tasks 
ADD CONSTRAINT content_tasks_post_type_check 
CHECK (post_type = ANY (ARRAY['instagram'::text, 'facebook'::text, 'email'::text, 'newsletter'::text, 'video'::text, 'twitter'::text, 'linkedin'::text, 'blog'::text, 'tiktok'::text, 'sms'::text]));