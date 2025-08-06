-- Add flow_state and versioning columns to crm_automations
ALTER TABLE public.crm_automations 
ADD COLUMN flow_state JSONB DEFAULT '{"nodes": [], "edges": []}'::jsonb,
ADD COLUMN version INTEGER DEFAULT 1,
ADD COLUMN is_active BOOLEAN DEFAULT false;

-- Create automation_versions table for version history
CREATE TABLE public.automation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES public.crm_automations(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  diff_data JSONB NOT NULL,
  author_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(automation_id, version_number)
);

-- Create automation_events table for revenue attribution
CREATE TABLE public.automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES public.crm_automations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('send', 'click', 'redeem', 'share', 'conversion')),
  message_id UUID,
  branch_id TEXT,
  revenue_amount DECIMAL(10,2),
  order_id TEXT,
  is_test BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add test_numbers array for sandbox testing
ALTER TABLE public.company_profiles 
ADD COLUMN test_numbers TEXT[] DEFAULT '{}';

-- Add compliance settings
ALTER TABLE public.company_profiles 
ADD COLUMN compliance_settings JSONB DEFAULT '{
  "quiet_hours": {"start": "22:00", "end": "08:00"},
  "timezone": "America/New_York",
  "max_image_size_kb": 500
}'::jsonb;

-- Create automation templates table
CREATE TABLE public.automation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  flow_data JSONB NOT NULL,
  kpi_data JSONB DEFAULT '{"avg_ctr": 0, "avg_revenue_per_send": 0}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.automation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for automation_versions
CREATE POLICY "Users can manage versions for their tenant automations" ON public.automation_versions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.crm_automations a
    JOIN public.users u ON u.tenant_id = a.tenant_id
    WHERE a.id = automation_versions.automation_id AND u.id = auth.uid()
  )
);

-- RLS policies for automation_events
CREATE POLICY "Users can manage events for their tenant automations" ON public.automation_events
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.crm_automations a
    JOIN public.users u ON u.tenant_id = a.tenant_id
    WHERE a.id = automation_events.automation_id AND u.id = auth.uid()
  )
);

-- RLS policies for automation_templates
CREATE POLICY "Anyone can view active templates" ON public.automation_templates
FOR SELECT USING (is_active = true);

CREATE POLICY "System can manage templates" ON public.automation_templates
FOR ALL USING (true);

-- Create indexes for performance
CREATE INDEX idx_automation_events_automation_id ON public.automation_events(automation_id);
CREATE INDEX idx_automation_events_customer_id ON public.automation_events(customer_id);
CREATE INDEX idx_automation_events_created_at ON public.automation_events(created_at);
CREATE INDEX idx_automation_versions_automation_id ON public.automation_versions(automation_id);

-- Add triggers for updated_at
CREATE TRIGGER update_automation_templates_updated_at
  BEFORE UPDATE ON public.automation_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crm_automations_updated_at();