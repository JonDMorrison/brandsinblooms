-- Create saved campaign templates table for storing user-saved block layouts
CREATE TABLE public.saved_campaign_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  layout_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  thumbnail_url TEXT,
  category TEXT DEFAULT 'general',
  usage_count INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_campaign_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own saved templates"
ON public.saved_campaign_templates
FOR ALL
USING (auth.uid() = user_id);

-- Create trigger for updated_at using existing function
CREATE TRIGGER update_saved_campaign_templates_updated_at
  BEFORE UPDATE ON public.saved_campaign_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_campaign_blocks_updated_at();