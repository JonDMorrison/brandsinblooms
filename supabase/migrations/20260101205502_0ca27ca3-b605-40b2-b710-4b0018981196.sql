-- Create table for storing user agreement acceptances
CREATE TABLE public.user_agreement_acceptances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  business_name TEXT,
  agreement_name TEXT NOT NULL,
  agreement_version TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_agreement_acceptances ENABLE ROW LEVEL SECURITY;

-- Users can view their own acceptances
CREATE POLICY "Users can view their own agreement acceptances"
ON public.user_agreement_acceptances
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own acceptances
CREATE POLICY "Users can insert their own agreement acceptances"
ON public.user_agreement_acceptances
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_user_agreement_acceptances_user_id ON public.user_agreement_acceptances(user_id);
CREATE INDEX idx_user_agreement_acceptances_agreement ON public.user_agreement_acceptances(agreement_name, agreement_version);