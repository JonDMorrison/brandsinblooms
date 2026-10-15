\set ON_ERROR_STOP on

-- Isolated PostgreSQL 15 acceptance suite. No live customer records.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
$$;
CREATE TABLE public.tenants (id uuid PRIMARY KEY, name text);
CREATE TABLE public.crm_customers (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  email text, deleted_at timestamptz, merged_into_customer_id uuid
);
CREATE TABLE public.crm_campaigns (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id)
);

CREATE TABLE public.users (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  role text NOT NULL
);
CREATE TABLE public.crm_segments (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL, status text NOT NULL, deleted_at timestamptz,
  customer_count integer NOT NULL DEFAULT 0
);
CREATE TABLE public.customer_segments (
  customer_id uuid REFERENCES public.crm_customers(id),
  segment_id uuid REFERENCES public.crm_segments(id),
  PRIMARY KEY(customer_id,segment_id)
);

\ir ../../supabase/migrations/20261014200000_customer_intelligence_web_push_foundation.sql
\ir ../../supabase/migrations/20261014234500_customer_intelligence_push_segment_campaigns.sql

DO $test$
DECLARE
  tenant_a uuid := '92000000-0000-4000-8000-000000000001';
  tenant_b uuid := '92000000-0000-4000-8000-000000000002';
  site_a uuid := '92000000-0000-4000-8000-000000000003';
  site_b uuid := '92000000-0000-4000-8000-000000000004';
  crm_a uuid := '92000000-0000-4000-8000-000000000005';
  crm_b uuid := '92000000-0000-4000-8000-000000000006';
  user_a uuid := '92000000-0000-4000-8000-000000000007';
  user_b uuid := '92000000-0000-4000-8000-000000000008';
  event_a uuid := '92000000-0000-4000-8000-000000000009';
  event_b uuid := '92000000-0000-4000-8000-000000000010';
  link_a uuid;
  link_b uuid;
  result jsonb;
  queue_id uuid;
  claimed integer;
  blocked boolean;
  h1 text := repeat('a',64);
  h2 text := repeat('b',64);
  key1 text := repeat('Z',48);
  key2 text := repeat('Y',24);
  endpoint text := 'https://fcm.googleapis.com/fcm/send/long-synthetic-test-endpoint';
