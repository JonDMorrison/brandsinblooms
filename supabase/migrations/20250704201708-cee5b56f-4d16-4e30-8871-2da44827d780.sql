-- Final cleanup - remove ALL approved tasks for cleaner testing
-- This removes all approved content to prevent data leakage to new users

DELETE FROM content_tasks 
WHERE status = 'approved';