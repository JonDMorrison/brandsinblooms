-- A feature acknowledgement promises that Bloom will share the outcome.
-- Keep that promise with a durable worker job. The worker writes the public
-- message as Bloom, so an admin decision does not accidentally turn the
-- whole conversation over to a person.

CREATE OR REPLACE FUNCTION bloom_support.decide_feature_request(
  p_actor uuid,
  p_feature uuid,
  p_decision text,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  tk record;
  previous bloom_support.feature_requests;
  changed boolean;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'features.decide');
  IF p_decision NOT IN ('accepted', 'declined', 'planned', 'shipped') THEN
    RAISE EXCEPTION 'invalid decision' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO previous
  FROM bloom_support.feature_requests
  WHERE id = p_feature
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: feature request' USING ERRCODE = 'P0002';
  END IF;

  changed := previous.status IS DISTINCT FROM p_decision;

  UPDATE bloom_support.feature_requests
  SET status = p_decision,
      decision_note = p_note,
      decided_by = p_actor,
      decided_at = now(),
      updated_at = now()
  WHERE id = p_feature;

  UPDATE bloom_support.escalations
  SET status = 'resolved',
      decision = p_decision || coalesce(': ' || p_note, ''),
      decided_by = p_actor,
      resolved_at = now()
  WHERE feature_request_id = p_feature
    AND status <> 'resolved';

  FOR tk IN
    SELECT id, account_id
    FROM bloom_support.tickets
    WHERE feature_request_id = p_feature
      AND status <> 'resolved'
  LOOP
    IF changed THEN
      UPDATE bloom_support.tickets
      SET stage = 'answering',
          status = 'working',
          next_action = 'Tell the client the decision: ' || p_decision,
          version = version + 1,
          updated_at = now()
      WHERE id = tk.id;

      PERFORM bloom_support.log(
        tk.id,
        tk.account_id,
        p_actor,
        'feature.decided',
        jsonb_build_object('decision', p_decision, 'note', p_note)
      );

      PERFORM bloom_support.enqueue_job(
        'answer',
        tk.id,
        NULL,
        'account:' || coalesce(tk.account_id::text, 'none:' || tk.id::text),
        jsonb_build_object('mode', 'feature_decision', 'decision', p_decision),
        'feature-decision:' || p_feature::text || ':' || tk.id::text || ':' || previous.status || '->' || p_decision || ':' || previous.updated_at::text
      );
    ELSE
      PERFORM bloom_support.log(
        tk.id,
        tk.account_id,
        p_actor,
        'feature.decision_note_updated',
        jsonb_build_object('decision', p_decision, 'note', p_note)
      );
    END IF;
  END LOOP;

  RETURN (
    SELECT to_jsonb(feature)
    FROM bloom_support.feature_requests feature
    WHERE feature.id = p_feature
  );
END
$$;
