-- "Draft a reply, but do not send it" is a safe draft request, not a send request.
DO $migration$
DECLARE body text; before text:=$old$OR q ~ '\m(do not|don''t|don’t|never|without|not yet|example|hypothetical)\M'$old$; after text:=$new$OR q ~ '\m((do not|don''t|don’t|never)[[:space:]]+(draft|prepare|write)|not yet|example|hypothetical|how (do|can|would))\M'$new$;
BEGIN
 SELECT pg_get_functiondef('public.bloom_support_prepare_slack_reply(uuid,text)'::regprocedure) INTO body;
 IF strpos(body,before)=0 THEN RAISE EXCEPTION 'Expected draft-intent guard not found; refusing an unreviewed rewrite'; END IF;
 EXECUTE replace(body,before,after);
END $migration$;
