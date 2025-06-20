
-- Remove any existing email content from content_tasks
DELETE FROM public.content_tasks 
WHERE post_type = 'email';

-- Clean up any other unwanted post types that might exist
-- Keep only: instagram, facebook, newsletter, blog, video
DELETE FROM public.content_tasks 
WHERE post_type NOT IN ('instagram', 'facebook', 'newsletter', 'blog', 'video');
