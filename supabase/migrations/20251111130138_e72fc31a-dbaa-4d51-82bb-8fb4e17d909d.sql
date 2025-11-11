-- ============================================================
-- CENTRALIZED IMAGE STORAGE SYSTEM
-- Phase 1: Database Schema
-- ============================================================

-- ============================================================
-- 1. GLOBAL IMAGE GALLERY (Central Image Repository)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.global_image_gallery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Storage location (SINGLE SOURCE OF TRUTH)
  storage_path TEXT NOT NULL UNIQUE,
  storage_bucket TEXT NOT NULL DEFAULT 'global-ai-images',
  public_url TEXT NOT NULL UNIQUE,
  
  -- Generation metadata
  generation_prompt TEXT NOT NULL,
  generation_model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash-image-preview',
  content_context TEXT,
  content_title TEXT,
  channel TEXT,
  
  -- Image properties
  file_size_bytes BIGINT,
  mime_type TEXT DEFAULT 'image/png',
  dimensions JSONB,
  
  -- Usage analytics
  total_usage_count INTEGER DEFAULT 0,
  unique_tenant_count INTEGER DEFAULT 0,
  first_used_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now(),
  
  -- Quality & status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_global_images_public_url ON public.global_image_gallery(public_url);
CREATE INDEX IF NOT EXISTS idx_global_images_storage_path ON public.global_image_gallery(storage_path);
CREATE INDEX IF NOT EXISTS idx_global_images_created_at ON public.global_image_gallery(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_global_images_channel ON public.global_image_gallery(channel);
CREATE INDEX IF NOT EXISTS idx_global_images_usage_count ON public.global_image_gallery(total_usage_count DESC);

-- RLS: Globally readable, service role manages
ALTER TABLE public.global_image_gallery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view global images" ON public.global_image_gallery;
CREATE POLICY "Anyone authenticated can view global images"
  ON public.global_image_gallery FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role manages global images" ON public.global_image_gallery;
CREATE POLICY "Service role manages global images"
  ON public.global_image_gallery FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Auto-update trigger
DROP TRIGGER IF EXISTS update_global_image_gallery_updated_at ON public.global_image_gallery;
CREATE TRIGGER update_global_image_gallery_updated_at
  BEFORE UPDATE ON public.global_image_gallery
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. GLOBAL IMAGE TAGS (AI-Generated Tags)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.global_image_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_id UUID NOT NULL REFERENCES public.global_image_gallery(id) ON DELETE CASCADE,
  
  -- Tag information
  tag_name TEXT NOT NULL,
  tag_category TEXT NOT NULL,
  confidence_score NUMERIC(3,2),
  
  -- Tag metadata
  generated_by TEXT DEFAULT 'openai',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Prevent duplicate tags per image
  UNIQUE(image_id, tag_name)
);

-- Indexes for fast tag searches
CREATE INDEX IF NOT EXISTS idx_image_tags_image_id ON public.global_image_tags(image_id);
CREATE INDEX IF NOT EXISTS idx_image_tags_tag_name ON public.global_image_tags(tag_name);
CREATE INDEX IF NOT EXISTS idx_image_tags_category ON public.global_image_tags(tag_category);
CREATE INDEX IF NOT EXISTS idx_image_tags_confidence ON public.global_image_tags(confidence_score DESC);

-- Composite index for tag matching (future optimization)
CREATE INDEX IF NOT EXISTS idx_image_tags_name_confidence 
  ON public.global_image_tags(tag_name, confidence_score DESC)
  WHERE confidence_score >= 0.7;

-- RLS: Globally readable
ALTER TABLE public.global_image_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view image tags" ON public.global_image_tags;
CREATE POLICY "Anyone authenticated can view image tags"
  ON public.global_image_tags FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role manages image tags" ON public.global_image_tags;
CREATE POLICY "Service role manages image tags"
  ON public.global_image_tags FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================
-- 3. IMAGE TENANT USAGE (Usage Tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.image_tenant_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_id UUID NOT NULL REFERENCES public.global_image_gallery(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Usage context
  used_in_context TEXT,
  campaign_id UUID REFERENCES public.crm_campaigns(id) ON DELETE SET NULL,
  block_id UUID REFERENCES public.campaign_blocks(id) ON DELETE SET NULL,
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 1,
  first_used_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now(),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Prevent duplicate entries for same image + tenant + block
  UNIQUE(image_id, tenant_id, block_id)
);

-- Indexes for queries
CREATE INDEX IF NOT EXISTS idx_image_tenant_usage_image_id ON public.image_tenant_usage(image_id);
CREATE INDEX IF NOT EXISTS idx_image_tenant_usage_tenant_id ON public.image_tenant_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_image_tenant_usage_user_id ON public.image_tenant_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_image_tenant_usage_campaign_id ON public.image_tenant_usage(campaign_id);

-- RLS: Users can only see their tenant's usage
ALTER TABLE public.image_tenant_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view their tenant's image usage" ON public.image_tenant_usage;
CREATE POLICY "Users view their tenant's image usage"
  ON public.image_tenant_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() 
      AND u.tenant_id = image_tenant_usage.tenant_id
    )
  );

