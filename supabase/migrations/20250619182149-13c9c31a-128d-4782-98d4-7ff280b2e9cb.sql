
-- Delete any existing LinkedIn posts from content_tasks
DELETE FROM public.content_tasks 
WHERE post_type = 'linkedin';

-- Also clean up any other unwanted post types that might exist
-- Keep only: instagram, facebook, newsletter, email, blog, video
DELETE FROM public.content_tasks 
WHERE post_type NOT IN ('instagram', 'facebook', 'newsletter', 'email', 'blog', 'video');
