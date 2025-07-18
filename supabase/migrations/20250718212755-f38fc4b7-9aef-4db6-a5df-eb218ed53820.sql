-- Create custom_segments table for user-defined customer segments
CREATE TABLE public.custom_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  customer_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_segments ENABLE ROW LEVEL SECURITY;

-- Create policies for custom segments
CREATE POLICY "Users can manage custom segments for their tenant"
ON public.custom_segments
FOR ALL
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.tenant_id = custom_segments.tenant_id 
  AND u.id = auth.uid()
));

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_custom_segments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_custom_segments_updated_at
BEFORE UPDATE ON public.custom_segments
FOR EACH ROW
EXECUTE FUNCTION public.update_custom_segments_updated_at();

-- Create user_segment_preferences table for onboarding
CREATE TABLE public.user_segment_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  tenant_id UUID NOT NULL,
  preferred_segments JSONB NOT NULL DEFAULT '[]',
  custom_segments JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_segment_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies for segment preferences
CREATE POLICY "Users can manage their own segment preferences"
ON public.user_segment_preferences
FOR ALL
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_user_segment_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;