DROP POLICY IF EXISTS "Users create usage for their tenant" ON public.image_tenant_usage;
CREATE POLICY "Users create usage for their tenant"
  ON public.image_tenant_usage FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() 
      AND u.tenant_id = image_tenant_usage.tenant_id
    )
  );

DROP POLICY IF EXISTS "Service role manages all usage records" ON public.image_tenant_usage;
CREATE POLICY "Service role manages all usage records"
  ON public.image_tenant_usage FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Auto-update trigger
DROP TRIGGER IF EXISTS update_image_tenant_usage_updated_at ON public.image_tenant_usage;
CREATE TRIGGER update_image_tenant_usage_updated_at
  BEFORE UPDATE ON public.image_tenant_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. HELPER FUNCTIONS
-- ============================================================

-- Track image usage and update counters
CREATE OR REPLACE FUNCTION public.track_global_image_usage(
  p_image_id UUID,
  p_tenant_id UUID,
  p_user_id UUID,
  p_context TEXT,
  p_campaign_id UUID DEFAULT NULL,
  p_block_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_new_tenant BOOLEAN;
BEGIN
  -- Check if this is first use by this tenant
  SELECT NOT EXISTS (
    SELECT 1 FROM public.image_tenant_usage 
    WHERE image_id = p_image_id AND tenant_id = p_tenant_id
  ) INTO v_is_new_tenant;
  
  -- Update global image counters
  UPDATE public.global_image_gallery
  SET 
    total_usage_count = total_usage_count + 1,
    unique_tenant_count = CASE 
      WHEN v_is_new_tenant THEN unique_tenant_count + 1 
      ELSE unique_tenant_count 
    END,
    last_used_at = now(),
    updated_at = now()
  WHERE id = p_image_id;
  
  -- Insert or update tenant usage record
  INSERT INTO public.image_tenant_usage (
    image_id, tenant_id, user_id, used_in_context,
    campaign_id, block_id, usage_count, last_used_at
  )
  VALUES (
    p_image_id, p_tenant_id, p_user_id, p_context,
    p_campaign_id, p_block_id, 1, now()
  )
  ON CONFLICT (image_id, tenant_id, block_id)
  DO UPDATE SET
    usage_count = image_tenant_usage.usage_count + 1,
    last_used_at = now(),
    updated_at = now();
END;
$$;

-- Search images by tags (for future optimization)
CREATE OR REPLACE FUNCTION public.find_images_by_tags(
  p_tags TEXT[],
  p_channel TEXT DEFAULT NULL,
  p_min_confidence NUMERIC DEFAULT 0.7,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  image_id UUID,
  public_url TEXT,
  storage_path TEXT,
  match_count INTEGER,
  matched_tags TEXT[],
  total_usage_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gi.id as image_id,
    gi.public_url,
    gi.storage_path,
    COUNT(DISTINCT git.tag_name)::INTEGER as match_count,
    ARRAY_AGG(DISTINCT git.tag_name) as matched_tags,
    gi.total_usage_count
  FROM public.global_image_gallery gi
  INNER JOIN public.global_image_tags git ON gi.id = git.image_id
  WHERE 
    git.tag_name = ANY(p_tags)
    AND git.confidence_score >= p_min_confidence
    AND gi.is_active = true
    AND (p_channel IS NULL OR gi.channel = p_channel)
  GROUP BY gi.id, gi.public_url, gi.storage_path, gi.total_usage_count, gi.created_at
  ORDER BY 
    match_count DESC,
    gi.total_usage_count DESC,
    gi.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================
-- 5. STORAGE BUCKET SETUP
-- ============================================================

-- Create global AI images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'global-ai-images',
  'global-ai-images',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage bucket
DROP POLICY IF EXISTS "Anyone can view global AI images" ON storage.objects;
CREATE POLICY "Anyone can view global AI images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'global-ai-images');

DROP POLICY IF EXISTS "Service role can upload global AI images" ON storage.objects;
CREATE POLICY "Service role can upload global AI images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'global-ai-images' 
    AND auth.jwt()->>'role' = 'service_role'
  );

DROP POLICY IF EXISTS "Service role can update global AI images" ON storage.objects;
CREATE POLICY "Service role can update global AI images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'global-ai-images'
    AND auth.jwt()->>'role' = 'service_role'
  );

DROP POLICY IF EXISTS "Service role can delete global AI images" ON storage.objects;
CREATE POLICY "Service role can delete global AI images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'global-ai-images'
    AND auth.jwt()->>'role' = 'service_role'
  );