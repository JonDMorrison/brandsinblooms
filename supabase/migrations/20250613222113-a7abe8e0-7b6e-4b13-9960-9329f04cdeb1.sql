
-- First, delete token usage records that reference campaigns
DELETE FROM public.token_usage WHERE campaign_id IS NOT NULL;

-- Then delete content tasks that reference campaigns  
DELETE FROM public.content_tasks;

-- Then delete campaigns
DELETE FROM public.campaigns;

-- Add user_id column to campaigns table
ALTER TABLE public.campaigns ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable Row Level Security on campaigns table
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own campaigns
CREATE POLICY "Users can view their own campaigns" ON public.campaigns
  FOR SELECT USING (auth.uid() = user_id);

-- Create policy for users to insert their own campaigns
CREATE POLICY "Users can insert their own campaigns" ON public.campaigns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update their own campaigns
CREATE POLICY "Users can update their own campaigns" ON public.campaigns
  FOR UPDATE USING (auth.uid() = user_id);

-- Create policy for users to delete their own campaigns
CREATE POLICY "Users can delete their own campaigns" ON public.campaigns
  FOR DELETE USING (auth.uid() = user_id);
