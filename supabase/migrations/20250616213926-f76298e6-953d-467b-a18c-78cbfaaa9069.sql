
-- Create image_suggestions table to store Unsplash images for content tasks
CREATE TABLE public.image_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_task_id UUID REFERENCES public.content_tasks(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  thumb_url TEXT NOT NULL,
  download_url TEXT NOT NULL,
  alt TEXT,
  photographer TEXT NOT NULL,
  unsplash_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS)
ALTER TABLE public.image_suggestions ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view images for their content tasks
CREATE POLICY "Users can view image suggestions for their content tasks" 
  ON public.image_suggestions 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.content_tasks ct
      JOIN public.campaigns c ON ct.campaign_id = c.id
      WHERE ct.id = content_task_id AND c.user_id = auth.uid()
    )
  );

-- Create policy for inserting image suggestions
CREATE POLICY "System can insert image suggestions" 
  ON public.image_suggestions 
  FOR INSERT 
  WITH CHECK (true);

-- Create policy for updating image suggestions
CREATE POLICY "Users can update image suggestions for their content tasks" 
  ON public.image_suggestions 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.content_tasks ct
      JOIN public.campaigns c ON ct.campaign_id = c.id
      WHERE ct.id = content_task_id AND c.user_id = auth.uid()
    )
  );

-- Create policy for deleting image suggestions
CREATE POLICY "Users can delete image suggestions for their content tasks" 
  ON public.image_suggestions 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.content_tasks ct
      JOIN public.campaigns c ON ct.campaign_id = c.id
      WHERE ct.id = content_task_id AND c.user_id = auth.uid()
    )
  );

-- Create index for performance
CREATE INDEX idx_image_suggestions_content_task_id ON public.image_suggestions(content_task_id);

-- Add favorite_image_id column to content_assets table to track favorited images
ALTER TABLE public.content_assets ADD COLUMN IF NOT EXISTS unsplash_id TEXT;
ALTER TABLE public.content_assets ADD COLUMN IF NOT EXISTS photographer TEXT;
