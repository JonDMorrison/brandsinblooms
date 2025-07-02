-- Phase 4: Enhanced Image Management Database Schema (Fixed)

-- Add proper image fields to content_tasks table
ALTER TABLE public.content_tasks 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_source TEXT CHECK (image_source IN ('unsplash', 'upload', 'url')),
ADD COLUMN IF NOT EXISTS image_metadata JSONB DEFAULT '{}'::jsonb;

-- Update existing image_idea column to be more descriptive
COMMENT ON COLUMN public.content_tasks.image_idea IS 'Legacy field for image descriptions or temporary URLs';
COMMENT ON COLUMN public.content_tasks.image_url IS 'Primary image URL for the content';
COMMENT ON COLUMN public.content_tasks.image_source IS 'Source of the image: unsplash, upload, or url';
COMMENT ON COLUMN public.content_tasks.image_metadata IS 'Image metadata including alt text, photographer, dimensions, etc.';

-- Create image_assets table for comprehensive image management
CREATE TABLE IF NOT EXISTS public.image_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_task_id UUID REFERENCES public.content_tasks(id) ON DELETE SET NULL,
  
  -- Image details
  original_url TEXT NOT NULL,
  processed_url TEXT,
  thumbnail_url TEXT,
  
  -- Source and metadata
  source_type TEXT NOT NULL CHECK (source_type IN ('unsplash', 'upload', 'url', 'generated')),
  file_name TEXT,
  file_size BIGINT,
  mime_type TEXT,
  dimensions JSONB, -- {width: 1200, height: 800}
  
  -- Unsplash specific
  unsplash_id TEXT,
  photographer_name TEXT,
  photographer_url TEXT,
  
  -- Content metadata
  alt_text TEXT,
  description TEXT,
  tags TEXT[],
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  -- Processing status
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_error TEXT,
  
  -- Optimization data
  optimization_applied BOOLEAN DEFAULT false,
  original_size BIGINT,
  compressed_size BIGINT,
  compression_ratio NUMERIC(5,2),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for image_assets
ALTER TABLE public.image_assets ENABLE ROW LEVEL SECURITY;

-- RLS policies for image_assets
CREATE POLICY "Users can create their own image assets" 
ON public.image_assets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own image assets" 
ON public.image_assets 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own image assets" 
ON public.image_assets 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own image assets" 
ON public.image_assets 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_image_assets_user_id ON public.image_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_image_assets_content_task_id ON public.image_assets(content_task_id);
CREATE INDEX IF NOT EXISTS idx_image_assets_source_type ON public.image_assets(source_type);
CREATE INDEX IF NOT EXISTS idx_image_assets_unsplash_id ON public.image_assets(unsplash_id);
CREATE INDEX IF NOT EXISTS idx_image_assets_usage_count ON public.image_assets(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_content_tasks_image_source ON public.content_tasks(image_source);

-- Create function to update image usage
CREATE OR REPLACE FUNCTION public.increment_image_usage(asset_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.image_assets 
  SET 
    usage_count = usage_count + 1,
    last_used_at = now(),
    updated_at = now()
  WHERE id = asset_id AND user_id = auth.uid();
$$;

-- Create function to track image optimization
CREATE OR REPLACE FUNCTION public.track_image_optimization(
  asset_id UUID,
  original_size_bytes BIGINT,
  compressed_size_bytes BIGINT
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.image_assets 
  SET 
    optimization_applied = true,
    original_size = original_size_bytes,
    compressed_size = compressed_size_bytes,
    compression_ratio = ROUND((original_size_bytes::numeric - compressed_size_bytes::numeric) / original_size_bytes::numeric * 100, 2),
    updated_at = now()
  WHERE id = asset_id AND user_id = auth.uid();
$$;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_image_assets_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_image_assets_updated_at
  BEFORE UPDATE ON public.image_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_image_assets_updated_at();

-- Create function to get user image analytics (replaces view for RLS compatibility)
CREATE OR REPLACE FUNCTION public.get_user_image_analytics()
RETURNS TABLE (
  source_type TEXT,
  total_images BIGINT,
  total_usage BIGINT,
  avg_usage_per_image NUMERIC,
  optimized_images BIGINT,
  avg_compression_ratio NUMERIC,
  total_original_size BIGINT,
  total_compressed_size BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    ia.source_type,
    COUNT(*) as total_images,
    SUM(ia.usage_count) as total_usage,
    AVG(ia.usage_count) as avg_usage_per_image,
    SUM(CASE WHEN ia.optimization_applied THEN 1 ELSE 0 END) as optimized_images,
    AVG(ia.compression_ratio) as avg_compression_ratio,
    SUM(ia.original_size) as total_original_size,
    SUM(ia.compressed_size) as total_compressed_size
  FROM public.image_assets ia
  WHERE ia.user_id = auth.uid()
  GROUP BY ia.source_type;
$$;