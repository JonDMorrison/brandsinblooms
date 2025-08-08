-- Tighten permissive RLS policies and replace unsafe insert policies

-- 1) campaigns: drop permissive ALL policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'campaigns' 
      AND policyname = 'Allow all operations on campaigns'
  ) THEN
    EXECUTE 'DROP POLICY "Allow all operations on campaigns" ON public.campaigns';
  END IF;
END $$;

-- 2) automation_templates: drop permissive ALL policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'automation_templates' 
      AND policyname = 'System can manage templates'
  ) THEN
    EXECUTE 'DROP POLICY "System can manage templates" ON public.automation_templates';
  END IF;
END $$;

-- 3) crm_persona_campaign_templates: drop permissive ALL policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'crm_persona_campaign_templates' 
      AND policyname = 'System can manage campaign templates'
  ) THEN
    EXECUTE 'DROP POLICY "System can manage campaign templates" ON public.crm_persona_campaign_templates';
  END IF;
END $$;

-- 4) pos_orders: drop permissive ALL policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'pos_orders' 
      AND policyname = 'System can manage POS orders'
  ) THEN
    EXECUTE 'DROP POLICY "System can manage POS orders" ON public.pos_orders';
  END IF;
END $$;

-- 5) pos_sync_logs: drop permissive ALL policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'pos_sync_logs' 
      AND policyname = 'System can manage sync logs'
  ) THEN
    EXECUTE 'DROP POLICY "System can manage sync logs" ON public.pos_sync_logs';
  END IF;
END $$;

-- 6) image_suggestions: replace permissive INSERT policy with scoped insert
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'image_suggestions' 
      AND policyname = 'System can insert image suggestions'
  ) THEN
    EXECUTE 'DROP POLICY "System can insert image suggestions" ON public.image_suggestions';
  END IF;
END $$;

-- Create safer INSERT policy requiring ownership via content_tasks -> campaigns
CREATE POLICY "Users can insert image suggestions for their tasks"
ON public.image_suggestions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.content_tasks ct
    JOIN public.campaigns c ON ct.campaign_id = c.id
    WHERE ct.id = image_suggestions.content_task_id
      AND c.user_id = auth.uid()
  )
);

-- 7) master_campaign_templates: drop permissive ALL admin policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'master_campaign_templates' 
      AND policyname = 'Admin users can manage master templates'
  ) THEN
    EXECUTE 'DROP POLICY "Admin users can manage master templates" ON public.master_campaign_templates';
  END IF;
END $$;
