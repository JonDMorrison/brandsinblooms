-- Migration: Clean up failed and orphaned content tasks
-- Purpose: Remove failed content generation attempts and tasks with missing tenant_id
-- Date: 2025-01-10

-- Step 1: Delete failed tasks from the last 7 days
-- These are likely corrupted from the content generation bug
DELETE FROM content_tasks 
WHERE status = 'failed' 
  AND created_at > NOW() - INTERVAL '7 days';

-- Step 2: Delete tasks with NULL tenant_id (data integrity issue)
-- These violate multi-tenant isolation and should never exist
DELETE FROM content_tasks 
WHERE tenant_id IS NULL 
  AND created_at > NOW() - INTERVAL '30 days';

-- Step 3: Add helpful comment for future developers
COMMENT ON COLUMN content_tasks.tenant_id IS 
  'CRITICAL: tenant_id must NEVER be NULL. This column enforces multi-tenant data isolation.';