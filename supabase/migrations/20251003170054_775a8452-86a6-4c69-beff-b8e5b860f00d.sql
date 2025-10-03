-- Add plans table to track marketing plans
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID,
  name TEXT NOT NULL,
  month TEXT NOT NULL,
  themes JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for plans
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own plans"
  ON public.plans
  FOR ALL
  USING (auth.uid() = user_id);

-- Add plan_id to content_tasks for tracking
ALTER TABLE public.content_tasks
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS plan_theme TEXT,
ADD COLUMN IF NOT EXISTS preview_image_url TEXT;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_content_tasks_plan_id ON public.content_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_plans_user_month ON public.plans(user_id, month);

-- Add updated_at trigger for plans
CREATE OR REPLACE FUNCTION public.update_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_plans_updated_at();