\set ON_ERROR_STOP on
DO $$BEGIN IF current_database()<>'support_activity_test' THEN RAISE EXCEPTION 'isolated test database required'; END IF; END$$;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
END$$;
\ir ../../supabase/migrations/20261115235416_bloom_support_activity_reconciliation.sql
CREATE EXTENSION IF NOT EXISTS dblink;
DO $$DECLARE r jsonb; initial uuid; evidence jsonb := '[{"page_id":"10000000-0000-4000-8000-000000000001","signal":"activity_unknown","detail":"Review"}]'; BEGIN
 r:=public.reconcile_support_activity_snapshot('unit','staff@example.test',evidence,now()-interval '10 minutes');
 initial:=(r->>'batch_id')::uuid; IF initial IS NULL THEN RAISE EXCEPTION 'first risk missing'; END IF;
 r:=public.reconcile_support_activity_snapshot('unit','staff@example.test',evidence,now()-interval '9 minutes');
 IF r->>'batch_id' IS NOT NULL OR r->>'unconfirmed'<>'true' THEN RAISE EXCEPTION 'duplicate resend or hidden uncertain delivery'; END IF;
 PERFORM public.complete_support_activity_notice(initial,'provider1');
 PERFORM public.complete_support_activity_notice(initial,'provider1');
 BEGIN PERFORM public.complete_support_activity_notice(initial,'provider2'); RAISE EXCEPTION 'conflict accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='conflict accepted' THEN RAISE; END IF; END;
 r:=public.reconcile_support_activity_snapshot('unit','staff@example.test',evidence,now()-interval '8 minutes');
 IF r->>'batch_id' IS NOT NULL OR r->>'unconfirmed'<>'false' THEN RAISE EXCEPTION 'repeat sent risk'; END IF;
 r:=public.reconcile_support_activity_snapshot('unit','staff@example.test','[]',now()-interval '7 minutes');
 IF r->>'batch_id' IS NULL OR r->'rows'->0->>'signal'<>'not_in_active_snapshot' THEN RAISE EXCEPTION 'missing scope transition'; END IF;
 r:=public.reconcile_support_activity_snapshot('unit','staff@example.test',evidence,now()-interval '8 minutes');
 IF r->>'stale'<>'true' OR r->>'batch_id' IS NOT NULL THEN RAISE EXCEPTION 'older snapshot reversed newer empty state'; END IF;
 IF (SELECT s.evidence FROM public.support_activity_reconciliation_state s WHERE scope='unit')<>'[]'::jsonb THEN RAISE EXCEPTION 'stale state written'; END IF;
 r:=public.reconcile_support_activity_snapshot('unit','staff@example.test',evidence,now()-interval '6 minutes');
 IF r->>'batch_id' IS NULL THEN RAISE EXCEPTION 'genuine recurrent risk suppressed'; END IF;
 IF (SELECT count(*) FROM public.support_activity_notifications WHERE scope='unit')<>3 THEN RAISE EXCEPTION 'wrong episode count'; END IF;
 IF has_function_privilege('authenticated','public.reconcile_support_activity_snapshot(text,text,jsonb,timestamptz)','EXECUTE') OR has_table_privilege('authenticated','public.support_activity_notifications','SELECT') THEN RAISE EXCEPTION 'client access'; END IF;
END$$;
SELECT dblink_connect('activity_a','dbname=support_activity_test');
SELECT dblink_connect('activity_b','dbname=support_activity_test');
SELECT dblink_exec('activity_a','BEGIN');
SELECT * FROM dblink('activity_a',$q$SELECT public.reconcile_support_activity_snapshot('race','staff@example.test','[{"page_id":"10000000-0000-4000-8000-000000000001","signal":"activity_unknown"}]',now())$q$) AS t(result jsonb);
SELECT dblink_send_query('activity_b',$q$SELECT public.reconcile_support_activity_snapshot('race','staff@example.test','[{"page_id":"10000000-0000-4000-8000-000000000001","signal":"activity_unknown"}]',now())$q$);
SELECT dblink_exec('activity_a','COMMIT');
SELECT * FROM dblink_get_result('activity_b') AS t(result jsonb);
SELECT dblink_disconnect('activity_a');
SELECT dblink_disconnect('activity_b');
DO $$BEGIN IF (SELECT count(*) FROM public.support_activity_notifications WHERE scope='race')<>1 THEN RAISE EXCEPTION 'concurrent duplicate notification'; END IF; END$$;
