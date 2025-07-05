-- Add missing fields to social_posts table to support the Unsplash → Meta pipeline

-- Add new columns to social_posts table
ALTER TABLE public.social_posts 
ADD COLUMN IF NOT EXISTS platform_post_id TEXT,
ADD COLUMN IF NOT EXISTS platform_post_url TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS content_id UUID,
ADD COLUMN IF NOT EXISTS platform TEXT,
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add foreign key constraint for content_id referencing content_tasks
ALTER TABLE public.social_posts 
ADD CONSTRAINT fk_social_posts_content_id 
FOREIGN KEY (content_id) REFERENCES public.content_tasks(id) ON DELETE CASCADE;

-- Create index for better performance on lookups
CREATE INDEX IF NOT EXISTS idx_social_posts_content_id ON public.social_posts(content_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform_post_id ON public.social_posts(platform_post_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON public.social_posts(platform);

-- Add comments for documentation
COMMENT ON COLUMN public.social_posts.platform_post_id IS 'The ID of the post on the social media platform (Facebook post ID, Instagram media ID)';
COMMENT ON COLUMN public.social_posts.platform_post_url IS 'The direct URL to the post on the social media platform';
COMMENT ON COLUMN public.social_posts.image_url IS 'URL of the image attached to the post (from Unsplash or manual upload)';
COMMENT ON COLUMN public.social_posts.published_at IS 'Timestamp when the post was actually published to the platform';
COMMENT ON COLUMN public.social_posts.content_id IS 'Reference to the content_tasks table entry';
COMMENT ON COLUMN public.social_posts.platform IS 'Social media platform (FACEBOOK, INSTAGRAM)';
COMMENT ON COLUMN public.social_posts.error_message IS 'Error message if posting failed';