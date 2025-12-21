-- Create customer_ai_insights table for caching AI-generated insights
CREATE TABLE public.customer_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- AI-generated content
  key_insight TEXT NOT NULL,
  behavioral_patterns JSONB DEFAULT '[]'::jsonb,
  recommended_actions JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  has_sufficient_data BOOLEAN DEFAULT true,
  model_used TEXT DEFAULT 'gpt-4o-mini',
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  
  -- Timestamps
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one insight per customer (can be replaced via upsert)
  UNIQUE(customer_id)
);

-- Indexes for efficient lookups
CREATE INDEX idx_customer_ai_insights_customer ON public.customer_ai_insights(customer_id);
CREATE INDEX idx_customer_ai_insights_tenant ON public.customer_ai_insights(tenant_id);
CREATE INDEX idx_customer_ai_insights_expires ON public.customer_ai_insights(expires_at);

-- Enable RLS
ALTER TABLE public.customer_ai_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies (using 'users' table pattern as per existing migrations)
CREATE POLICY "Users can view their tenant's insights"
  ON public.customer_ai_insights FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert insights for their tenant"
  ON public.customer_ai_insights FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update insights for their tenant"
  ON public.customer_ai_insights FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete insights for their tenant"
  ON public.customer_ai_insights FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));