\set ON_ERROR_STOP on

select current_database() = 'bloom_reporting_test' as isolated_database \gset
\if :isolated_database
\else
  \echo 'Refusing to run outside disposable bloom_reporting_test'
  \quit 3
\endif

begin;

create schema auth;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role anon nologin;

create function auth.uid()
returns uuid language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create function auth.role()
returns text language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$$;

grant usage on schema auth to authenticated, service_role, anon;
grant execute on function auth.uid(), auth.role() to authenticated, service_role, anon;

create table public.users (
  id uuid primary key,
  tenant_id uuid not null,
  role text not null
);

create table public.admin_session_context (
  admin_user_id uuid primary key,
  active_tenant_id uuid
);

create table public.user_location_access (
  user_id uuid not null,
  tenant_id uuid not null,
  location_id uuid not null
);

create table public.crm_campaigns (
  id uuid primary key,
  tenant_id uuid not null,
  location_scope text not null,
  primary_location_id uuid
);

create table public.campaign_location_targets (
  campaign_id uuid not null,
  tenant_id uuid not null,
  location_id uuid not null
);

create function public.is_master_admin(p_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_user_id = '20000000-0000-4000-8000-000000000001'::uuid
$$;

create function public.has_tenant_permission(
  p_tenant_id uuid,
  p_permission text,
  p_location_id uuid default null
)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
begin
  if auth.role() = 'service_role' then
    return true;
  end if;
  if v_user_id is null or p_tenant_id is null or p_permission <> 'campaign.read' then
    return false;
  end if;
  if public.is_master_admin(v_user_id) then
    return exists (
      select 1 from public.admin_session_context as context
      where context.admin_user_id = v_user_id
        and context.active_tenant_id = p_tenant_id
    );
  end if;
  select app_user.role into v_role
  from public.users as app_user
  where app_user.id = v_user_id and app_user.tenant_id = p_tenant_id;
  if v_role in ('owner', 'admin', 'marketing') then
    return true;
  end if;
  if v_role = 'store_manager' then
    return exists (
      select 1 from public.user_location_access as access
      where access.user_id = v_user_id
        and access.tenant_id = p_tenant_id
        and (p_location_id is null or access.location_id = p_location_id)
    );
  end if;
  return false;
end;
$$;

create function public._email_campaign_reporting_snapshot(p_campaign_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'campaign_id', p_campaign_id,
    'metrics', jsonb_build_object('authorized', true)
  )
$$;

revoke all on function public._email_campaign_reporting_snapshot(uuid)
from public, anon, authenticated;
grant execute on function public._email_campaign_reporting_snapshot(uuid)
to service_role;

insert into public.users (id, tenant_id, role) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'owner'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'owner'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'store_manager'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'owner');

insert into public.admin_session_context values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');

insert into public.user_location_access values
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001');

insert into public.crm_campaigns values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'all_locations', null),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'one_location', '30000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'one_location', '30000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'selected_locations', null),
  ('40000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 'all_locations', null);

insert into public.campaign_location_targets values
  ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002');

\ir ../../supabase/migrations/20261107023100_bloom_support_crm_reporting_access.sql
\ir ../../supabase/migrations/20261107023100_bloom_support_crm_reporting_access.sql

do $$
begin
  if has_function_privilege('anon', 'public.get_email_campaign_reporting_snapshot(uuid)', 'execute') then
    raise exception 'anon can execute the reporting snapshot';
  end if;
  if not has_function_privilege('authenticated', 'public.get_email_campaign_reporting_snapshot(uuid)', 'execute') then
    raise exception 'authenticated cannot execute the reporting snapshot';
  end if;
  if not has_function_privilege('service_role', 'public.get_email_campaign_reporting_snapshot(uuid)', 'execute') then
    raise exception 'service_role cannot execute the reporting snapshot';
  end if;
  if has_function_privilege('anon', 'public.get_campaign_derived_metrics(uuid)', 'execute') then
    raise exception 'anon can execute derived metrics';
  end if;
  if not has_function_privilege('authenticated', 'public.get_campaign_derived_metrics(uuid)', 'execute') then
    raise exception 'authenticated cannot execute derived metrics';
  end if;
  if not has_function_privilege('service_role', 'public.get_campaign_derived_metrics(uuid)', 'execute') then
    raise exception 'service_role cannot execute derived metrics';
  end if;
end;
$$;

-- A platform administrator may read only the explicitly selected tenant.
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
do $$
begin
  perform public.get_email_campaign_reporting_snapshot('40000000-0000-4000-8000-000000000001');
  perform public.get_email_campaign_reporting_snapshot('40000000-0000-4000-8000-000000000004');
  begin
    perform public.get_email_campaign_reporting_snapshot('40000000-0000-4000-8000-000000000005');
    raise exception 'Selected-tenant administrator crossed the tenant boundary';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- A store manager sees all-location campaigns plus assigned-location work,
-- but not campaigns restricted to another location.
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000003', true);
set local role authenticated;
do $$
begin
  perform public.get_email_campaign_reporting_snapshot('40000000-0000-4000-8000-000000000001');
  perform public.get_email_campaign_reporting_snapshot('40000000-0000-4000-8000-000000000002');
  perform public.get_email_campaign_reporting_snapshot('40000000-0000-4000-8000-000000000004');
  begin
    perform public.get_email_campaign_reporting_snapshot('40000000-0000-4000-8000-000000000003');
    raise exception 'Store manager crossed the location boundary';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- The compatibility helper cannot bypass the same tenant guard.
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000004', true);
set local role authenticated;
do $$
begin
  perform public.get_campaign_derived_metrics('40000000-0000-4000-8000-000000000005');
  begin
    perform public.get_campaign_derived_metrics('40000000-0000-4000-8000-000000000001');
    raise exception 'Derived metrics crossed the tenant boundary';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- No JWT identity is denied even when the database role is authenticated.
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
do $$
begin
  begin
    perform public.get_email_campaign_reporting_snapshot('40000000-0000-4000-8000-000000000001');
    raise exception 'Unauthenticated reporting read succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- The service role retains the background-processing path.
select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
select public.get_email_campaign_reporting_snapshot(
  '40000000-0000-4000-8000-000000000001'
)->>'campaign_id' = '40000000-0000-4000-8000-000000000001' as service_role_ok \gset
reset role;
\if :service_role_ok
\else
  \echo 'Service role reporting path failed'
  \quit 4
\endif

rollback;
\echo 'PASS: campaign reporting follows selected-tenant and location authorization without derived-metrics bypass'
