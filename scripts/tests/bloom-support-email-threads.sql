\set ON_ERROR_STOP on
SELECT current_database()='bloom_support_test' AS isolated_database \gset
\if :isolated_database
\else
  \quit 3
\endif
BEGIN;
\ir ../../supabase/migrations/20261115185804_bloom_support_verified_email_threads.sql
DO $$
DECLARE c uuid; c2 uuid; t uuid; t2 uuid; extra uuid; source_ticket uuid; source_conversation uuid; actor uuid; other_actor uuid; account uuid; account2 uuid; number bigint; r jsonb; n bigint;
BEGIN
 INSERT INTO bloom_support.accounts(name) VALUES('Thread fixture one') RETURNING id INTO account;
 INSERT INTO bloom_support.accounts(name) VALUES('Thread fixture two') RETURNING id INTO account2;
 INSERT INTO bloom_support.principals(kind,product,external_id,email,role) VALUES('external_user','email',gen_random_uuid()::text,'thread-one@example.test','client') RETURNING id INTO actor;
 INSERT INTO bloom_support.principals(kind,product,external_id,email,role) VALUES('external_user','email',gen_random_uuid()::text,'thread-two@example.test','client') RETURNING id INTO other_actor;
 INSERT INTO bloom_support.account_members(account_id,principal_id,relationship,verified) VALUES(account,actor,'email_contact',true),(account2,other_actor,'email_contact',true);
 INSERT INTO bloom_support.conversations(account_id,requester_id,channel,subject,email_thread_root) VALUES(account,actor,'email','Thread fixture','<thread-one@example.test>') RETURNING id INTO c;
 INSERT INTO bloom_support.conversations(account_id,requester_id,channel,subject,email_thread_root) VALUES(account2,other_actor,'email','Other fixture','<thread-two@example.test>') RETURNING id INTO c2;
 INSERT INTO bloom_support.tickets(conversation_id,account_id,requester_id,product,channel,subject,summary,status,automation)
 VALUES(c,account,actor,'crm','email','Thread one','','working','paused') RETURNING id,tickets.number INTO t,number;
 INSERT INTO bloom_support.tickets(conversation_id,account_id,requester_id,product,channel,subject,summary,status,automation)
 VALUES(c2,account2,other_actor,'crm','email','Thread two','','working','paused') RETURNING id INTO t2;
 IF bloom_support.match_email_thread('{}',number) IS NOT NULL THEN RAISE EXCEPTION 'subject-only matched'; END IF;
 IF bloom_support.match_email_thread(ARRAY['<unknown@example.test>'],number) IS NOT NULL THEN RAISE EXCEPTION 'unknown reference fell back to subject'; END IF;
 IF bloom_support.match_email_thread(ARRAY['<thread-one@example.test>'],NULL) IS DISTINCT FROM t THEN RAISE EXCEPTION 'known reference missing'; END IF;
 IF bloom_support.match_email_thread(ARRAY['<thread-one@example.test>','<thread-two@example.test>'],number) IS NOT NULL THEN RAISE EXCEPTION 'cross-account references guessed a ticket'; END IF;
 BEGIN
  PERFORM bloom_support.append_inbound_email(actor,t2,'Untrusted cross-account reply','<cross@example.test>','<thread-two@example.test>');
  RAISE EXCEPTION 'cross-account write allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 r:=bloom_support.append_inbound_email(actor,t,'Checkout works but shipment is missing','<partial@example.test>','<thread-one@example.test>');
 r:=bloom_support.append_inbound_email(actor,t,'Checkout works but shipment is missing','<partial@example.test>','<thread-one@example.test>');
 IF r->>'duplicate'<>'true' THEN RAISE EXCEPTION 'message replay not idempotent'; END IF;
 SELECT count(*) INTO n FROM bloom_support.messages WHERE ticket_id=t AND email_message_id='<partial@example.test>';
 IF n<>1 OR (SELECT status='resolved' OR resolution_verified FROM bloom_support.tickets WHERE id=t) THEN RAISE EXCEPTION 'duplicate message or false closure'; END IF;
 BEGIN
  PERFORM bloom_support.append_inbound_email(actor,t,'Everything fixed','<partial@example.test>','<thread-one@example.test>');
  RAISE EXCEPTION 'changed replay accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 INSERT INTO bloom_support.tickets(conversation_id,account_id,requester_id,product,channel,subject,summary,status)
 VALUES(c,account,actor,'crm','email','Separate issue in shared thread','','working') RETURNING id INTO extra;
 IF bloom_support.match_email_thread(ARRAY['<thread-one@example.test>'],NULL) IS NOT NULL THEN RAISE EXCEPTION 'shared thread guessed most recent ticket'; END IF;
 UPDATE bloom_support.tickets SET merged_into=t WHERE id=extra;
 IF bloom_support.match_email_thread(ARRAY['<thread-one@example.test>'],NULL) IS DISTINCT FROM t THEN RAISE EXCEPTION 'canonical merged thread not found'; END IF;
 INSERT INTO bloom_support.conversations(account_id,requester_id,channel,subject,email_thread_root) VALUES(account,actor,'email','Merged source','<merged-source@example.test>') RETURNING id INTO source_conversation;
 INSERT INTO bloom_support.tickets(conversation_id,account_id,requester_id,product,channel,subject,summary,status,merged_into)
 VALUES(source_conversation,account,actor,'crm','email','Merged source','','working',extra) RETURNING id INTO source_ticket;
 UPDATE bloom_support.tickets SET redacted_at=now() WHERE id=extra;
 IF bloom_support.match_email_thread(ARRAY['<merged-source@example.test>'],NULL) IS NOT NULL THEN RAISE EXCEPTION 'redacted intermediate followed'; END IF;
 IF bloom_support.match_email_thread(ARRAY['<thread-one@example.test>'],NULL) IS NOT NULL THEN RAISE EXCEPTION 'redacted source followed'; END IF;
 UPDATE bloom_support.tickets SET redacted_at=NULL,spam=true WHERE id=extra;
 IF bloom_support.match_email_thread(ARRAY['<thread-one@example.test>'],NULL) IS NOT NULL THEN RAISE EXCEPTION 'spam source followed'; END IF;
 UPDATE bloom_support.tickets SET spam=false WHERE id=extra;
 IF bloom_support.match_email_thread(ARRAY(SELECT '<ref-'||i||'@example.test>' FROM generate_series(1,50) i)||ARRAY['<thread-one@example.test>'],NULL) IS NOT NULL THEN RAISE EXCEPTION 'overlong references accepted'; END IF;
 UPDATE bloom_support.tickets SET merged_into=extra WHERE id=t;
 IF bloom_support.match_email_thread(ARRAY['<thread-one@example.test>'],NULL) IS NOT NULL THEN RAISE EXCEPTION 'merge cycle accepted'; END IF;
 IF has_function_privilege('authenticated','bloom_support.match_email_thread(text[],bigint)','execute') THEN RAISE EXCEPTION 'private matching exposed'; END IF;
END $$;
ROLLBACK;
\echo 'bloom-support-email-threads: all assertions passed'
