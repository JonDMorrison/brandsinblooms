CREATE TABLE IF NOT EXISTS public.user_external_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_external_links_user_provider_unique UNIQUE (user_id, provider),
  CONSTRAINT user_external_links_provider_external_id_unique UNIQUE (provider, external_id)
);

CREATE TABLE IF NOT EXISTS public.oauth_provisioning_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('client', 'email')),
  identifier TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 1 CHECK (count > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT oauth_provisioning_rate_limits_scope_identifier_window_unique
    UNIQUE (scope, identifier, window_start)
);

CREATE TABLE IF NOT EXISTS public.oauth_provisioning_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  email TEXT NOT NULL,
  source TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('created', 'existing', 'error', 'rate_limited', 'rejected')),
  crm_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_provisioning_rate_limits_window_start
  ON public.oauth_provisioning_rate_limits (window_start);

CREATE INDEX IF NOT EXISTS idx_oauth_provisioning_audit_logs_created_at
  ON public.oauth_provisioning_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oauth_provisioning_audit_logs_client_created_at
  ON public.oauth_provisioning_audit_logs (client_id, created_at DESC);

ALTER TABLE public.user_external_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_provisioning_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_provisioning_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_external_links_service_all" ON public.user_external_links;
CREATE POLICY "user_external_links_service_all"
  ON public.user_external_links
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "oauth_provisioning_rate_limits_service_all" ON public.oauth_provisioning_rate_limits;
CREATE POLICY "oauth_provisioning_rate_limits_service_all"
  ON public.oauth_provisioning_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "oauth_provisioning_audit_logs_service_all" ON public.oauth_provisioning_audit_logs;
CREATE POLICY "oauth_provisioning_audit_logs_service_all"
  ON public.oauth_provisioning_audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.user_external_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.oauth_provisioning_rate_limits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.oauth_provisioning_audit_logs FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.user_external_links TO service_role;
GRANT ALL ON TABLE public.oauth_provisioning_rate_limits TO service_role;
GRANT ALL ON TABLE public.oauth_provisioning_audit_logs TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_oauth_provisioning_rate_limit(
  p_scope TEXT,
  p_identifier TEXT,
  p_window_start TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  INSERT INTO public.oauth_provisioning_rate_limits (
    scope,
    identifier,
    window_start,
    count
  ) VALUES (
    p_scope,
    p_identifier,
    p_window_start,
    1
  )
  ON CONFLICT (scope, identifier, window_start)
  DO UPDATE SET
    count = public.oauth_provisioning_rate_limits.count + 1,
    updated_at = now()
  RETURNING count INTO v_new_count;

  RETURN v_new_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_oauth_provisioning_rate_limit(TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;

COMMENT ON FUNCTION public.upsert_oauth_provisioning_rate_limit(TEXT, TEXT, TIMESTAMPTZ) IS
  'Atomic rate limit counter increment for OAuth user provisioning. Returns the new count for the fixed one-minute window.';