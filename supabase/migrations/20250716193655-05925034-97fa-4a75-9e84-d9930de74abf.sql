-- Extend crm_customers table with POS-related fields
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS pos_source text;
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS order_history jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS total_spent numeric DEFAULT 0;
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS product_tags text[] DEFAULT '{}';

-- Create integration_logs table for tracking sync operations
CREATE TABLE IF NOT EXISTS public.integration_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid,
  pos_source text NOT NULL,
  sync_date timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  customers_imported integer DEFAULT 0,
  orders_imported integer DEFAULT 0,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on integration_logs
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for integration_logs
CREATE POLICY "Users can view their own integration logs" ON public.integration_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own integration logs" ON public.integration_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integration logs" ON public.integration_logs
  FOR UPDATE USING (auth.uid() = user_id);

-- Create trigger for updating updated_at on integration_logs
CREATE OR REPLACE FUNCTION public.update_integration_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_integration_logs_updated_at
  BEFORE UPDATE ON public.integration_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_integration_logs_updated_at();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_integration_logs_user_id ON public.integration_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_pos_source ON public.integration_logs(pos_source);
CREATE INDEX IF NOT EXISTS idx_integration_logs_status ON public.integration_logs(status);
CREATE INDEX IF NOT EXISTS idx_crm_customers_pos_source ON public.crm_customers(pos_source);
CREATE INDEX IF NOT EXISTS idx_crm_customers_total_spent ON public.crm_customers(total_spent);
CREATE INDEX IF NOT EXISTS idx_crm_customers_product_tags ON public.crm_customers USING GIN(product_tags);