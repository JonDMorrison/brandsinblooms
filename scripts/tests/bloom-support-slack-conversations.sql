\set ON_ERROR_STOP on
-- Disposable harness only. No Slack API calls or real users.
SELECT current_database()='bloom_support_test' AS isolated_database \gset
\if :isolated_database
\else
 \quit 3
\endif
BEGIN;
\ir ../../supabase/migrations/20261108133500_bloom_support_slack_diagnostic_staff.sql
\ir ../../supabase/migrations/20261108162000_bloom_support_slack_ticket_threads.sql
\ir ../../supabase/migrations/20261112165850_bloom_support_slack_conversations.sql
DO $$
DECLARE a uuid; b uuid; j uuid; j2 uuid; j3 uuid; c uuid; t uuid; r jsonb; n integer; chan text;
BEGIN
 INSERT INTO bloom_support.settings(key,value) VALUES('slack','{"enabled":true}') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
 INSERT INTO bloom_support.principals(kind,role,display_name) VALUES('user','platform_admin','Slack fixture A') RETURNING id INTO a;
 INSERT INTO bloom_support.principals(kind,role,display_name) VALUES('user','platform_admin','Slack fixture B') RETURNING id INTO b;
 INSERT INTO bloom_support.slack_staff_principals(slack_user_id,principal_id) VALUES('UZZTEST0001',a),('UZZTEST0002',b);
 r:=public.bloom_support_enqueue_slack_conversation('EvTest0001','C0CFUG4LFLJ','UZZTEST0001','Hi','1794500000.000001','1794500000.000001',false);
 IF r->>'reason'<>'unknown_thread' THEN RAISE EXCEPTION 'unmentioned chatter accepted'; END IF;
 r:=public.bloom_support_enqueue_slack_conversation('EvTest0002','C0CFUG4LFLJ','UZZTEST0001','Hi','1794500000.000001','1794500000.000001',true);
 j:=(r->>'job_id')::uuid;
 IF r->>'queued'<>'true' OR j IS NULL THEN RAISE EXCEPTION 'mention not queued'; END IF;
 IF (SELECT timeout_seconds FROM bloom_support.jobs WHERE id=j)<>60 THEN RAISE EXCEPTION 'insufficient worker lease'; END IF;
 r:=public.bloom_support_enqueue_slack_conversation('EvTest0003','C0CFUG4LFLJ','UZZTEST0001','Hi','1794500000.000001','1794500000.000001',false);
 IF r->>'reason'<>'duplicate' OR (r->>'job_id')::uuid<>j THEN RAISE EXCEPTION 'Slack double event not deduped'; END IF;
 IF public.bloom_support_claim_slack_reply(j)->>'claimed'<>'false' THEN RAISE EXCEPTION 'unleased worker claimed'; END IF;
 UPDATE bloom_support.jobs SET status='running' WHERE id=j;
 IF public.bloom_support_claim_slack_reply(j)->>'claimed'<>'true' THEN RAISE EXCEPTION 'first claim refused'; END IF;
 IF public.bloom_support_claim_slack_reply(j)->>'claimed'<>'false' THEN RAISE EXCEPTION 'second progress send allowed'; END IF;
 IF public.bloom_support_record_slack_reply(j,'1794500000.000010',NULL)->>'recorded'<>'true' THEN RAISE EXCEPTION 'progress not saved'; END IF;
 IF public.bloom_support_record_slack_reply(j,'1794500000.000011','wrong destination')->>'recorded'<>'false' THEN RAISE EXCEPTION 'reply moved'; END IF;
 IF public.bloom_support_record_slack_reply(j,'1794500000.000010','Verified safe answer')->>'recorded'<>'true' THEN RAISE EXCEPTION 'final not saved'; END IF;
 IF public.bloom_support_record_slack_reply(j,'1794500000.000010',NULL)->>'recorded'<>'false' THEN RAISE EXCEPTION 'late progress overwrote final'; END IF;
 UPDATE bloom_support.jobs SET status='succeeded',created_at=now()-interval '1 minute' WHERE id=j;
 r:=public.bloom_support_enqueue_slack_conversation('EvTest0004','C0CFUG4LFLJ','UZZTEST0001','yes','1794500000.000001','1794500000.000002',false);
 j2:=(r->>'job_id')::uuid;
 IF r->>'queued'<>'true' THEN RAISE EXCEPTION 'known follow-up rejected'; END IF;
 r:=public.bloom_support_slack_conversation_context(j2);
 IF jsonb_array_length(r->'history')<>1 OR r->'history'->0->>'answer'<>'Verified safe answer' THEN RAISE EXCEPTION 'bounded final history missing'; END IF;
 r:=public.bloom_support_enqueue_slack_conversation('EvTest0005','C0CFUG4LFLJ','UZZTEST0002','yes','1794500000.000001','1794500000.000003',false);
 IF r->>'reason'<>'unknown_thread' THEN RAISE EXCEPTION 'other staff inherited private history'; END IF;
 r:=public.bloom_support_enqueue_slack_conversation('EvTest0006','C0CFUG4LFLJ','UZZTEST0002','Hello','1794500000.000001','1794500000.000003',true);
 j3:=(r->>'job_id')::uuid;
 IF jsonb_array_length(public.bloom_support_slack_conversation_context(j3)->'history')<>0 THEN RAISE EXCEPTION 'cross-user context disclosed'; END IF;
 UPDATE bloom_support.jobs SET status='running' WHERE id=j3;
 PERFORM public.bloom_support_claim_slack_reply(j3);
 PERFORM public.bloom_support_mark_slack_reply_unknown(j3);
 IF public.bloom_support_claim_slack_reply(j3)->>'state'<>'unknown' THEN RAISE EXCEPTION 'uncertain post retried'; END IF;
 UPDATE bloom_support.principals SET active=false WHERE id=a;
 IF public.bloom_support_slack_conversation_context(j2)->>'allowed'<>'false' THEN RAISE EXCEPTION 'revoked actor continued'; END IF;
 UPDATE bloom_support.principals SET active=true WHERE id=a;
 -- All existing delivery channels now acknowledge questions, with no ticket
 -- attached just because a number or close instruction occurs in the text.
 FOREACH chan IN ARRAY ARRAY['C0CFUG4STS6','C0CGP4GPG8G','C0CFNEQBS2X','C0CFYDVE4A0','C0CFDBT8JAK','C0CFWJDUQU9','C0CFUHJ5ESW'] LOOP
  r:=public.bloom_support_enqueue_slack_conversation('EvTestChan1',chan,'UZZTEST0001','close the last two tickets','1794500000.000020','1794500000.000020',true);
  j3:=(r->>'job_id')::uuid;
  IF r->>'queued'<>'true' OR (SELECT ticket_id FROM bloom_support.jobs WHERE id=j3) IS NOT NULL THEN RAISE EXCEPTION 'generic question unsafe routing'; END IF;
 END LOOP;
 INSERT INTO bloom_support.conversations(channel,subject) VALUES('staff','Synthetic Slack') RETURNING id INTO c;
 INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary) VALUES(c,'crm','staff','Synthetic','Test only') RETURNING id INTO t;
 INSERT INTO bloom_support.slack_ticket_threads(ticket_id,root_ts) VALUES(t,'1794500000.000030');
 r:=public.bloom_support_enqueue_slack_conversation('EvTestTick1','C0CFNEQBS2X','UZZTEST0001','what next','1794500000.000030','1794500000.000031',false);
 j3:=(r->>'job_id')::uuid;
 IF (SELECT ticket_id FROM bloom_support.jobs WHERE id=j3) IS DISTINCT FROM t THEN RAISE EXCEPTION 'exact ticket binding lost'; END IF;
 UPDATE bloom_support.tickets SET redacted_at=now() WHERE id=t;
 IF public.bloom_support_slack_conversation_context(j3)->>'allowed'<>'false' THEN RAISE EXCEPTION 'redacted ticket disclosed'; END IF;
 FOREACH chan IN ARRAY ARRAY[
 'public.bloom_support_enqueue_slack_conversation(text,text,text,text,text,text,boolean)',
 'public.bloom_support_slack_conversation_context(uuid)',
 'public.bloom_support_claim_slack_reply(uuid)',
 'public.bloom_support_record_slack_reply(uuid,text,text)',
 'public.bloom_support_mark_slack_reply_unknown(uuid)'] LOOP
 IF has_function_privilege('anon',chan,'EXECUTE') OR has_function_privilege('authenticated',chan,'EXECUTE') THEN RAISE EXCEPTION 'public service RPC'; END IF;
 END LOOP;
END $$;
ROLLBACK;
\echo 'bloom-support-slack-conversations: all assertions passed'
