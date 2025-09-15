-- Enable Row Level Security on app_admin_emails table
ALTER TABLE public.app_admin_emails ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for app_admin_emails table
-- Only allow super admins to manage admin emails
CREATE POLICY "Super admins can manage admin emails" 
ON public.app_admin_emails 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email IN ('jon@getclear.ca', 'jeff@brandsinblooms.com')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email IN ('jon@getclear.ca', 'jeff@brandsinblooms.com')
  )
);

-- Add a policy to allow system functions to read admin emails (for verification purposes)
CREATE POLICY "System functions can read admin emails" 
ON public.app_admin_emails 
FOR SELECT 
USING (true);

-- Note: The above SELECT policy allows system functions to verify admin status
-- This is needed for functions like admin_list_tenants, admin_get_stats, etc.
-- that need to check if the current user is an admin