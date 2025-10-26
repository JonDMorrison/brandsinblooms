-- Fix SMS tasks status from 'failed' to 'review' so they appear on calendar
UPDATE content_tasks 
SET status = 'review' 
WHERE post_type = 'sms' 
  AND status = 'failed';