-- Private staging for prepared IdealPOS journal receipts.
--
-- The journal workbooks are too large to send through any reviewed import
-- path. An operator prepares receipts locally, then a platform admin sends
-- them here in hash-checked chunks from their own signed-in session. Nothing
-- here touches customer facts: a separate reviewed step reads the staged
-- receipts, reconciles them and writes the import. Staged rows are deleted
-- once that step finishes.

CREATE TABLE IF NOT EXISTS public.ideal_journal_staging (
  batch_id text NOT NULL,
  seq integer NOT NULL CHECK (seq >= 0),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payload text NOT NULL,
  payload_sha256 text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, seq)
);

ALTER TABLE public.ideal_journal_staging ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ideal_journal_staging FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.stage_ideal_journal_chunk(
  p_tenant_id uuid, p_batch_id text, p_seq integer, p_payload text, p_sha256 text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_hash text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_master_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Platform admin access is required' USING ERRCODE = '42501';
  END IF;
  IF p_tenant_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'Unknown company' USING ERRCODE = '22023';
  END IF;
  IF p_batch_id IS NULL OR p_batch_id !~ '^[a-z0-9-]{8,80}$' OR p_seq IS NULL OR p_seq < 0 THEN
    RAISE EXCEPTION 'Invalid batch' USING ERRCODE = '22023';
  END IF;
  IF p_payload IS NULL OR octet_length(p_payload) > 6 * 1024 * 1024 THEN
    RAISE EXCEPTION 'Chunk exceeds 6 MB' USING ERRCODE = '22023';
  END IF;
  v_hash := encode(extensions.digest(convert_to(p_payload, 'UTF8'), 'sha256'), 'hex');
  IF v_hash IS DISTINCT FROM lower(p_sha256) THEN
    RAISE EXCEPTION 'Chunk hash mismatch' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ideal_journal_staging (batch_id, seq, tenant_id, payload, payload_sha256, created_by)
  VALUES (p_batch_id, p_seq, p_tenant_id, p_payload, v_hash, auth.uid())
  ON CONFLICT (batch_id, seq) DO NOTHING;
  IF NOT EXISTS (
    SELECT 1 FROM public.ideal_journal_staging
    WHERE batch_id = p_batch_id AND seq = p_seq AND payload_sha256 = v_hash AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'A different chunk is already staged at this position' USING ERRCODE = '23505';
  END IF;
  RETURN jsonb_build_object('batch_id', p_batch_id, 'seq', p_seq, 'sha256', v_hash, 'bytes', octet_length(p_payload));
END;
$function$;

REVOKE ALL ON FUNCTION public.stage_ideal_journal_chunk(uuid, text, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stage_ideal_journal_chunk(uuid, text, integer, text, text) TO authenticated;
