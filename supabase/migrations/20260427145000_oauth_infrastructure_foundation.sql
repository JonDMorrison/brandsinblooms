CREATE TABLE IF NOT EXISTS public.oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL UNIQUE,
  client_secret_hash TEXT NOT NULL,
  client_name TEXT NOT NULL,
  redirect_uris TEXT[] NOT NULL,
  allowed_scopes TEXT[] NOT NULL,
  grant_types TEXT[] NOT NULL DEFAULT ARRAY['authorization_code', 'refresh_token']::TEXT[],
  is_first_party BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.oauth_authorization_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL REFERENCES public.oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  scope TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256' CHECK (code_challenge_method IN ('S256', 'plain')),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.oauth_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL REFERENCES public.oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  family_id UUID NOT NULL,
  parent_token_id UUID REFERENCES public.oauth_refresh_tokens(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.oauth_signing_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid TEXT NOT NULL UNIQUE,
  kty TEXT NOT NULL CHECK (kty IN ('RSA', 'OKP')),
  alg TEXT NOT NULL CHECK (alg IN ('RS256', 'EdDSA')),
  public_key_jwk JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.oauth_authorization_codes.code IS
  'Stores the SHA-256 hex digest of the plaintext authorization code returned to the client.';

COMMENT ON COLUMN public.oauth_refresh_tokens.token_hash IS
  'Stores the SHA-256 hex digest of the plaintext refresh token returned to the client.';

COMMENT ON COLUMN public.oauth_signing_keys.public_key_jwk IS
  'Publishes the public signing key in JWK format for the JWKS endpoint.';

CREATE INDEX IF NOT EXISTS idx_oauth_authorization_codes_client_user
  ON public.oauth_authorization_codes (client_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oauth_authorization_codes_expires_at
  ON public.oauth_authorization_codes (expires_at);

CREATE INDEX IF NOT EXISTS idx_oauth_authorization_codes_consumed_at
  ON public.oauth_authorization_codes (consumed_at);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_user_client
  ON public.oauth_refresh_tokens (user_id, client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_family_id
  ON public.oauth_refresh_tokens (family_id);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_expires_at
  ON public.oauth_refresh_tokens (expires_at);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_revoked_at
  ON public.oauth_refresh_tokens (revoked_at);

CREATE INDEX IF NOT EXISTS idx_oauth_signing_keys_active_created_at
  ON public.oauth_signing_keys (created_at DESC)
  WHERE is_active;

ALTER TABLE public.oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_signing_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oauth_clients_service_all" ON public.oauth_clients;
CREATE POLICY "oauth_clients_service_all"
  ON public.oauth_clients
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "oauth_authorization_codes_service_all" ON public.oauth_authorization_codes;
CREATE POLICY "oauth_authorization_codes_service_all"
  ON public.oauth_authorization_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "oauth_refresh_tokens_service_all" ON public.oauth_refresh_tokens;
CREATE POLICY "oauth_refresh_tokens_service_all"
  ON public.oauth_refresh_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "oauth_signing_keys_public_select" ON public.oauth_signing_keys;
CREATE POLICY "oauth_signing_keys_public_select"
  ON public.oauth_signing_keys
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "oauth_signing_keys_service_all" ON public.oauth_signing_keys;
CREATE POLICY "oauth_signing_keys_service_all"
  ON public.oauth_signing_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.oauth_clients FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.oauth_authorization_codes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.oauth_refresh_tokens FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.oauth_signing_keys FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.oauth_clients TO service_role;
GRANT ALL ON TABLE public.oauth_authorization_codes TO service_role;
GRANT ALL ON TABLE public.oauth_refresh_tokens TO service_role;
GRANT ALL ON TABLE public.oauth_signing_keys TO service_role;
GRANT SELECT ON TABLE public.oauth_signing_keys TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_oauth_clients_updated_at'
  ) THEN
    CREATE TRIGGER update_oauth_clients_updated_at
      BEFORE UPDATE ON public.oauth_clients
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

INSERT INTO public.oauth_clients (
  client_id,
  client_secret_hash,
  client_name,
  redirect_uris,
  allowed_scopes,
  grant_types,
  is_first_party,
  is_active
)
VALUES (
  'bloomsuite-cms',
  crypt(encode(gen_random_bytes(48), 'base64'), gen_salt('bf', 12)),
  'BloomSuite CMS',
  ARRAY[
    'http://localhost:3000/api/auth/crm/callback',
    'https://cms.invalid/api/auth/crm/callback'
  ]::TEXT[],
  ARRAY['openid', 'profile', 'email', 'subscription']::TEXT[],
  ARRAY['authorization_code', 'refresh_token', 'client_credentials']::TEXT[],
  true,
  true
)
ON CONFLICT (client_id) DO NOTHING;

INSERT INTO public.oauth_clients (
  client_id,
  client_secret_hash,
  client_name,
  redirect_uris,
  allowed_scopes,
  grant_types,
  is_first_party,
  is_active
)
VALUES (
  'bloomsuite-cms-m2m',
  crypt(encode(gen_random_bytes(48), 'base64'), gen_salt('bf', 12)),
  'BloomSuite CMS M2M',
  ARRAY[]::TEXT[],
  ARRAY['user:provision', 'subscription:read']::TEXT[],
  ARRAY['client_credentials']::TEXT[],
  true,
  true
)
ON CONFLICT (client_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_data()
RETURNS TABLE (
  deleted_authorization_codes INTEGER,
  deleted_refresh_tokens INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  codes_deleted_count INTEGER := 0;
  refresh_tokens_deleted_count INTEGER := 0;
BEGIN
  DELETE FROM public.oauth_authorization_codes
  WHERE expires_at < now();

  GET DIAGNOSTICS codes_deleted_count = ROW_COUNT;

  DELETE FROM public.oauth_refresh_tokens
  WHERE expires_at < now()
    AND revoked_at IS NOT NULL;

  GET DIAGNOSTICS refresh_tokens_deleted_count = ROW_COUNT;

  RETURN QUERY
  SELECT codes_deleted_count, refresh_tokens_deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_oauth_data() TO service_role;
