-- Create campaign_block_versions table for version history
CREATE TABLE public.campaign_block_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  block_id UUID NOT NULL REFERENCES public.campaign_blocks(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  snapshot_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.campaign_block_versions ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view block versions for their tenant campaigns" 
ON public.campaign_block_versions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.crm_campaigns cc
  JOIN public.users u ON u.tenant_id = cc.tenant_id
  WHERE cc.id = campaign_block_versions.campaign_id 
  AND u.id = auth.uid()
));

CREATE POLICY "Users can create block versions for their tenant campaigns" 
ON public.campaign_block_versions 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.crm_campaigns cc
  JOIN public.users u ON u.tenant_id = cc.tenant_id
  WHERE cc.id = campaign_block_versions.campaign_id 
  AND u.id = auth.uid()
));

-- Create index for performance
CREATE INDEX idx_campaign_block_versions_block_id ON public.campaign_block_versions(block_id);
CREATE INDEX idx_campaign_block_versions_campaign_id ON public.campaign_block_versions(campaign_id);
CREATE INDEX idx_campaign_block_versions_created_at ON public.campaign_block_versions(created_at DESC);

-- Create function to cleanup old versions (keep only last 20 per block)
CREATE OR REPLACE FUNCTION public.cleanup_old_block_versions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete versions older than the 20 most recent for this block
  DELETE FROM public.campaign_block_versions
  WHERE block_id = NEW.block_id
  AND id NOT IN (
    SELECT id FROM public.campaign_block_versions
    WHERE block_id = NEW.block_id
    ORDER BY created_at DESC
    LIMIT 20
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-cleanup old versions
CREATE TRIGGER cleanup_old_versions_trigger
  AFTER INSERT ON public.campaign_block_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_old_block_versions();