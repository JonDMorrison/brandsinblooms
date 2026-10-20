BEGIN;
ALTER TABLE public.lightspeed_storefront_grants ADD COLUMN edition text NOT NULL DEFAULT 'x-series' CHECK(edition IN ('x-series','r-series'));
CREATE OR REPLACE FUNCTION public.lightspeed_authority_create_v1(p_context jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_row public.lightspeed_storefront_grants;
BEGIN
  IF (p_context->>'expiresAt')::timestamptz <= now()
    OR (p_context->>'expiresAt')::timestamptz > now()+interval '11 minutes' THEN
    RAISE EXCEPTION 'authorization_expired';
  END IF;
  INSERT INTO public.lightspeed_storefront_grants(edition,site_id,state_hash,prefix,public_key,expires_at)
  VALUES(coalesce(p_context->>'edition','x-series'),(p_context->>'siteId')::uuid,p_context->>'stateHash',p_context->>'prefix',p_context->'publicKey',(p_context->>'expiresAt')::timestamptz)
  ON CONFLICT(state_hash) DO NOTHING;
  SELECT * INTO v_row FROM public.lightspeed_storefront_grants WHERE state_hash=p_context->>'stateHash';
  RETURN to_jsonb(v_row);
END $$;
COMMIT;
