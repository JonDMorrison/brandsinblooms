-- Fix SMS tasks that were incorrectly marked as 'failed' by the watchdog
-- SMS tasks don't need images, so they shouldn't be failed for missing image_url

UPDATE content_tasks
SET 
  status = 'review',
  notes = COALESCE(notes, '') || ' [Auto-fixed: SMS tasks do not require images]'
WHERE 
  post_type = 'sms'
  AND status = 'failed'
  AND ai_output IS NOT NULL
  AND ai_output != ''
  AND plan_id IS NOT NULL;

-- Add a comment to document this fix
COMMENT ON TABLE content_tasks IS 'Content tasks table. Note: SMS and newsletter post types do not require image_url and should not be marked as failed for missing images.';