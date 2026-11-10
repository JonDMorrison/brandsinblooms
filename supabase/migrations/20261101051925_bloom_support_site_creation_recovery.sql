-- Retry only the explicitly idempotent, person-confirmed site creation flow.
-- Expired requests reach CMS in resume-only mode: recover an existing draft
-- and its client link, never create from an expired preview.
CREATE OR REPLACE FUNCTION bloom_support.claim_operation(p_actor uuid, p_operation uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o bloom_support.operations; retrying boolean := false;
BEGIN
  SELECT * INTO o FROM bloom_support.operations WHERE id = p_operation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: operation' USING ERRCODE = 'P0002'; END IF;
  PERFORM bloom_support.require_permission(p_actor, o.permission);
  IF NOT bloom_support.can_access_account(p_actor, o.account_id) THEN
    RAISE EXCEPTION 'forbidden: account' USING ERRCODE = '42501';
  END IF;
  IF o.kind = 'site.create_draft' THEN
    IF NOT bloom_support.is_staff(p_actor) THEN
      RAISE EXCEPTION 'forbidden: site creation needs a person' USING ERRCODE = '42501';
    END IF;
    IF o.inputs->>'expected_account_id' IS DISTINCT FROM o.account_id::text
       OR coalesce(o.inputs->>'expected_creator_id','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
       OR coalesce(o.inputs->>'expected_creator_email','') = ''
       OR NOT (o.inputs ? 'expected_tenant_id' AND o.inputs ? 'expected_anchor_site_id') THEN
      RAISE EXCEPTION 'invalid: site creation needs a fresh client and owner preview' USING ERRCODE = '22023';
    END IF;
    retrying := o.confirmed_by IS NOT NULL AND (o.status = 'failed'
      OR (o.status = 'executing' AND o.updated_at < now() - interval '5 minutes'));
  END IF;
  IF o.status <> 'previewed' AND NOT retrying THEN RETURN to_jsonb(o) || '{"already":true}'; END IF;
  IF NOT retrying AND o.expires_at < now() THEN
    UPDATE bloom_support.operations SET status = 'expired', updated_at = now() WHERE id = o.id RETURNING * INTO o;
    RETURN to_jsonb(o);
  END IF;
  UPDATE bloom_support.operations SET status = 'executing', confirmed_by = p_actor, updated_at = now()
    WHERE id = o.id RETURNING * INTO o;
  PERFORM bloom_support.log(o.ticket_id, o.account_id, p_actor,
    CASE WHEN retrying THEN 'operation.retried' ELSE 'operation.confirmed' END,
    jsonb_build_object('operation_id', o.id, 'kind', o.kind, 'resume_only', retrying AND o.expires_at < now()));
  RETURN to_jsonb(o);
END $$;
