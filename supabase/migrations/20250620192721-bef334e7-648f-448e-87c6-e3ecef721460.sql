
-- Add 'preview' to the content_tasks status check constraint
ALTER TABLE public.content_tasks 
DROP CONSTRAINT IF EXISTS content_tasks_status_check;

ALTER TABLE public.content_tasks 
ADD CONSTRAINT content_tasks_status_check 
CHECK (status IN ('planned', 'review', 'approved', 'posted', 'rejected', 'generated', 'pending', 'preview'));

-- Now create the preview data with the correct status
-- Create a default tenant if none exists
INSERT INTO public.tenants (id, name, slug, is_active) 
SELECT 
  gen_random_uuid(),
  'Default Organization',
  'default',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenants WHERE name = 'Default Organization'
);

-- Create a user record in the public.users table if it doesn't exist
INSERT INTO public.users (
  id,
  name,
  email,
  role,
  tenant_id
) 
SELECT 
  '2e43e993-fd88-46f6-9a16-be4cc3dcfcac'::uuid,
  'Jon (Developer)',
  'jon@getclear.ca',
  'admin',
  (SELECT id FROM public.tenants WHERE name = 'Default Organization' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.users WHERE id = '2e43e993-fd88-46f6-9a16-be4cc3dcfcac'
);

-- Fix existing campaigns by setting the proper tenant_id
UPDATE public.campaigns 
SET tenant_id = (SELECT id FROM public.tenants WHERE name = 'Default Organization' LIMIT 1)
WHERE user_id = '2e43e993-fd88-46f6-9a16-be4cc3dcfcac' 
AND tenant_id IS NULL;

-- Fix existing content tasks by setting the proper tenant_id
UPDATE public.content_tasks 
SET tenant_id = (SELECT id FROM public.tenants WHERE name = 'Default Organization' LIMIT 1)
WHERE user_id = '2e43e993-fd88-46f6-9a16-be4cc3dcfcac' 
AND tenant_id IS NULL;

-- Create DEV PREVIEW campaign
INSERT INTO public.campaigns (
  title,
  theme,
  description,
  week_number,
  start_date,
  user_id,
  tenant_id,
  source,
  prompt
) 
SELECT
  'DEV PREVIEW CAMPAIGN',
  'Developer Testing Theme',
  'This is a special campaign visible only to developers for testing the preview functionality',
  99,
  CURRENT_DATE,
  '2e43e993-fd88-46f6-9a16-be4cc3dcfcac'::uuid,
  (SELECT id FROM public.tenants WHERE name = 'Default Organization' LIMIT 1),
  'developer',
  'Create preview content for testing the developer preview system'
WHERE NOT EXISTS (
  SELECT 1 FROM public.campaigns 
  WHERE title = 'DEV PREVIEW CAMPAIGN' 
  AND user_id = '2e43e993-fd88-46f6-9a16-be4cc3dcfcac'
);

-- Create preview content tasks with the now-valid 'preview' status
INSERT INTO public.content_tasks (
  campaign_id,
  post_type,
  status,
  ai_output,
  user_id,
  tenant_id,
  notes,
  hashtags,
  image_idea
) 
SELECT
  c.id,
  task_data.post_type,
  'preview'::text,
  task_data.ai_output,
  '2e43e993-fd88-46f6-9a16-be4cc3dcfcac'::uuid,
  (SELECT id FROM public.tenants WHERE name = 'Default Organization' LIMIT 1),
  'Generated from theme: Developer Testing Theme',
  task_data.hashtags,
  task_data.image_idea
FROM public.campaigns c,
(VALUES 
  ('facebook', '🌟 DEV PREVIEW: Facebook Post Content 🌟

This is a sample Facebook post that demonstrates how the preview system works. Garden centers can share seasonal tips, plant care advice, and community engagement content like this.

Perfect for testing the developer preview functionality!

#GardenCenter #Preview #Development', '#GardenCenter #Preview #Development #Plants #Gardening', 'Bright garden center display with colorful flowers'),
  
  ('instagram', '📸 DEV PREVIEW: Instagram Post 📸

Beautiful shot of our seasonal display! This preview content shows how Instagram posts will appear in the system.

✨ Engaging visual content
🌱 Plant care tips  
🏡 Garden inspiration

#GardenLife #Preview #InstagramReady', '#GardenLife #Preview #InstagramReady #Plants #Seasonal', 'Instagram-worthy garden display with perfect lighting'),

  ('blog', '# DEV PREVIEW: Blog Post Title

## Introduction
This is a preview blog post that demonstrates the blog content generation system for garden centers.

## Main Content
The blog system can generate:
- Seasonal gardening tips
- Plant care guides
- Garden design inspiration
- Product recommendations

## Conclusion
This preview content helps developers see how blog posts will appear in the content management system.', '#BlogPost #GardenTips #Preview #ContentMarketing', 'Professional garden blog header image'),

  ('video', '🎥 DEV PREVIEW: Video Script 🎥

[INTRO]
Hello garden enthusiasts! Welcome to another preview video from our garden center.

[MAIN CONTENT]
Today we are showcasing how the video script system works:
- Clear, engaging introductions
- Structured content delivery
- Call-to-action endings

[OUTRO]
Thanks for watching this preview! Subscribe for more garden tips and visit us in-store.

[TECHNICAL NOTES]
Estimated duration: 2-3 minutes
Suggested format: Vertical for social media', '#VideoContent #GardenCenter #Preview #SocialMedia', 'Garden center staff demonstrating plant care techniques'),

  ('newsletter', '📧 DEV PREVIEW: Weekly Newsletter 📧

**Subject: This Week in the Garden - Developer Preview Edition**

Dear Garden Enthusiasts,

Welcome to our preview newsletter! This sample content demonstrates how our newsletter system works.

**This Week''s Highlights:**
• Preview content generation system
• Developer testing functionality  
• Newsletter formatting examples

**Seasonal Tips:**
This section would contain relevant seasonal gardening advice based on the current time of year.

**Featured Products:**
Preview of how product recommendations would appear in newsletters.

**Community Corner:**
Space for customer stories and garden photos.

Happy Gardening!
The Garden Center Team

---
This is preview content for development purposes.', '#Newsletter #GardenCenter #Preview #WeeklyUpdate', 'Newsletter header with garden center branding')
) AS task_data(post_type, ai_output, hashtags, image_idea)
WHERE c.title = 'DEV PREVIEW CAMPAIGN' 
AND c.user_id = '2e43e993-fd88-46f6-9a16-be4cc3dcfcac'
AND NOT EXISTS (
  SELECT 1 FROM public.content_tasks 
  WHERE campaign_id = c.id 
  AND post_type = task_data.post_type
);
