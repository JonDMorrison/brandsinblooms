-- Bloom Support: a short plain-language summary for each escalation.
--
-- Escalation details are often engineering notes (file paths, test names).
-- The Support desk shows a person "the problem" and "why Bloom stopped" in
-- plain words instead. The summary is written once by the model from the
-- ticket and the escalation, validated by the API, and stored here so every
-- viewer sees the same text and the model runs once per escalation.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';

ALTER TABLE bloom_support.escalations ADD COLUMN IF NOT EXISTS plain jsonb;

COMMENT ON COLUMN bloom_support.escalations.plain IS
  'Plain-language summary for staff: {problem, blocker, model, at}. Written once; null until generated.';

-- What the model needs to write the summary. Staff with escalations.view only.
CREATE OR REPLACE FUNCTION public.bloom_support_escalation_context(p_actor uuid, p_escalation uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE r jsonb;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'escalations.view');
  SELECT jsonb_build_object(
    'id', e.id,
    'reason', e.reason,
    'detail', left(coalesce(e.detail, ''), 4000),
    'recommendation', e.recommendation,
    'plain', e.plain,
    'subject', t.subject,
    'summary', left(coalesce(t.summary, ''), 4000),
    'product', t.product,
    'account', a.name,
    'account_key', coalesce(t.account_id::text, 'none')
  )
  INTO r
  FROM bloom_support.escalations e
  LEFT JOIN bloom_support.tickets t ON t.id = e.ticket_id
  LEFT JOIN bloom_support.accounts a ON a.id = t.account_id
  WHERE e.id = p_escalation;
  IF r IS NULL THEN
    RAISE EXCEPTION 'not_found: escalation' USING ERRCODE = 'P0002';
  END IF;
  RETURN r;
END $$;

-- Store the validated summary. First write wins, so concurrent viewers never
-- overwrite each other and the text stays stable once a person has read it.
CREATE OR REPLACE FUNCTION public.bloom_support_save_escalation_plain(p_actor uuid, p_escalation uuid, p_plain jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_problem text := btrim(coalesce(p_plain->>'problem', ''));
  v_blocker text := btrim(coalesce(p_plain->>'blocker', ''));
  v_saved jsonb;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'escalations.view');
  IF v_problem = '' OR length(v_problem) > 400 OR length(v_blocker) > 400 THEN
    RAISE EXCEPTION 'invalid: plain summary' USING ERRCODE = '22023';
  END IF;
  UPDATE bloom_support.escalations
  SET plain = jsonb_build_object(
    'problem', v_problem,
    'blocker', nullif(v_blocker, ''),
    'model', left(coalesce(p_plain->>'model', ''), 100),
    'at', now()
  )
  WHERE id = p_escalation AND plain IS NULL
  RETURNING plain INTO v_saved;
  IF v_saved IS NULL THEN
    SELECT plain INTO v_saved FROM bloom_support.escalations WHERE id = p_escalation;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found: escalation' USING ERRCODE = 'P0002';
    END IF;
  END IF;
  RETURN v_saved;
END $$;

REVOKE ALL ON FUNCTION public.bloom_support_escalation_context(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bloom_support_save_escalation_plain(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_escalation_context(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bloom_support_save_escalation_plain(uuid, uuid, jsonb) TO service_role;
