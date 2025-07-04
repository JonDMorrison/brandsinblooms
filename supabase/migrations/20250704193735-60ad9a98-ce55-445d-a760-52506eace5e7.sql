-- Fix the foreign key constraint issue by deleting content_tasks first, then campaigns
-- Final cleanup of test/demo content that's still showing to new users

-- First, delete content_tasks from test accounts and unapproved users
DELETE FROM content_tasks 
WHERE status = 'approved' 
AND user_id NOT IN (
  -- Only keep approved content from users who:
  -- 1. Have completed onboarding  
  -- 2. Have a proper company profile
  -- 3. Are not test accounts
  SELECT cp.user_id 
  FROM company_profiles cp 
  WHERE cp.onboarding_completed_at IS NOT NULL 
  AND cp.company_name IS NOT NULL
  AND cp.company_name NOT LIKE '%Test%'
  AND cp.company_name NOT LIKE '%Demo%'
  AND cp.company_name NOT LIKE '%Platt Hill%'
  AND cp.company_name NOT LIKE '%Sunrise Garden%'
  AND cp.company_name NOT LIKE '%Minter Country%'
);

-- Then delete any remaining content_tasks that reference campaigns we want to delete
DELETE FROM content_tasks 
WHERE campaign_id IN (
  SELECT c.id FROM campaigns c
  WHERE c.user_id NOT IN (
    SELECT cp.user_id 
    FROM company_profiles cp 
    WHERE cp.onboarding_completed_at IS NOT NULL 
    AND cp.company_name IS NOT NULL
    AND cp.company_name NOT LIKE '%Test%'
    AND cp.company_name NOT LIKE '%Demo%'
    AND cp.company_name NOT LIKE '%Platt Hill%'
    AND cp.company_name NOT LIKE '%Sunrise Garden%'
    AND cp.company_name NOT LIKE '%Minter Country%'
  )
  AND c.created_at > '2025-07-01'::timestamp
);

-- Finally, clean up campaigns from test accounts
DELETE FROM campaigns 
WHERE user_id NOT IN (
  SELECT cp.user_id 
  FROM company_profiles cp 
  WHERE cp.onboarding_completed_at IS NOT NULL 
  AND cp.company_name IS NOT NULL
  AND cp.company_name NOT LIKE '%Test%'
  AND cp.company_name NOT LIKE '%Demo%'
  AND cp.company_name NOT LIKE '%Platt Hill%'
  AND cp.company_name NOT LIKE '%Sunrise Garden%'
  AND cp.company_name NOT LIKE '%Minter Country%'
)
AND created_at > '2025-07-01'::timestamp;