BEGIN
  ASSERT NOT has_table_privilege('anon','public.crm_push_subscriptions','SELECT'),
    'push delivery credentials are private';
  ASSERT NOT has_table_privilege('authenticated','public.crm_push_subscriptions','SELECT'),
    'logged-in marketing users cannot read browser subscription keys';
  ASSERT NOT has_function_privilege('authenticated',
    'public.accept_storefront_push_v1(uuid,uuid,uuid,text,text,text,text,text,integer,text,text)',
    'EXECUTE'), 'browser roles cannot call privileged identity bridge';

  INSERT INTO public.tenants(id,name) VALUES
    (tenant_a,'Tenant A'),(tenant_b,'Tenant B');
  INSERT INTO public.crm_customers(id,tenant_id,email) VALUES
    (crm_a,tenant_a,'same-address@test.local'),
    (crm_b,tenant_b,'same-address@test.local');
  INSERT INTO public.crm_storefront_tenant_links
    (storefront_site_id,crm_tenant_id,enabled,reviewed_by,reviewed_at)
  VALUES
    (site_a,tenant_a,true,user_a,now()),
    (site_b,tenant_b,true,user_b,now());

  -- First signed storefront event only creates a pending review suggestion.
  result:=public.accept_storefront_push_v1(
    event_a,site_a,user_a,'subscribe',endpoint,h1,key1,key2,1,h2,
    'same-address@test.local');
  ASSERT result->>'status'='identity_review_required',
    'matching email must not authorize subscription or merge customer';
  ASSERT (SELECT count(*) FROM public.crm_push_subscriptions)=0,
    'no unverified browser subscription may enter a send audience';
  SELECT id INTO link_a FROM public.crm_storefront_customer_links
    WHERE storefront_site_id=site_a AND storefront_user_id=user_a;
  ASSERT link_a IS NOT NULL, 'storefront identity should enter review queue';
  ASSERT (SELECT status FROM public.crm_storefront_customer_links WHERE id=link_a)='pending',
    'email match cannot auto-verify a CRM link';
  ASSERT (SELECT source_email FROM public.crm_storefront_customer_links WHERE id=link_a)
      ='same-address@test.local','review contact hint retained';

  -- Explicitly reviewed links only. The two CRM tenants share an email.
  UPDATE public.crm_storefront_customer_links
    SET status='verified',crm_customer_id=crm_a,
      reviewed_by=user_a,reviewed_at=now(),evidence_ref='manual-test-review-a'
    WHERE id=link_a;
  result:=public.accept_storefront_push_v1(
    event_b,site_a,user_a,'subscribe',endpoint,h1,key1,key2,1,h1,
    'same-address@test.local');
  ASSERT result->>'status'='subscribed','reviewed customer may opt in';
  ASSERT (SELECT count(*) FROM public.crm_push_subscriptions)=1,
    'only one browser subscription must exist';
  ASSERT (SELECT status FROM public.crm_push_preferences
    WHERE tenant_id=tenant_a AND crm_customer_id=crm_a)='opted_in',
    'consent is tenant-scoped';

  result:=public.accept_storefront_push_v1(
    event_b,site_a,user_a,'subscribe',endpoint,h1,key1,key2,1,h1,
    'same-address@test.local');
  ASSERT result->>'status'='subscribed','identical event replay returns saved result';
  ASSERT (SELECT count(*) FROM public.crm_push_subscriptions)=1,
    'duplicate event must not create a second browser endpoint';

  blocked:=false;
  BEGIN
    PERFORM public.accept_storefront_push_v1(
      event_b,site_a,user_a,'subscribe',endpoint,h1,key1,key2,1,h2,
      'same-address@test.local');
  EXCEPTION WHEN OTHERS THEN blocked:=true;
  END;
  ASSERT blocked,'changed retry payload must be rejected';

  INSERT INTO public.crm_storefront_customer_links
    (tenant_id,storefront_site_id,storefront_user_id,crm_customer_id,status,
     reviewed_by,reviewed_at,evidence_ref)
  VALUES
    (tenant_b,site_b,user_b,crm_b,'verified',user_b,now(),'manual-test-review-b')
  RETURNING id INTO link_b;

  -- A different tenant cannot steal an existing push endpoint, even when its
  -- customer email looks identical.
  blocked:=false;
  BEGIN
    PERFORM public.accept_storefront_push_v1(
      '92000000-0000-4000-8000-000000000011',site_b,user_b,'subscribe',
      endpoint,h1,key1,key2,1,repeat('c',64),'same-address@test.local');
  EXCEPTION WHEN OTHERS THEN blocked:=true;
  END;
  ASSERT blocked, 'duplicate endpoint ownership must not cross tenants';
  ASSERT (SELECT count(*) FROM public.crm_push_subscriptions
      WHERE tenant_id=tenant_b)=0,'failed claim cannot create cross-tenant subscription';

  INSERT INTO public.crm_push_messages
    (tenant_id,crm_customer_id,subscription_id,dedupe_key,title,body,open_path)
  SELECT tenant_a,crm_a,id,'phase0:message-a','Test offer','Your offer is ready',
    '/account/offers'
  FROM public.crm_push_subscriptions WHERE tenant_id=tenant_a
  RETURNING id INTO queue_id;
  SELECT count(*) INTO claimed
  FROM public.claim_crm_push_messages(25);
  ASSERT claimed=1,'verified, opted-in subscription should be claimed';
  ASSERT (SELECT status FROM public.crm_push_messages WHERE id=queue_id)='sending',
    'claim sets durable sending state';

  -- Withdrawn permission blocks later delivery, even when queued already.
  result:=public.accept_storefront_push_v1(
    '92000000-0000-4000-8000-000000000012',site_a,user_a,'unsubscribe',
    NULL,repeat('d',64),NULL,NULL,1,repeat('e',64),NULL);
  ASSERT result->>'status'='unsubscribed','customer withdrawal recorded';
  ASSERT (SELECT status FROM public.crm_push_preferences
    WHERE tenant_id=tenant_a AND crm_customer_id=crm_a)='opted_out',
    'withdrawal overrides opt-in';
  ASSERT (SELECT count(*) FROM public.crm_push_subscriptions
      WHERE tenant_id=tenant_a AND status='active')=0,
    'previously active browser endpoint must be revoked';

  RAISE NOTICE 'PASS: reviewed identity, tenant scope, replay, consent, dispatch';
