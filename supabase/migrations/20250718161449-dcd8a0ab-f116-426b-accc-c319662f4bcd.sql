-- Create saved_blocks table for storing reusable email blocks
CREATE TABLE public.saved_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  block_type TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  is_bloomsuite_block BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_blocks ENABLE ROW LEVEL SECURITY;

-- Create policies for saved blocks
CREATE POLICY "Users can manage blocks for their tenant"
ON public.saved_blocks
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.tenant_id = saved_blocks.tenant_id AND u.id = auth.uid()
  )
  OR saved_blocks.is_bloomsuite_block = true
);

-- Create function for updating updated_at
CREATE OR REPLACE FUNCTION public.update_saved_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_saved_blocks_updated_at
BEFORE UPDATE ON public.saved_blocks
FOR EACH ROW
EXECUTE FUNCTION public.update_saved_blocks_updated_at();

-- Add index for performance
CREATE INDEX idx_saved_blocks_tenant_type ON public.saved_blocks(tenant_id, block_type);
CREATE INDEX idx_saved_blocks_tags ON public.saved_blocks USING GIN(tags);