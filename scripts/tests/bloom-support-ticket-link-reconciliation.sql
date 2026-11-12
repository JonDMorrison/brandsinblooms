\set ON_ERROR_STOP on
-- Included by the disposable-only bloom-support-db.sql harness.
SELECT current_database()='bloom_support_test' AS isolated_database \gset
\if :isolated_database
\else
  \echo 'Refusing to run outside disposable bloom_support_test'
  \quit 3
\endif
BEGIN;
\ir ../../supabase/migrations/20261112151238_bloom_support_reconcile_ticket_links.sql
DO $$
DECLARE a uuid; svc uuid; c uuid; source uuid; target uuid; other uuid; e uuid; f uuid; pb uuid;
  before_edge jsonb; audit_detail jsonb; before_ticket jsonb; after_ticket jsonb; feature_before jsonb; req jsonb; result jsonb; v integer;
BEGIN
  INSERT INTO bloom_support.principals(kind,auth_user_id,role,display_name) VALUES('user',gen_random_uuid(),'support','Reconciliation fixture') RETURNING id INTO a;
  INSERT INTO bloom_support.principals(kind,role,grants,display_name) VALUES('service','service',ARRAY['automation'],'Denied automation') RETURNING id INTO svc;
  INSERT INTO bloom_support.conversations(channel,subject) VALUES('staff','Synthetic link reconciliation') RETURNING id INTO c;
  INSERT INTO bloom_support.engineering_issues(title,product) VALUES('Unrelated fixture engineering','cms') RETURNING id INTO e;
  INSERT INTO bloom_support.feature_requests(title,description,product,status,decided_by,decided_at) VALUES('Unrelated approved feature','Preserve decision','cms','accepted',a,now()) RETURNING id INTO f;
  INSERT INTO bloom_support.problems(title,product,engineering_issue_id) VALUES('Unrelated fixture problem','cms',e) RETURNING id INTO pb;
  INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary,engineering_issue_id,feature_request_id,problem_id)
    VALUES(c,'cms','staff','Duplicate target','Target fixture',e,f,pb) RETURNING id INTO target;
  INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary,status,kind,owner_id,automation,executor)
    VALUES(c,'cms','staff','Independent request','Source fixture','working','bug',a,'human','person') RETURNING id INTO source;
  INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary) VALUES(c,'cms','staff','Other request','Other fixture') RETURNING id INTO other;
  PERFORM bloom_support.link_tickets(a,source,target,'duplicate');
  PERFORM bloom_support.link_tickets(a,source,target,'related');
  PERFORM bloom_support.link_tickets(a,source,other,'follow_up');
  INSERT INTO bloom_support.messages(conversation_id,ticket_id,author_id,author_kind,visibility,direction,body)
    VALUES(c,source,a,'staff','internal','internal','Preserve exact conversation');
  SELECT to_jsonb(t),version INTO before_ticket,v FROM bloom_support.tickets t WHERE id=source;
  SELECT to_jsonb(fr) INTO feature_before FROM bloom_support.feature_requests fr WHERE id=f;
  req:=jsonb_build_object('version',v,'idempotency_key','fixture-detach','reason','Verified separate client request; these links were inherited from a mistaken duplicate',
    'next_action','Review the independent report and identify its actual investigation; no repair has been started',
    'expected',jsonb_build_object('duplicate_of',target,'merged_into',NULL,'problem_id',pb,'engineering_issue_id',e,'feature_request_id',f),
    'clear_inherited',jsonb_build_array('problem_id','engineering_issue_id','feature_request_id'));
  BEGIN PERFORM public.bloom_support_reconcile_ticket_links(svc,source,req); RAISE EXCEPTION 'service accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.bloom_support_reconcile_ticket_links(a,source,req||jsonb_build_object('version',v+1)); RAISE EXCEPTION 'stale version accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
  BEGIN PERFORM public.bloom_support_reconcile_ticket_links(a,source,jsonb_set(req,'{expected,problem_id}','null')); RAISE EXCEPTION 'stale tuple accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
  BEGIN PERFORM public.bloom_support_reconcile_ticket_links(a,source,jsonb_set(req,'{expected}',(req->'expected')-'merged_into')); RAISE EXCEPTION 'partial tuple accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN PERFORM public.bloom_support_reconcile_ticket_links(a,source,req||'{"reason":" "}'); RAISE EXCEPTION 'empty reason accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN PERFORM public.bloom_support_reconcile_ticket_links(a,source,req||'{"clear_inherited":["owner_id"]}'); RAISE EXCEPTION 'arbitrary field accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN PERFORM public.bloom_support_reconcile_ticket_links(a,source,req||'{"clear_inherited":["engineering_issue_id"]}'); RAISE EXCEPTION 'retained problem accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
  BEGIN
    PERFORM bloom_support.log(source,NULL,a,'engineering.linked',jsonb_build_object('engineering_issue_id',e));
    PERFORM public.bloom_support_reconcile_ticket_links(a,source,req);
    RAISE EXCEPTION 'independent engineering accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  BEGIN
    PERFORM bloom_support.log(source,NULL,a,'problem.linked',jsonb_build_object('problem_id',pb));
    PERFORM public.bloom_support_reconcile_ticket_links(a,source,req);
    RAISE EXCEPTION 'independent problem accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  -- A separately routed feature must not be mistaken for duplicate inheritance.
  INSERT INTO bloom_support.feature_evidence(feature_request_id,ticket_id) VALUES(f,source);
  BEGIN PERFORM public.bloom_support_reconcile_ticket_links(a,source,req); RAISE EXCEPTION 'independent feature evidence accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
  DELETE FROM bloom_support.feature_evidence WHERE feature_request_id=f AND ticket_id=source;
  PERFORM pg_temp.assert((SELECT to_jsonb(t)=before_ticket FROM bloom_support.tickets t WHERE id=source),'failed requests leave source unchanged');
  PERFORM pg_temp.assert((SELECT count(*)=0 FROM bloom_support.ticket_link_reconciliation_receipts WHERE actor_id=a),'failed requests leave no receipt');
  SELECT to_jsonb(link) INTO before_edge FROM bloom_support.ticket_links link WHERE from_ticket=source AND to_ticket=target AND kind='duplicate';
  result:=public.bloom_support_reconcile_ticket_links(a,source,req);
  SELECT detail INTO audit_detail FROM bloom_support.activity WHERE ticket_id=source AND action='ticket.links_reconciled';
  PERFORM pg_temp.assert(audit_detail->'deleted_edge'=before_edge,'audit retains full removed edge including original author and timestamp');
  PERFORM pg_temp.assert(audit_detail->'previous_next_action'=before_ticket->'next_action' AND audit_detail->'previous_version'=before_ticket->'version','audit retains previous next action and version');
  PERFORM pg_temp.assert(audit_detail->'before'=req->'expected','audit retains complete prior association tuple');
  SELECT to_jsonb(t) INTO after_ticket FROM bloom_support.tickets t WHERE id=source;
  PERFORM pg_temp.assert(after_ticket->'duplicate_of'='null' AND after_ticket->'problem_id'='null' AND after_ticket->'engineering_issue_id'='null' AND after_ticket->'feature_request_id'='null','only selected inherited tuple detached');
  PERFORM pg_temp.assert((before_ticket-ARRAY['duplicate_of','problem_id','engineering_issue_id','feature_request_id','next_action','version','updated_at'])=(after_ticket-ARRAY['duplicate_of','problem_id','engineering_issue_id','feature_request_id','next_action','version','updated_at']),'all other ticket fields preserved');
  PERFORM pg_temp.assert((after_ticket->>'version')::int=v+1,'one exact version bump');
  PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM bloom_support.ticket_links WHERE from_ticket=source AND to_ticket=target AND kind='duplicate'),'wrong duplicate edge removed');
  PERFORM pg_temp.assert((SELECT count(*)=2 FROM bloom_support.ticket_links WHERE from_ticket=source),'other edges preserved');
  PERFORM pg_temp.assert((SELECT count(*)=1 FROM bloom_support.messages WHERE ticket_id=source AND body='Preserve exact conversation'),'message preserved');
  PERFORM pg_temp.assert((SELECT to_jsonb(fr)=feature_before FROM bloom_support.feature_requests fr WHERE id=f),'feature decision preserved');
  PERFORM pg_temp.assert(public.bloom_support_reconcile_ticket_links(a,source,req)=result,'exact retry returns receipt despite old version');
  BEGIN PERFORM public.bloom_support_reconcile_ticket_links(a,source,req||'{"reason":"different request"}'); RAISE EXCEPTION 'changed replay accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
  PERFORM pg_temp.assert((SELECT count(*)=1 FROM bloom_support.activity WHERE ticket_id=source AND action='ticket.links_reconciled'),'one audit record');
  PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM bloom_support.jobs WHERE ticket_id=source AND kind IN ('investigate','engineering_step','send_email')),'no repair or client email dispatched');
  -- Unselected links remain even when they match the target; selection is not inferred.
  PERFORM bloom_support.link_tickets(a,source,target,'duplicate');
  SELECT version INTO v FROM bloom_support.tickets WHERE id=source;
  req:=req||jsonb_build_object('version',v,'idempotency_key','fixture-preserve','clear_inherited','[]'::jsonb);
  PERFORM public.bloom_support_reconcile_ticket_links(a,source,req);
  PERFORM pg_temp.assert((SELECT duplicate_of IS NULL AND engineering_issue_id=e AND problem_id=pb AND feature_request_id=f FROM bloom_support.tickets WHERE id=source),'unselected associations preserved');
  PERFORM pg_temp.assert(NOT has_function_privilege('anon','public.bloom_support_reconcile_ticket_links(uuid,uuid,jsonb)','EXECUTE') AND NOT has_function_privilege('authenticated','public.bloom_support_reconcile_ticket_links(uuid,uuid,jsonb)','EXECUTE'),'no public execution');
END $$;
ROLLBACK;
