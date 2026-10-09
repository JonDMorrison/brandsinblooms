\set ON_ERROR_STOP on
BEGIN;
SET ROLE service_role;
DO $$
DECLARE g jsonb; u jsonb; gid uuid; nonce text:=repeat('N',43);
BEGIN
  g:=public.lightspeed_authority_create_v1(jsonb_build_object(
    'siteId','cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'stateHash',repeat('A',43),'prefix','demo-nursery',
    'publicKey','{"kty":"EC","crv":"P-256","x":"fixture-x","y":"fixture-y"}'::jsonb,
    'expiresAt',now()+interval '10 minutes'));
  gid:=(g->>'id')::uuid;
  IF gid IS NULL THEN RAISE EXCEPTION 'create did not return an identity';END IF;
  IF (public.lightspeed_authority_create_v1(jsonb_build_object(
    'siteId','cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'stateHash',repeat('A',43),'prefix','demo-nursery',
    'publicKey','{"kty":"EC","crv":"P-256","x":"fixture-x","y":"fixture-y"}'::jsonb,
    'expiresAt',now()+interval '10 minutes')))->>'id'<>g->>'id'
    THEN RAISE EXCEPTION 'idempotent grant failed';END IF;
  u:=public.lightspeed_authority_update_v1(gid,1,'pending',jsonb_build_object(
    'status','authorizing','leaseId',gen_random_uuid(),
    'leaseExpiresAt',now()+interval '1 minute'));
  IF u IS NULL THEN RAISE EXCEPTION 'grant CAS failed';END IF;
  IF public.lightspeed_authority_update_v1(gid,1,'pending','{"status":"authorized"}'::jsonb) IS NOT NULL
    THEN RAISE EXCEPTION 'stale version accepted';END IF;
  IF NOT public.lightspeed_authority_nonce_v1(gid,nonce,now()+interval '5 minutes')
    THEN RAISE EXCEPTION 'nonce failed';END IF;
  IF public.lightspeed_authority_nonce_v1(gid,nonce,now()+interval '5 minutes')
    THEN RAISE EXCEPTION 'nonce replay accepted';END IF;
  RAISE NOTICE 'PASS: grant create, idempotency, CAS, nonce replay';
END $$;
RESET ROLE;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.oid,c.relname,c.relrowsecurity FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname LIKE 'lightspeed_storefront_%' AND c.relkind='r'
  LOOP
    IF NOT r.relrowsecurity OR has_table_privilege('anon',r.oid,'SELECT')
      OR has_table_privilege('authenticated',r.oid,'SELECT')
    THEN RAISE EXCEPTION 'table exposed: %',r.relname;END IF;
  END LOOP;
END $$;
ROLLBACK;
