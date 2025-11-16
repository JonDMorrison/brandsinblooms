-- Add RLS policy to allow authenticated users to check if they're admins
-- This is safe because the table only contains email addresses for admin verification

CREATE POLICY "Allow authenticated users to check admin status"
ON app_admin_emails
FOR SELECT
TO authenticated
USING (true);

-- Add comment explaining the policy
COMMENT ON POLICY "Allow authenticated users to check admin status" ON app_admin_emails IS 
'Allows any authenticated user to read from app_admin_emails to verify their admin status. This is required for the useIsSuperAdmin hook to work correctly.';