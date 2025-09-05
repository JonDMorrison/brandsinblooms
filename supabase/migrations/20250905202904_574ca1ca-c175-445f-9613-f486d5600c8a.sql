-- Create Google Analytics settings table
CREATE TABLE public.google_analytics_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  property_id TEXT NOT NULL,
  service_account_configured BOOLEAN NOT NULL DEFAULT false,
  connection_status TEXT NOT NULL DEFAULT 'pending',
  last_test_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_analytics_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own GA settings" 
ON public.google_analytics_settings 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_ga_settings_updated_at
  BEFORE UPDATE ON public.google_analytics_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();