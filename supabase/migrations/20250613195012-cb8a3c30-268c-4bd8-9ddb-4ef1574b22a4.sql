
-- Create templates table
CREATE TABLE public.content_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  type TEXT NOT NULL DEFAULT 'social_post',
  tags TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create assets table
CREATE TABLE public.content_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  dimensions TEXT,
  duration TEXT,
  tags TEXT[] DEFAULT '{}',
  file_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on templates
ALTER TABLE public.content_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for templates
CREATE POLICY "Users can view their own templates" 
  ON public.content_templates 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own templates" 
  ON public.content_templates 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates" 
  ON public.content_templates 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates" 
  ON public.content_templates 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Enable RLS on assets
ALTER TABLE public.content_assets ENABLE ROW LEVEL SECURITY;

-- Create policies for assets
CREATE POLICY "Users can view their own assets" 
  ON public.content_assets 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own assets" 
  ON public.content_assets 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assets" 
  ON public.content_assets 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assets" 
  ON public.content_assets 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create storage bucket for content assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('content-assets', 'content-assets', true);

-- Create storage policies for the bucket
CREATE POLICY "Users can view their own content assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'content-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own content assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'content-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own content assets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'content-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own content assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'content-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create function to update template usage count
CREATE OR REPLACE FUNCTION public.increment_template_usage(template_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.content_templates 
  SET usage_count = usage_count + 1, updated_at = now()
  WHERE id = template_id AND user_id = auth.uid();
$$;

-- Create trigger to update updated_at on templates
CREATE OR REPLACE FUNCTION update_content_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_content_templates_updated_at
  BEFORE UPDATE ON public.content_templates
  FOR EACH ROW EXECUTE FUNCTION update_content_templates_updated_at();

-- Create trigger to update updated_at on assets
CREATE OR REPLACE FUNCTION update_content_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_content_assets_updated_at
  BEFORE UPDATE ON public.content_assets
  FOR EACH ROW EXECUTE FUNCTION update_content_assets_updated_at();
