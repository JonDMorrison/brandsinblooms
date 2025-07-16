-- Create CRM subscriptions table for unsubscribe management
CREATE TABLE IF NOT EXISTS public.crm_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  tenant_id UUID,
  user_id UUID,
  customer_id UUID,
  opt_out BOOLEAN DEFAULT false,
  opt_out_at TIMESTAMP WITH TIME ZONE,
  source TEXT DEFAULT 'campaign',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(email, tenant_id)
);

-- Enable RLS
ALTER TABLE public.crm_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage subscriptions for their tenant" 
ON public.crm_subscriptions 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.tenant_id = crm_subscriptions.tenant_id 
  AND u.id = auth.uid()
));

-- Create policy for public unsubscribe access
CREATE POLICY "Public can update opt_out status" 
ON public.crm_subscriptions 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Create updated_at trigger
CREATE TRIGGER update_crm_subscriptions_updated_at
  BEFORE UPDATE ON public.crm_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crm_segments_updated_at();