
-- Create junction table to link campaigns with segments
CREATE TABLE public.campaign_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES public.crm_segments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, segment_id)
);

-- Add Row Level Security
ALTER TABLE public.campaign_segments ENABLE ROW LEVEL SECURITY;

-- Create policy for campaign segments
CREATE POLICY "Users can manage campaign segments for their tenant campaigns" 
  ON public.campaign_segments 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_campaigns c
      JOIN public.users u ON u.tenant_id = c.tenant_id
      WHERE c.id = campaign_segments.campaign_id AND u.id = auth.uid()
    )
  );
