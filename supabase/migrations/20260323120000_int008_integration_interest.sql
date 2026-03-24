CREATE TABLE IF NOT EXISTS public.integration_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  integration_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  requested_on DATE GENERATED ALWAYS AS ((timezone('utc', created_at))::date) STORED,
  CONSTRAINT integration_interest_email_not_blank CHECK (btrim(email) <> ''),
  CONSTRAINT integration_interest_supported_slug CHECK (
    integration_slug = ANY (
      ARRAY[
        'shopify',
        'hubspot',
        'zapier',
        'slack',
        'custom-webhooks'
      ]::TEXT[]
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS integration_interest_user_slug_day_key
  ON public.integration_interest (user_id, integration_slug, requested_on);

CREATE INDEX IF NOT EXISTS integration_interest_tenant_slug_created_at_idx
  ON public.integration_interest (tenant_id, integration_slug, created_at DESC);

ALTER TABLE public.integration_interest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own integration interest"
ON public.integration_interest
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = integration_interest.tenant_id
  )
);