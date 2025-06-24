
-- Add deleted_at columns to key tables for soft delete functionality
ALTER TABLE company_profiles ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE social_connections ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE content_tasks ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE campaigns ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE subscriptions ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE social_posts ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Create deletion_requests table to track deletion jobs and grace period
CREATE TABLE public.deletion_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scheduled_hard_delete_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  email_sent BOOLEAN DEFAULT false,
  hard_delete_completed_at TIMESTAMP WITH TIME ZONE,
  cancellation_requested_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for deletion_requests
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deletion requests"
  ON public.deletion_requests
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deletion requests"
  ON public.deletion_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance on soft delete queries
CREATE INDEX idx_company_profiles_deleted_at ON company_profiles(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_social_connections_deleted_at ON social_connections(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_content_tasks_deleted_at ON content_tasks(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_deleted_at ON campaigns(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_deletion_requests_status ON deletion_requests(status, scheduled_hard_delete_at);

-- Function to soft delete user data
CREATE OR REPLACE FUNCTION public.soft_delete_user_data(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deletion_time TIMESTAMP WITH TIME ZONE := now();
BEGIN
  -- Soft delete user data across all tables
  UPDATE public.company_profiles 
  SET deleted_at = deletion_time 
  WHERE user_id = target_user_id AND deleted_at IS NULL;
  
  UPDATE public.social_connections 
  SET deleted_at = deletion_time 
  WHERE user_id = target_user_id AND deleted_at IS NULL;
  
  UPDATE public.content_tasks 
  SET deleted_at = deletion_time 
  WHERE user_id = target_user_id AND deleted_at IS NULL;
  
  UPDATE public.campaigns 
  SET deleted_at = deletion_time 
  WHERE user_id = target_user_id AND deleted_at IS NULL;
  
  UPDATE public.subscriptions 
  SET deleted_at = deletion_time 
  WHERE user_id = target_user_id AND deleted_at IS NULL;
  
  UPDATE public.social_posts 
  SET deleted_at = deletion_time 
  WHERE user_id = target_user_id AND deleted_at IS NULL;
  
  RETURN TRUE;
END;
$$;

-- Function to restore soft deleted user data (for reactivation)
CREATE OR REPLACE FUNCTION public.restore_user_data(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Restore user data by clearing deleted_at timestamps
  UPDATE public.company_profiles 
  SET deleted_at = NULL 
  WHERE user_id = target_user_id AND deleted_at IS NOT NULL;
  
  UPDATE public.social_connections 
  SET deleted_at = NULL 
  WHERE user_id = target_user_id AND deleted_at IS NOT NULL;
  
  UPDATE public.content_tasks 
  SET deleted_at = NULL 
  WHERE user_id = target_user_id AND deleted_at IS NOT NULL;
  
  UPDATE public.campaigns 
  SET deleted_at = NULL 
  WHERE user_id = target_user_id AND deleted_at IS NOT NULL;
  
  UPDATE public.subscriptions 
  SET deleted_at = NULL 
  WHERE user_id = target_user_id AND deleted_at IS NOT NULL;
  
  UPDATE public.social_posts 
  SET deleted_at = NULL 
  WHERE user_id = target_user_id AND deleted_at IS NOT NULL;
  
  RETURN TRUE;
END;
$$;