END
$test$;

-- Verify the complete segment-to-push queue after identity acceptance. The
-- previous fixture intentionally unsubscribed first, so preview must exclude it.
DO $segment$
DECLARE
 tenant_a uuid := '92000000-0000-4000-8000-000000000001';
 tenant_b uuid := '92000000-0000-4000-8000-000000000002';
 site_a uuid := '92000000-0000-4000-8000-000000000003';
 crm_a uuid := '92000000-0000-4000-8000-000000000005';
 user_a uuid := '92000000-0000-4000-8000-000000000007';
 segment_a uuid := '92000000-0000-4000-8000-000000000021';
 r jsonb;
 first_campaign uuid;
 blocked boolean;
BEGIN
 INSERT INTO public.users(id,tenant_id,role) VALUES(user_a,tenant_a,'admin');
 INSERT INTO public.crm_segments(id,tenant_id,name,status)
 VALUES(segment_a,tenant_a,'Synthetic VIP segment','active');
 INSERT INTO public.customer_segments(customer_id,segment_id)
 VALUES(crm_a,segment_a);

 r:=public.preview_crm_push_segment_v1(tenant_a,segment_a);
 ASSERT (r->>'segmentMembers')::int=1,'segment contains one synthetic customer';
 ASSERT (r->>'eligibleDevices')::int=0,'withdrawn push consent must exclude recipient';

 r:=public.accept_storefront_push_v1(
   '92000000-0000-4000-8000-000000000022',site_a,user_a,'subscribe',
   'https://fcm.googleapis.com/fcm/send/long-synthetic-test-endpoint',
   repeat('a',64),repeat('Z',48),repeat('Y',24),1,repeat('f',64),
   'same-address@test.local');
 ASSERT r->>'status'='subscribed','verified user may explicitly re-subscribe';
 r:=public.preview_crm_push_segment_v1(tenant_a,segment_a);
 ASSERT (r->>'eligibleCustomers')::int=1,'one consented customer available';
 ASSERT (r->>'eligibleDevices')::int=1,'one verified device available';

 r:=public.queue_crm_push_segment_v1(tenant_a,segment_a,user_a,
   'synthetic-queue-id-001','Store VIP preview','A reward is ready','/account/offers');
 ASSERT r->>'status'='queued','campaign should be queued';
 ASSERT (r->>'queued')::int=1,'exactly one device must be queued';
 first_campaign:=(r->>'campaignId')::uuid;

 r:=public.queue_crm_push_segment_v1(tenant_a,segment_a,user_a,
   'synthetic-queue-id-001','Store VIP preview','A reward is ready','/account/offers');
 ASSERT r->>'idempotent'='true','identical request returns existing campaign';
 ASSERT (r->>'campaignId')::uuid=first_campaign,'retry must preserve campaign';
 ASSERT (SELECT count(*) FROM public.crm_push_messages WHERE push_campaign_id=first_campaign)=1,
   'retry must not duplicate recipient messages';

 blocked:=false;
 BEGIN
  PERFORM public.queue_crm_push_segment_v1(tenant_a,segment_a,user_a,
    'synthetic-queue-id-001','Edited VIP preview','A reward is ready','/account/offers');
 EXCEPTION WHEN OTHERS THEN blocked:=true;
 END;
 ASSERT blocked,'changed retry must fail closed';

 blocked:=false;
 BEGIN
  PERFORM public.queue_crm_push_segment_v1(tenant_b,segment_a,user_a,
    'cross-tenant-queue-001','Other tenant preview','Something','/account/offers');
 EXCEPTION WHEN OTHERS THEN blocked:=true;
 END;
 ASSERT blocked,'foreign tenant cannot queue a segment push';
 RAISE NOTICE 'PASS: segment scope, opt-in preview, idempotent queue and retry checks';
END
$segment$;
