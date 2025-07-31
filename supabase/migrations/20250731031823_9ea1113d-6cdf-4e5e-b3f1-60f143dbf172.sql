-- Create customer_segments junction table for many-to-many relationship
CREATE TABLE public.customer_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  segment_id UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique customer-segment pairs
  UNIQUE(customer_id, segment_id)
);

-- Enable Row Level Security
ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;

-- Create policies for customer_segments
CREATE POLICY "Users can manage customer segments for their tenant" 
ON public.customer_segments 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM crm_customers c
  JOIN users u ON u.tenant_id = c.tenant_id
  WHERE c.id = customer_segments.customer_id 
  AND u.id = auth.uid()
));

-- Add foreign key constraints
ALTER TABLE public.customer_segments 
ADD CONSTRAINT fk_customer_segments_customer 
FOREIGN KEY (customer_id) REFERENCES public.crm_customers(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX idx_customer_segments_customer_id ON public.customer_segments(customer_id);
CREATE INDEX idx_customer_segments_segment_id ON public.customer_segments(segment_id);