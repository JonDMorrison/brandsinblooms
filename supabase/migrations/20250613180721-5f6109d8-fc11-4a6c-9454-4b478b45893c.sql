
-- Create table for storing social media account connections
CREATE TABLE public.social_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'google_my_business')),
  platform_account_id TEXT NOT NULL,
  platform_account_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform, platform_account_id)
);

-- Create table for storing analytics data from external platforms
CREATE TABLE public.analytics_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.social_connections(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL, -- 'reach', 'engagement', 'impressions', 'clicks', 'views', 'calls'
  metric_value INTEGER NOT NULL,
  date_collected DATE NOT NULL,
  metadata JSONB, -- Additional platform-specific data
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(connection_id, metric_type, date_collected)
);

-- Create table for analytics settings and preferences
CREATE TABLE public.analytics_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  auto_sync_enabled BOOLEAN NOT NULL DEFAULT true,
  sync_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (sync_frequency IN ('daily', 'weekly')),
  email_reports_enabled BOOLEAN NOT NULL DEFAULT true,
  email_frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (email_frequency IN ('weekly', 'monthly')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for social_connections
CREATE POLICY "Users can manage their own social connections" 
  ON public.social_connections 
  FOR ALL 
  USING (auth.uid()::text = user_id::text);

-- RLS policies for analytics_data
CREATE POLICY "Users can view their own analytics data" 
  ON public.analytics_data 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.social_connections 
    WHERE id = analytics_data.connection_id 
    AND user_id::text = auth.uid()::text
  ));

CREATE POLICY "System can insert analytics data" 
  ON public.analytics_data 
  FOR INSERT 
  WITH CHECK (true);

-- RLS policies for analytics_settings
CREATE POLICY "Users can manage their own analytics settings" 
  ON public.analytics_settings 
  FOR ALL 
  USING (auth.uid()::text = user_id::text);

-- Create trigger to update timestamps
CREATE OR REPLACE FUNCTION public.update_analytics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_social_connections_updated_at
  BEFORE UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_analytics_updated_at();

CREATE TRIGGER update_analytics_settings_updated_at
  BEFORE UPDATE ON public.analytics_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_analytics_updated_at();
