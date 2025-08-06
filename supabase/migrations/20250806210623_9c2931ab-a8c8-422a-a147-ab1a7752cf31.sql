-- Create analytics_events table for tracking all user interactions
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- 'link_click' | 'coupon_redeem' | 'share_click' | 'sms_sent' | 'sms_delivered'
  campaign_id UUID NULL,
  automation_id UUID NULL,
  contact_id UUID NULL,
  sms_id UUID NULL,
  message_type TEXT NULL, -- 'blast' | 'automation_step' | 'manual'
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create coupons table for discount code management
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  tenant_id UUID NOT NULL,
  campaign_id UUID NULL,
  automation_id UUID NULL,
  discount_type TEXT NOT NULL, -- 'percentage' | 'fixed_amount' | 'free_shipping'
  discount_value NUMERIC NOT NULL,
  min_purchase_amount NUMERIC NULL,
  expires_at TIMESTAMP WITH TIME ZONE NULL,
  usage_limit INTEGER DEFAULT 1,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  redeemed_at TIMESTAMP WITH TIME ZONE NULL,
  pos_txn_id TEXT NULL,
  net_sales NUMERIC NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create campaign attribution table for revenue tracking
CREATE TABLE IF NOT EXISTS public.campaign_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  campaign_id UUID NULL,
  automation_id UUID NULL,
  contact_id UUID NOT NULL,
  first_touch_at TIMESTAMP WITH TIME ZONE,
  last_touch_at TIMESTAMP WITH TIME ZONE,
  attribution_window_days INTEGER DEFAULT 7,
  total_revenue NUMERIC DEFAULT 0,
  total_redemptions INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on analytics_events
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for analytics_events
CREATE POLICY "Users can manage analytics events for their tenant" 
ON public.analytics_events 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.tenant_id = analytics_events.tenant_id 
    AND u.id = auth.uid()
  )
);

-- Enable RLS on coupons
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for coupons
CREATE POLICY "Users can manage coupons for their tenant" 
ON public.coupons 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.tenant_id = coupons.tenant_id 
    AND u.id = auth.uid()
  )
);

-- Enable RLS on campaign_attribution
ALTER TABLE public.campaign_attribution ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for campaign_attribution
CREATE POLICY "Users can view attribution for their tenant" 
ON public.campaign_attribution 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.tenant_id = campaign_attribution.tenant_id 
    AND u.id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_analytics_events_tenant_campaign ON public.analytics_events(tenant_id, campaign_id);
CREATE INDEX idx_analytics_events_created_at ON public.analytics_events(created_at);
CREATE INDEX idx_analytics_events_event_type ON public.analytics_events(event_type);

CREATE INDEX idx_coupons_tenant ON public.coupons(tenant_id);
CREATE INDEX idx_coupons_code ON public.coupons(code);
CREATE INDEX idx_coupons_campaign ON public.coupons(campaign_id);

-- Create updated_at triggers
CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crm_customers_updated_at();

CREATE TRIGGER update_campaign_attribution_updated_at
  BEFORE UPDATE ON public.campaign_attribution
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crm_customers_updated_at();