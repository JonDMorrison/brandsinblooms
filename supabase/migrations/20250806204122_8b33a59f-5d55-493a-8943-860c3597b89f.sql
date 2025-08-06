-- Create content_blocks table for dynamic hub content
CREATE TABLE public.content_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'text', 'coupon', 'video', 'loyalty_widget', 'image_carousel', 'offer_card', 'rich_text')),
  payload_json JSONB NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add new columns to campaigns table for hub functionality
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS hub_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS hub_expiry DATE;

-- Create unique index on campaign slug
CREATE UNIQUE INDEX idx_campaigns_slug ON public.campaigns (slug) WHERE slug IS NOT NULL;

-- Create index on content_blocks for efficient querying
CREATE INDEX idx_content_blocks_campaign_id ON public.content_blocks (campaign_id);
CREATE INDEX idx_content_blocks_sort_order ON public.content_blocks (campaign_id, sort_order);

-- Enable RLS on content_blocks
ALTER TABLE public.content_blocks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for content_blocks
CREATE POLICY "Users can manage content blocks for their tenant campaigns"
ON public.content_blocks
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM campaigns c
    JOIN users u ON u.tenant_id = c.tenant_id
    WHERE c.id = content_blocks.campaign_id 
    AND u.id = auth.uid()
  )
);

-- Create hub_views table for analytics
CREATE TABLE public.hub_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  user_agent TEXT,
  ip_address INET,
  referrer TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Create hub_interactions table for detailed engagement tracking
CREATE TABLE public.hub_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('view', 'click', 'favorite', 'share', 'save')),
  block_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on analytics tables
ALTER TABLE public.hub_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_interactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for analytics tables
CREATE POLICY "Users can view hub analytics for their tenant campaigns"
ON public.hub_views
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM campaigns c
    JOIN users u ON u.tenant_id = c.tenant_id
    WHERE c.id = hub_views.campaign_id 
    AND u.id = auth.uid()
  )
);

CREATE POLICY "System can insert hub views"
ON public.hub_views
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view hub interactions for their tenant campaigns"
ON public.hub_interactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM campaigns c
    JOIN users u ON u.tenant_id = c.tenant_id
    WHERE c.id = hub_interactions.campaign_id 
    AND u.id = auth.uid()
  )
);

CREATE POLICY "System can insert hub interactions"
ON public.hub_interactions
FOR INSERT
WITH CHECK (true);

-- Create indexes for analytics
CREATE INDEX idx_hub_views_campaign_id ON public.hub_views (campaign_id);
CREATE INDEX idx_hub_views_viewed_at ON public.hub_views (viewed_at);
CREATE INDEX idx_hub_interactions_campaign_id ON public.hub_interactions (campaign_id);
CREATE INDEX idx_hub_interactions_type ON public.hub_interactions (interaction_type);

-- Create function to update content_blocks updated_at
CREATE OR REPLACE FUNCTION public.update_content_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for content_blocks
CREATE TRIGGER update_content_blocks_updated_at
  BEFORE UPDATE ON public.content_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_content_blocks_updated_at();

-- Create function to generate unique campaign slugs
CREATE OR REPLACE FUNCTION public.generate_campaign_slug(campaign_title TEXT, campaign_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Generate base slug from title
  base_slug := LOWER(REGEXP_REPLACE(TRIM(campaign_title), '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := REGEXP_REPLACE(base_slug, '^-+|-+$', '', 'g');
  
  -- Ensure minimum length
  IF LENGTH(base_slug) < 3 THEN
    base_slug := base_slug || '-' || SUBSTRING(campaign_id::TEXT FROM 1 FOR 8);
  END IF;
  
  final_slug := base_slug;
  
  -- Check for uniqueness and add counter if needed
  WHILE EXISTS (SELECT 1 FROM campaigns WHERE slug = final_slug AND id != campaign_id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;