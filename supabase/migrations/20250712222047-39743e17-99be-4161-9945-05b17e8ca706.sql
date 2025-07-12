-- Add composite indexes for better query performance on frequently accessed tables
-- Note: Regular CREATE INDEX (not CONCURRENTLY) for migration compatibility

-- Index for content_tasks queries (user_id + status + tenant_id)
CREATE INDEX IF NOT EXISTS idx_content_tasks_user_status_tenant 
ON content_tasks (user_id, status, tenant_id) 
WHERE deleted_at IS NULL;

-- Index for content_tasks by created_at for ordering
CREATE INDEX IF NOT EXISTS idx_content_tasks_created_at 
ON content_tasks (created_at DESC) 
WHERE deleted_at IS NULL;

-- Index for campaigns by user and tenant
CREATE INDEX IF NOT EXISTS idx_campaigns_user_tenant_created 
ON campaigns (user_id, tenant_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Index for scheduled_posts by user and publish_at
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_publish 
ON scheduled_posts (user_id, publish_at);

-- Index for social_connections by user and active status
CREATE INDEX IF NOT EXISTS idx_social_connections_user_active 
ON social_connections (user_id, is_active) 
WHERE deleted_at IS NULL;

-- Index for company_profiles by user_id (should be unique but adding for performance)
CREATE INDEX IF NOT EXISTS idx_company_profiles_user 
ON company_profiles (user_id) 
WHERE deleted_at IS NULL;