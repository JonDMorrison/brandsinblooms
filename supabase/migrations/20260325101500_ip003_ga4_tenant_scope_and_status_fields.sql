ALTER TABLE public.google_analytics_settings
ADD COLUMN IF NOT EXISTS tenant_id UUID,
ADD COLUMN IF NOT EXISTS property_name TEXT,
ADD COLUMN IF NOT EXISTS measurement_id TEXT,
ADD COLUMN IF NOT EXISTS google_account_email TEXT,
ADD COLUMN IF NOT EXISTS last_pull_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_test_status TEXT,
ADD COLUMN IF NOT EXISTS last_test_message TEXT;

UPDATE public.google_analytics_settings AS gas
SET tenant_id = users.tenant_id
FROM public.users AS users
WHERE users.id = gas.user_id
  AND gas.tenant_id IS NULL;

ALTER TABLE public.google_analytics_settings
ALTER COLUMN tenant_id SET NOT NULL;

DROP POLICY IF EXISTS "Users can manage their own GA settings" ON public.google_analytics_settings;

CREATE POLICY "Users can manage their tenant GA settings"
ON public.google_analytics_settings
FOR ALL
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.id = auth.uid()
      AND users.tenant_id = google_analytics_settings.tenant_id
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.id = auth.uid()
      AND users.tenant_id = google_analytics_settings.tenant_id
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS google_analytics_settings_tenant_user_unique
ON public.google_analytics_settings (tenant_id, user_id);