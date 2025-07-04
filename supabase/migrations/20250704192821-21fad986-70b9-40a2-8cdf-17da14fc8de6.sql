-- Clean up test/demo content that new users are seeing
-- Remove approved content tasks that don't belong to users who have completed onboarding

-- First, identify and remove content tasks that are 'approved' but belong to 
-- campaigns or users that shouldn't have pre-approved content
DELETE FROM content_tasks 
WHERE status = 'approved' 
AND (
  -- Remove tasks where the campaign doesn't belong to the task user
  campaign_id IN (
    SELECT c.id FROM campaigns c 
    JOIN content_tasks ct ON ct.campaign_id = c.id 
    WHERE c.user_id != ct.user_id
  )
  OR
  -- Remove tasks from users who haven't properly completed onboarding
  user_id NOT IN (
    SELECT cp.user_id FROM company_profiles cp 
    WHERE cp.onboarding_completed_at IS NOT NULL 
    AND cp.company_name IS NOT NULL
  )
);

-- Remove orphaned campaigns that don't have proper user ownership
DELETE FROM campaigns 
WHERE user_id NOT IN (
  SELECT cp.user_id FROM company_profiles cp 
  WHERE cp.onboarding_completed_at IS NOT NULL
  AND cp.company_name IS NOT NULL
)
AND created_at > '2025-07-01'::timestamp; -- Only remove recent test data

-- Add a check constraint to prevent future issues
-- Ensure content_tasks can only be 'approved' if the user has completed onboarding
-- (We'll do this through application logic rather than DB constraint for flexibility)