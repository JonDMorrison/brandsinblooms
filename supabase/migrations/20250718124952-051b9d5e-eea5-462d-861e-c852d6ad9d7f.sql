-- Create campaign_blocks table for visual email builder
CREATE TABLE public.campaign_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  block_type TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  image_url TEXT,
  cta_url TEXT,
  cta_text TEXT,
  source TEXT DEFAULT 'manual',
  persona_tag TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaign_blocks ENABLE ROW LEVEL SECURITY;

-- Create policies for campaign blocks
CREATE POLICY "Users can manage blocks for their tenant campaigns"
ON public.campaign_blocks
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM crm_campaigns c
    JOIN users u ON u.tenant_id = c.tenant_id
    WHERE c.id = campaign_blocks.campaign_id AND u.id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_campaign_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_campaign_blocks_updated_at
BEFORE UPDATE ON public.campaign_blocks
FOR EACH ROW
EXECUTE FUNCTION public.update_campaign_blocks_updated_at();

-- Add index for performance
CREATE INDEX idx_campaign_blocks_campaign_id_order ON public.campaign_blocks(campaign_id, order_index);