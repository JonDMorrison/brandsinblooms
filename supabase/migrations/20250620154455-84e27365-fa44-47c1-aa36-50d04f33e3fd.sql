
-- Create Tenants table
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Add tenant_id to users table (keeping user_id for auditing)
ALTER TABLE public.users ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.users ADD COLUMN created_by_user_id UUID REFERENCES auth.users(id);

-- Add tenant_id to campaigns table  
ALTER TABLE public.campaigns ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.campaigns ADD COLUMN created_by_user_id UUID REFERENCES auth.users(id);

-- Add tenant_id to content_tasks table
ALTER TABLE public.content_tasks ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.content_tasks ADD COLUMN created_by_user_id UUID REFERENCES auth.users(id);

-- Create HolidayTasks table to match production
CREATE TABLE public.holiday_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
  holiday_id UUID REFERENCES public.holidays(id) NOT NULL,
  task_title TEXT NOT NULL,
  task_description TEXT,
  suggested_date DATE,
  status TEXT NOT NULL DEFAULT 'suggested',
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  priority INTEGER DEFAULT 0,
  content_suggestions JSONB DEFAULT '{}'::jsonb
);

-- Insert Platt Hill Nursery tenant
INSERT INTO public.tenants (name, slug, settings) 
VALUES ('Platt Hill Nursery', 'platt-hill-nursery', '{"industry": "garden_center", "location": "Illinois"}');

-- Add RLS policies for tenants table
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tenants they belong to" 
  ON public.tenants 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.tenant_id = tenants.id 
      AND u.id = auth.uid()
    )
  );

-- Add RLS policies for holiday_tasks table
ALTER TABLE public.holiday_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view holiday tasks for their tenant" 
  ON public.holiday_tasks 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.tenant_id = holiday_tasks.tenant_id 
      AND u.id = auth.uid()
    )
  );

CREATE POLICY "Users can create holiday tasks for their tenant" 
  ON public.holiday_tasks 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.tenant_id = holiday_tasks.tenant_id 
      AND u.id = auth.uid()
    )
  );

CREATE POLICY "Users can update holiday tasks for their tenant" 
  ON public.holiday_tasks 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.tenant_id = holiday_tasks.tenant_id 
      AND u.id = auth.uid()
    )
  );

-- Update existing RLS policies to use tenant_id isolation

-- Update campaigns policies
DROP POLICY IF EXISTS "Users can view their own campaigns" ON public.campaigns;
CREATE POLICY "Users can view campaigns for their tenant" 
  ON public.campaigns 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.tenant_id = campaigns.tenant_id 
      AND u.id = auth.uid()
    )
  );

-- Update content_tasks policies  
DROP POLICY IF EXISTS "Users can view their own content tasks" ON public.content_tasks;
CREATE POLICY "Users can view content tasks for their tenant" 
  ON public.content_tasks 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.tenant_id = content_tasks.tenant_id 
      AND u.id = auth.uid()
    )
  );

-- Add trigger for tenants updated_at
CREATE OR REPLACE FUNCTION public.update_tenants_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tenants_updated_at();

-- Add trigger for holiday_tasks updated_at
CREATE OR REPLACE FUNCTION public.update_holiday_tasks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_holiday_tasks_updated_at
  BEFORE UPDATE ON public.holiday_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_holiday_tasks_updated_at();
