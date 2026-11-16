-- Same atomic snapshot/transition pattern as Stripe/Notion reconciliation;
-- activity evidence is separate from billing and never updates customer records.
CREATE TABLE public.support_activity_reconciliation_state (
 scope text PRIMARY KEY, evidence jsonb NOT NULL, observed_at timestamptz NOT NULL,
 first_seen_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.support_activity_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scope text NOT NULL, recipient text NOT NULL,
 evidence jsonb NOT NULL, status text NOT NULL DEFAULT 'sending' CHECK(status IN ('sending','sent')),
 provider_id text, created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz
);
ALTER TABLE public.support_activity_reconciliation_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_activity_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_activity_reconciliation_state,public.support_activity_notifications FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.support_activity_reconciliation_state,public.support_activity_notifications TO service_role;
CREATE FUNCTION public.reconcile_support_activity_snapshot(p_scope text,p_recipient text,p_rows jsonb,p_observed_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE row_data jsonb; previous jsonb; changes jsonb := '[]'; batch uuid; old_row jsonb; prior public.support_activity_reconciliation_state;
BEGIN
 IF length(coalesce(p_scope,'')) NOT BETWEEN 1 AND 100 OR length(coalesce(p_recipient,'')) NOT BETWEEN 3 AND 320
   OR p_observed_at IS NULL OR NOT isfinite(p_observed_at) OR p_observed_at>now()+interval '1 minute' OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid activity snapshot'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) r WHERE r->>'page_id' IS NULL OR r->>'signal' IS NULL
    OR r->>'signal' NOT IN ('identity_review','activity_unknown','no_recent_sign_in','recent_sign_in'))
   OR (SELECT count(*) FROM jsonb_array_elements(p_rows))<>(SELECT count(DISTINCT r->>'page_id') FROM jsonb_array_elements(p_rows) r)
 THEN RAISE EXCEPTION 'invalid activity evidence'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('support-activity:'||p_scope,0));
 SELECT * INTO prior FROM public.support_activity_reconciliation_state WHERE scope=p_scope;
 IF FOUND AND prior.observed_at>=p_observed_at THEN
   RETURN jsonb_build_object('batch_id',null,'rows','[]'::jsonb,'stale',true,
     'unconfirmed',EXISTS(SELECT 1 FROM public.support_activity_notifications WHERE scope=p_scope AND status='sending'));
 END IF;
 FOR row_data IN SELECT value FROM jsonb_array_elements(p_rows) ORDER BY value->>'page_id' LOOP
   PERFORM (row_data->>'page_id')::uuid;
   SELECT value INTO previous FROM jsonb_array_elements(coalesce(prior.evidence,'[]')) WHERE value->>'page_id'=row_data->>'page_id';
   IF previous IS DISTINCT FROM row_data AND (previous IS NOT NULL OR row_data->>'signal'<>'recent_sign_in') THEN changes:=changes||jsonb_build_array(row_data); END IF;
 END LOOP;
 FOR old_row IN SELECT value FROM jsonb_array_elements(coalesce(prior.evidence,'[]')) old
   WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) r WHERE r->>'page_id'=old.value->>'page_id') LOOP
   changes:=changes||jsonb_build_array(old_row||jsonb_build_object('signal','not_in_active_snapshot','detail','No longer in the Notion Active snapshot. This does not establish customer activity, billing or resolution.'));
 END LOOP;
 INSERT INTO public.support_activity_reconciliation_state(scope,evidence,observed_at) VALUES(p_scope,p_rows,p_observed_at)
 ON CONFLICT(scope) DO UPDATE SET evidence=excluded.evidence,observed_at=excluded.observed_at,last_seen_at=now();
 IF jsonb_array_length(changes)>0 THEN
   INSERT INTO public.support_activity_notifications(scope,recipient,evidence) VALUES(p_scope,p_recipient,changes) RETURNING id INTO batch;
 END IF;
 RETURN jsonb_build_object('batch_id',batch,'rows',changes,'unconfirmed',EXISTS(SELECT 1 FROM public.support_activity_notifications WHERE scope=p_scope AND status='sending' AND id IS DISTINCT FROM batch));
END $$;
CREATE FUNCTION public.complete_support_activity_notice(p_batch uuid,p_provider_id text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF length(coalesce(p_provider_id,'')) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'provider receipt required'; END IF;
 UPDATE public.support_activity_notifications SET status='sent',provider_id=p_provider_id,sent_at=coalesce(sent_at,now())
 WHERE id=p_batch AND (provider_id IS NULL OR provider_id=p_provider_id);
 IF NOT FOUND THEN RAISE EXCEPTION 'missing or conflicting activity receipt'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.reconcile_support_activity_snapshot(text,text,jsonb,timestamptz),public.complete_support_activity_notice(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_support_activity_snapshot(text,text,jsonb,timestamptz),public.complete_support_activity_notice(uuid,text) TO service_role;
