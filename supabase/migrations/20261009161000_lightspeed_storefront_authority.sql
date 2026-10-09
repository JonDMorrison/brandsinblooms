-- Target: existing BloomSuite CRM database, not the BloomSites CMS database.
-- All tables/functions below are service-only. The edge controller verifies a
-- site-minted authorization state or an ECDSA proof before accessing them.
BEGIN;
CREATE TABLE IF NOT EXISTS public.lightspeed_storefront_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  state_hash text NOT NULL UNIQUE CHECK (state_hash ~ '^[A-Za-z0-9_-]{43}$'),
  prefix text NOT NULL CHECK (prefix ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  public_key jsonb NOT NULL CHECK (public_key @> '{"kty":"EC","crv":"P-256"}'::jsonb AND public_key ? 'x' AND public_key ? 'y' AND NOT public_key ? 'd'),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','authorizing','authorized','active','refreshing','reconnect_required','revoked')),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  code_hash text,
  token_ciphertext text,
  receipt_ciphertext text,
  receipt_hash text,
  retailer_id text,
  currency text CHECK(currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  token_expires_at timestamptz,
  lease_id uuid,
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(status NOT IN('authorized','active','refreshing') OR
    (token_ciphertext IS NOT NULL AND retailer_id IS NOT NULL AND currency IS NOT NULL AND token_expires_at IS NOT NULL)),
  CHECK(status NOT IN('authorizing','refreshing') OR (lease_id IS NOT NULL AND lease_expires_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS public.lightspeed_storefront_nonces (
  grant_id uuid NOT NULL REFERENCES public.lightspeed_storefront_grants(id) ON DELETE CASCADE,
  nonce_hash text NOT NULL CHECK(nonce_hash ~ '^[A-Za-z0-9_-]{43}$'),
  valid_until timestamptz NOT NULL,
  PRIMARY KEY(grant_id,nonce_hash)
);
CREATE INDEX IF NOT EXISTS lightspeed_storefront_nonce_expiry_idx ON public.lightspeed_storefront_nonces(valid_until);
CREATE INDEX IF NOT EXISTS lightspeed_storefront_grant_site_idx ON public.lightspeed_storefront_grants(site_id);
ALTER TABLE public.lightspeed_storefront_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lightspeed_storefront_nonces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lightspeed_storefront_grants,public.lightspeed_storefront_nonces FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.lightspeed_storefront_grants,public.lightspeed_storefront_nonces TO service_role;

-- Run with the existing authorized maintenance worker. Revocation destroys stored
-- credentials; provider consent removal remains an explicit merchant action.
CREATE OR REPLACE FUNCTION public.cleanup_lightspeed_storefront_auth_v1()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.lightspeed_storefront_nonces WHERE valid_until < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  UPDATE public.lightspeed_storefront_grants SET status='reconnect_required',token_ciphertext=NULL,
    receipt_ciphertext=NULL,receipt_hash=NULL,token_expires_at=NULL,lease_id=NULL,lease_expires_at=NULL,
    version=version+1,updated_at=now()
  WHERE (status IN('pending','authorizing','authorized') AND expires_at<now())
    OR (status='refreshing' AND lease_expires_at<now());
  UPDATE public.lightspeed_storefront_grants SET receipt_ciphertext=NULL,receipt_hash=NULL,
    code_hash=NULL,version=version+1,updated_at=now()
  WHERE status='active' AND expires_at<now() AND receipt_ciphertext IS NOT NULL;
  DELETE FROM public.lightspeed_storefront_grants
  WHERE status IN('revoked','reconnect_required') AND updated_at<now()-interval '30 days';
  RETURN v_deleted;
END $$;
REVOKE ALL ON FUNCTION public.cleanup_lightspeed_storefront_auth_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_lightspeed_storefront_auth_v1() TO service_role;

CREATE OR REPLACE FUNCTION public.lightspeed_authority_create_v1(p_context jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_row public.lightspeed_storefront_grants;
BEGIN
  IF (p_context->>'expiresAt')::timestamptz <= now()
    OR (p_context->>'expiresAt')::timestamptz > now()+interval '11 minutes' THEN
    RAISE EXCEPTION 'authorization_expired';
  END IF;
  INSERT INTO public.lightspeed_storefront_grants(site_id,state_hash,prefix,public_key,expires_at)
  VALUES((p_context->>'siteId')::uuid,p_context->>'stateHash',p_context->>'prefix',p_context->'publicKey',(p_context->>'expiresAt')::timestamptz)
  ON CONFLICT(state_hash) DO NOTHING;
  SELECT * INTO v_row FROM public.lightspeed_storefront_grants WHERE state_hash=p_context->>'stateHash';
  RETURN to_jsonb(v_row);
END $$;
CREATE OR REPLACE FUNCTION public.lightspeed_authority_read_v1(p_id uuid DEFAULT NULL,p_state_hash text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT to_jsonb(g) FROM public.lightspeed_storefront_grants g
  WHERE (p_id IS NOT NULL AND p_state_hash IS NULL AND g.id=p_id)
    OR (p_id IS NULL AND p_state_hash IS NOT NULL AND g.state_hash=p_state_hash);
$$;
CREATE OR REPLACE FUNCTION public.lightspeed_authority_update_v1(p_id uuid,p_version integer,p_status text,p_patch jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_row public.lightspeed_storefront_grants;
BEGIN
  IF jsonb_typeof(p_patch) <> 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k
    WHERE k NOT IN('status','codeHash','tokenCiphertext','receiptCiphertext','receiptHash','retailerId','currency','tokenExpiresAt','leaseId','leaseExpiresAt','expiresAt')) THEN
    RAISE EXCEPTION 'invalid_patch';
  END IF;
  UPDATE public.lightspeed_storefront_grants SET
    status=CASE WHEN p_patch ? 'status' THEN p_patch->>'status' ELSE status END,
    code_hash=CASE WHEN p_patch ? 'codeHash' THEN p_patch->>'codeHash' ELSE code_hash END,
    token_ciphertext=CASE WHEN p_patch ? 'tokenCiphertext' THEN p_patch->>'tokenCiphertext' ELSE token_ciphertext END,
    receipt_ciphertext=CASE WHEN p_patch ? 'receiptCiphertext' THEN p_patch->>'receiptCiphertext' ELSE receipt_ciphertext END,
    receipt_hash=CASE WHEN p_patch ? 'receiptHash' THEN p_patch->>'receiptHash' ELSE receipt_hash END,
    retailer_id=CASE WHEN p_patch ? 'retailerId' THEN p_patch->>'retailerId' ELSE retailer_id END,
    currency=CASE WHEN p_patch ? 'currency' THEN p_patch->>'currency' ELSE currency END,
    token_expires_at=CASE WHEN p_patch ? 'tokenExpiresAt' THEN (p_patch->>'tokenExpiresAt')::timestamptz ELSE token_expires_at END,
    lease_id=CASE WHEN p_patch ? 'leaseId' THEN (p_patch->>'leaseId')::uuid ELSE lease_id END,
    lease_expires_at=CASE WHEN p_patch ? 'leaseExpiresAt' THEN (p_patch->>'leaseExpiresAt')::timestamptz ELSE lease_expires_at END,
    expires_at=CASE WHEN p_patch ? 'expiresAt' THEN (p_patch->>'expiresAt')::timestamptz ELSE expires_at END,
    version=version+1,updated_at=now()
  WHERE id=p_id AND version=p_version AND status=p_status
  RETURNING * INTO v_row;
  RETURN CASE WHEN v_row.id IS NULL THEN NULL ELSE to_jsonb(v_row) END;
END $$;
CREATE OR REPLACE FUNCTION public.lightspeed_authority_nonce_v1(p_grant_id uuid,p_nonce_hash text,p_valid_until timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_count integer;
BEGIN
  IF p_valid_until<=now() OR p_valid_until>now()+interval '6 minutes' THEN RAISE EXCEPTION 'invalid_nonce_expiry'; END IF;
  INSERT INTO public.lightspeed_storefront_nonces(grant_id,nonce_hash,valid_until)
  VALUES(p_grant_id,p_nonce_hash,p_valid_until) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count=1;
END $$;
REVOKE ALL ON FUNCTION public.lightspeed_authority_create_v1(jsonb),
  public.lightspeed_authority_read_v1(uuid,text),
  public.lightspeed_authority_update_v1(uuid,integer,text,jsonb),
  public.lightspeed_authority_nonce_v1(uuid,text,timestamptz)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lightspeed_authority_create_v1(jsonb),
  public.lightspeed_authority_read_v1(uuid,text),
  public.lightspeed_authority_update_v1(uuid,integer,text,jsonb),
  public.lightspeed_authority_nonce_v1(uuid,text,timestamptz)
TO service_role;
COMMIT;
