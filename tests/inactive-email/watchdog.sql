\set ON_ERROR_STOP on
DO $$BEGIN IF current_database()<>'inactive_email_test' THEN RAISE EXCEPTION 'isolated database required'; END IF; END$$;
CREATE SCHEMA bloom_support;
CREATE TABLE public.email_messages(id uuid PRIMARY KEY);
DO $$BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF; END$$;
CREATE TABLE public.crm_customers(id uuid PRIMARY KEY,tenant_id uuid,deleted_at timestamptz,merged_into_customer_id uuid);
CREATE TABLE public.crm_segments(id uuid PRIMARY KEY,tenant_id uuid,deleted_at timestamptz);
CREATE TABLE public.customer_segments(customer_id uuid,segment_id uuid);
\ir ../../supabase/migrations/20261117131047_bloom_support_inactive_customer_guards.sql
DO $$DECLARE source text:=pg_get_functiondef('bloom_support.watchdog()'::regprocedure); q text; n int; tenants int; t uuid:=gen_random_uuid(); archived uuid:=gen_random_uuid(); live uuid:=gen_random_uuid(); deleted uuid:=gen_random_uuid(); merged uuid:=gen_random_uuid(); active uuid:=gen_random_uuid(); BEGIN
 INSERT INTO public.crm_segments VALUES(archived,t,now()),(live,t,null);
 INSERT INTO public.crm_customers VALUES(deleted,t,now(),null),(merged,t,null,active),(active,t,null,null);
 INSERT INTO public.customer_segments VALUES(deleted,archived),(merged,archived),(active,live);
 -- Execute the installed watchdog's actual orphan query, not a copied test implementation.
 q:=substring(source from '(SELECT count\(\*\)::int, count\(DISTINCT o.tenant_id\)::int[\s\S]*?\) o;)');
 IF q IS NULL THEN RAISE EXCEPTION 'watchdog query not found'; END IF;
 q:=replace(q,'INTO total, tenants_hit','');
 EXECUTE q INTO n,tenants;
 IF n<>0 THEN RAISE EXCEPTION 'archived memberships falsely reported'; END IF;
 INSERT INTO public.customer_segments VALUES(deleted,live),(deleted,live),(merged,live);
 EXECUTE q INTO n,tenants;
 IF n<>2 OR tenants<>1 THEN RAISE EXCEPTION 'live deleted/merged memberships missed or duplicates counted'; END IF;
 UPDATE public.crm_segments SET deleted_at=now() WHERE id=live;
 EXECUTE q INTO n,tenants;
 IF n<>0 THEN RAISE EXCEPTION 'archival did not clear finding'; END IF;
 IF source NOT LIKE '%approaching_deadline%' THEN RAISE EXCEPTION 'pre-breach behavior lost'; END IF;
END$$;
-- Real retry RPCs must retain uncertain delivery holds, including after the
-- result processor overwrites the human-readable error or a stale claim clears.
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
CREATE TABLE public.users(id uuid,tenant_id uuid);
CREATE TABLE public.crm_campaigns(id uuid,user_id uuid,tenant_id uuid,from_email_domain_id uuid,segment_id uuid,status text,send_error text,send_blocked_reason text,sent_at timestamptz,send_started_at timestamptz,updated_at timestamptz);
CREATE TABLE public.campaign_segments(campaign_id uuid,segment_id uuid);
CREATE TABLE public.email_send_jobs(id uuid DEFAULT gen_random_uuid(),campaign_id uuid,tenant_id uuid,domain_id uuid,status text,recipient_emails jsonb,recipient_message_ids uuid[],batch_index int,error_message text,attempts int,emails_sent int,emails_failed int,created_at timestamptz,updated_at timestamptz);
ALTER TABLE public.email_messages ADD COLUMN campaign_id uuid, ADD COLUMN tenant_id uuid, ADD COLUMN customer_id uuid, ADD COLUMN email text, ADD COLUMN status text, ADD COLUMN attempts int, ADD COLUMN resend_id text, ADD COLUMN error_message text, ADD COLUMN last_attempt_at timestamptz, ADD COLUMN claimed_at timestamptz, ADD COLUMN claimed_by text, ADD COLUMN claim_token uuid, ADD COLUMN dead_lettered_at timestamptz, ADD COLUMN updated_at timestamptz, ADD COLUMN retry_sequence int DEFAULT 0, ADD COLUMN payload jsonb;
DO $$DECLARE t uuid:=gen_random_uuid(); u uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); held uuid:=gen_random_uuid(); normal uuid:=gen_random_uuid(); r record; BEGIN
 PERFORM set_config('test.actor',u::text,false);
 INSERT INTO public.users VALUES(u,t);
 INSERT INTO public.crm_campaigns(id,user_id,tenant_id) VALUES(c,u,t);
 INSERT INTO public.email_messages(id,campaign_id,tenant_id,customer_id,email,status,delivery_reconciliation_required,error_message) VALUES
 (held,c,t,gen_random_uuid(),'held@example.test','failed',true,'provider500'),(normal,c,t,gen_random_uuid(),'normal@example.test','failed',false,'validation');
 SELECT * INTO r FROM public.retry_campaign_recipient_message(c,held);
 IF r.blocked_reason<>'delivery_reconciliation_required' OR r.jobs_created<>0 THEN RAISE EXCEPTION 'individual retry bypassed hold'; END IF;
 SELECT * INTO r FROM public.retry_failed_email_messages(c,200);
 IF r.count_reset<>1 OR r.jobs_created<>1 THEN RAISE EXCEPTION 'bulk retry failed ordinary retry or included hold'; END IF;
 IF (SELECT status FROM public.email_messages WHERE id=held)<>'failed' OR NOT(SELECT delivery_reconciliation_required FROM public.email_messages WHERE id=held) THEN RAISE EXCEPTION 'hold cleared'; END IF;
 IF EXISTS(SELECT 1 FROM public.email_send_jobs WHERE held=ANY(recipient_message_ids)) THEN RAISE EXCEPTION 'uncertain message requeued'; END IF;
 PERFORM set_config('test.actor',gen_random_uuid()::text,false);
 SELECT * INTO r FROM public.retry_campaign_recipient_message(c,held);
 IF r.blocked_reason<>'forbidden' THEN RAISE EXCEPTION 'tenant authorization changed'; END IF;
END$$;
