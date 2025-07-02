-- Clean up Lorem Picsum placeholder URLs and replace with garden center context
-- This fixes the persistent inappropriate image issue

-- Step 1: Remove all Lorem Picsum image suggestions (these cause random irrelevant images)
DELETE FROM public.image_suggestions 
WHERE thumb_url LIKE '%picsum.photos%' 
   OR download_url LIKE '%picsum.photos%'
   OR photographer = 'Lorem Picsum';

-- Step 2: Clear any existing image URLs in content_tasks that reference Lorem Picsum
UPDATE public.content_tasks 
SET 
  image_url = NULL,
  image_idea = CASE 
    WHEN image_idea LIKE '%picsum.photos%' THEN NULL 
    ELSE image_idea 
  END
WHERE image_url LIKE '%picsum.photos%' 
   OR image_idea LIKE '%picsum.photos%';

-- Step 3: Clear any Lorem Picsum URLs from image_assets table
UPDATE public.image_assets 
SET 
  original_url = NULL,
  processed_url = NULL,
  thumbnail_url = NULL,
  processing_status = 'failed',
  processing_error = 'Replaced inappropriate Lorem Picsum placeholder'
WHERE original_url LIKE '%picsum.photos%' 
   OR processed_url LIKE '%picsum.photos%'
   OR thumbnail_url LIKE '%picsum.photos%';

-- Step 4: Add a check to prevent future Lorem Picsum URLs
ALTER TABLE public.image_suggestions 
ADD CONSTRAINT no_lorem_picsum_urls 
CHECK (
  thumb_url NOT LIKE '%picsum.photos%' AND 
  download_url NOT LIKE '%picsum.photos%'
);

-- Log the cleanup
INSERT INTO public.token_usage (
  user_id, 
  action_type, 
  tokens_consumed, 
  tokens_remaining,
  metadata
) 
SELECT 
  cp.user_id,
  'image_cleanup',
  0,
  cp.tokens_balance,
  jsonb_build_object(
    'cleanup_type', 'remove_lorem_picsum',
    'cleanup_at', now(),
    'reason', 'Replace inappropriate random images with garden center context'
  )
FROM public.company_profiles cp
WHERE cp.user_id IS NOT NULL
LIMIT 1; -- Only log once for the system