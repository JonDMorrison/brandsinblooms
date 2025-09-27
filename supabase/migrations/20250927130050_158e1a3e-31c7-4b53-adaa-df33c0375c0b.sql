-- Fix database schema issues causing generation timeouts

-- Add missing description column to company_profiles table
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS description TEXT;

-- Add missing layout_settings column to campaign_blocks table  
ALTER TABLE campaign_blocks ADD COLUMN IF NOT EXISTS layout_settings JSONB DEFAULT '{}'::jsonb;

-- Fix content_tasks status constraint with actual values being used
ALTER TABLE content_tasks DROP CONSTRAINT IF EXISTS content_tasks_status_check;

-- Add proper status constraint that matches the actual data
ALTER TABLE content_tasks ADD CONSTRAINT content_tasks_status_check 
  CHECK (status IN ('planned', 'pending', 'review', 'approved', 'posted', 'failed', 'draft', 'preview', 'generating', 'generated', 'scheduled', 'needs_review', 'in_progress'));