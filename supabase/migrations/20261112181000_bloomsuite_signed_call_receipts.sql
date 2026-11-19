-- Central login milestone 50 (Wave 5c): one use per signed BloomSuite ID call (46/R-01).
-- The revoke receiver (bloomsuite-revoke) records the SHA-256 of each accepted signature; the identical request
-- delivered again inside its 300-second window is refused. A BloomSuite ID retry signs a new timestamp, so it is a
-- new message and is still accepted. Same design as the CMS's receiver (central-login 41, cms-r1-F07).
-- Forward-only; no earlier migration is edited. Needs the bloomsuite_private schema (20261111141000).

CREATE TABLE IF NOT EXISTS bloomsuite_private.signed_call_receipts (
  signature_sha256 text PRIMARY KEY CHECK (signature_sha256 ~ '^[0-9a-f]{64}$'),
  signed_at timestamptz NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON bloomsuite_private.signed_call_receipts FROM PUBLIC, anon, authenticated;

-- True the first time a signature is seen, false for a repeat. Receipts only need to outlive the 300-second window
-- (either side of the signed time), so older ones are cleared on the way in.
CREATE OR REPLACE FUNCTION public.bloomsuite_accept_signed_call(p_signature_sha256 text, p_signed_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  accepted integer;
BEGIN
  IF p_signature_sha256 IS NULL OR p_signature_sha256 !~ '^[0-9a-f]{64}$' OR p_signed_at IS NULL THEN
    RETURN false;
  END IF;
  DELETE FROM bloomsuite_private.signed_call_receipts r WHERE r.seen_at < now() - interval '15 minutes';
  INSERT INTO bloomsuite_private.signed_call_receipts (signature_sha256, signed_at)
  VALUES (p_signature_sha256, p_signed_at)
  ON CONFLICT (signature_sha256) DO NOTHING;
  GET DIAGNOSTICS accepted = ROW_COUNT;
  RETURN accepted = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.bloomsuite_accept_signed_call(text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloomsuite_accept_signed_call(text, timestamptz) TO service_role;
