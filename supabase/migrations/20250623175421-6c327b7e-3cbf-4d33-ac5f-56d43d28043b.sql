
-- Create social connections table for Meta (Facebook/Instagram) integration
CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  social_connection_id UUID REFERENCES public.social_connections NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'published', 'failed')),
  publish_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  api_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for social posts
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own social posts" 
  ON public.social_posts 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own social posts" 
  ON public.social_posts 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own social posts" 
  ON public.social_posts 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social posts" 
  ON public.social_posts 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Add feature flags to company profiles
ALTER TABLE public.company_profiles 
ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{"social_posting_v1": true, "scheduling_v1": false, "analytics_v1": false}'::jsonb;

-- Add plan information to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS max_connections INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS max_posts_per_month INTEGER DEFAULT 200;

-- Update social_connections table to include page_id
ALTER TABLE public.social_connections 
ADD COLUMN IF NOT EXISTS page_id TEXT;

-- Create function to check feature flags
CREATE OR REPLACE FUNCTION public.feature_enabled(feature_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (cp.feature_flags ->> feature_name)::boolean, 
    false
  )
  FROM public.company_profiles cp
  WHERE cp.user_id = auth.uid();
$$;

-- Create trigger for social_posts updated_at
CREATE OR REPLACE FUNCTION public.update_social_posts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER social_posts_updated_at
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_social_posts_updated_at();
