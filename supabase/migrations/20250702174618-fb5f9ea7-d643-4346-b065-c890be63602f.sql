-- Remove the overly permissive policy that allows all operations
DROP POLICY IF EXISTS "Allow all operations on content_tasks" ON content_tasks;

-- Create a proper SELECT policy that respects user/tenant boundaries
CREATE POLICY "Users can view their own content tasks" 
ON content_tasks 
FOR SELECT 
USING (
  -- User owns the task directly
  auth.uid() = user_id 
  OR 
  -- User owns the campaign this task belongs to
  (campaign_id IN (
    SELECT id FROM campaigns 
    WHERE user_id = auth.uid()
  ))
  OR
  -- For tenant model: user belongs to same tenant
  (tenant_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM users u 
    WHERE u.tenant_id = content_tasks.tenant_id 
    AND u.id = auth.uid()
  ))
);