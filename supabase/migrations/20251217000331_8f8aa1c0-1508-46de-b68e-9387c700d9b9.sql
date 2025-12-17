-- Add circuit breaker columns to pos_sync_jobs_v2
ALTER TABLE public.pos_sync_jobs_v2 
ADD COLUMN IF NOT EXISTS consecutive_failures integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_failure_at timestamptz,
ADD COLUMN IF NOT EXISTS circuit_open_until timestamptz;

-- Add 'delayed' status to the enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'delayed' AND enumtypid = 'pos_sync_job_status'::regtype) THEN
    ALTER TYPE pos_sync_job_status ADD VALUE 'delayed';
  END IF;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create client usage alert settings table
CREATE TABLE IF NOT EXISTS public.usage_alert_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  
  -- Alert thresholds (percentage of quota)
  email_warning_threshold integer DEFAULT 80,
  email_critical_threshold integer DEFAULT 100,
  sms_warning_threshold integer DEFAULT 80,
  sms_critical_threshold integer DEFAULT 100,
  
  -- Notification preferences
  email_notifications_enabled boolean DEFAULT true,
  in_app_notifications_enabled boolean DEFAULT true,
  
  -- Auto-pause settings
  auto_pause_at_limit boolean DEFAULT false,
  
  -- Sync frequency preference
  pos_sync_frequency text DEFAULT 'auto' CHECK (pos_sync_frequency IN ('realtime', 'hourly', 'daily', 'manual', 'auto')),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(tenant_id, user_id)
);

-- Enable RLS
ALTER TABLE public.usage_alert_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own alert settings"
  ON public.usage_alert_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own alert settings"
  ON public.usage_alert_settings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own alert settings"
  ON public.usage_alert_settings FOR UPDATE
  USING (user_id = auth.uid());

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_usage_alert_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_usage_alert_settings_updated_at
  BEFORE UPDATE ON public.usage_alert_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_usage_alert_settings_updated_at();

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_usage_alert_settings_user ON public.usage_alert_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_alert_settings_tenant ON public.usage_alert_settings(tenant_id);