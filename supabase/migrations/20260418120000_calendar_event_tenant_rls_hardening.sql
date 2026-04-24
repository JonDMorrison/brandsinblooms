-- Harden calendar event reads so tenant users only see rows for their active tenant.
-- Personal-mode users without a tenant can still access their own legacy null-tenant rows.

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view campaigns for their tenant" ON public.campaigns;
CREATE POLICY "Users can view campaigns for their tenant"
ON public.campaigns
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = campaigns.tenant_id
  )
  OR (
    campaigns.tenant_id IS NULL
    AND campaigns.user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id IS NOT NULL
    )
  )
);

DROP POLICY IF EXISTS "Users can view content tasks for their tenant" ON public.content_tasks;
DROP POLICY IF EXISTS "Users can view their own content tasks" ON public.content_tasks;
CREATE POLICY "Users can view content tasks for their tenant"
ON public.content_tasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = content_tasks.tenant_id
  )
  OR (
    content_tasks.tenant_id IS NULL
    AND content_tasks.user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id IS NOT NULL
    )
  )
);

DROP POLICY IF EXISTS "Users can manage campaigns for their tenant" ON public.crm_campaigns;
CREATE POLICY "Users can manage campaigns for their tenant"
ON public.crm_campaigns
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = crm_campaigns.tenant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = crm_campaigns.tenant_id
  )
);

DROP POLICY IF EXISTS "Users can view their own campaigns" ON public.crm_campaigns;
DROP POLICY IF EXISTS "Users can update their own campaigns" ON public.crm_campaigns;

DROP POLICY IF EXISTS "Users can view their own scheduled posts" ON public.scheduled_posts;
CREATE POLICY "Users can view their own scheduled posts"
ON public.scheduled_posts
FOR SELECT
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = scheduled_posts.tenant_id
    )
    OR (
      scheduled_posts.tenant_id IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.tenant_id IS NOT NULL
      )
    )
  )
  AND scheduled_posts.user_id = auth.uid()
);

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END;
$$;