-- Care Guide Studio: tenant-owned design drafts and immutable published versions.
-- No trigger, campaign, email recipient or POS sale is affected by this migration.
create table if not exists public.care_guide_designs (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  draft jsonb not null default '{}'::jsonb check (jsonb_typeof(draft) = 'object'),
  published jsonb,
  published_version integer not null default 0 check (published_version >= 0),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint care_guide_published_object check (published is null or jsonb_typeof(published) = 'object')
);
create table if not exists public.care_guide_design_versions (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  version integer not null check (version > 0),
  design jsonb not null check (jsonb_typeof(design) = 'object'),
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now(),
  primary key (tenant_id, version)
);
create index if not exists care_guide_versions_tenant_time_idx on public.care_guide_design_versions(tenant_id, published_at desc);
alter table public.care_guide_designs enable row level security;
alter table public.care_guide_design_versions enable row level security;
create policy care_guide_design_read on public.care_guide_designs for select to authenticated
  using(public.has_tenant_permission(tenant_id,'campaign.read',null) or public.has_tenant_permission(tenant_id,'campaign.write',null));
create policy care_guide_design_versions_read on public.care_guide_design_versions for select to authenticated
  using(public.has_tenant_permission(tenant_id,'campaign.read',null) or public.has_tenant_permission(tenant_id,'campaign.write',null));
-- Draft and publication writes must pass the guarded RPCs below. Direct client
-- INSERT/UPDATE/DELETE is intentionally not granted; history is immutable.
revoke all on public.care_guide_designs,public.care_guide_design_versions from public,anon,authenticated;
grant select on public.care_guide_designs,public.care_guide_design_versions to authenticated;
grant all on public.care_guide_designs,public.care_guide_design_versions to service_role;

-- Save a draft without changing a live published design or its revision.
create or replace function public.save_care_guide_design_draft(p_tenant_id uuid,p_draft jsonb)
returns void language plpgsql security definer set search_path='' as $
begin
  if auth.uid() is null or not public.has_tenant_permission(p_tenant_id,'campaign.write',null) then raise exception 'Care Guide editing permission required'; end if;
  if p_draft is null or jsonb_typeof(p_draft)<>'object' or pg_column_size(p_draft)>16384 then raise exception 'Invalid Care Guide draft'; end if;
  insert into public.care_guide_designs(tenant_id,draft,updated_at) values(p_tenant_id,p_draft,now())
  on conflict(tenant_id) do update set draft=excluded.draft,updated_at=now();
end $$;
revoke all on function public.save_care_guide_design_draft(uuid,jsonb) from public,anon;
grant execute on function public.save_care_guide_design_draft(uuid,jsonb) to authenticated;

-- Atomic, optimistic publication. Keeps an immutable history for rollback.
create or replace function public.publish_care_guide_design(p_tenant_id uuid,p_expected_version integer,p_design jsonb)
returns integer language plpgsql security definer set search_path='' as $
declare next_version integer;
begin
  if auth.uid() is null or not public.has_tenant_permission(p_tenant_id,'campaign.write',null) then raise exception 'Care Guide publishing permission required'; end if;
  if p_expected_version is null or p_expected_version<0 then raise exception 'Invalid expected version'; end if;
  if p_design is null or jsonb_typeof(p_design)<>'object' or pg_column_size(p_design)>16384 then raise exception 'Invalid Care Guide design'; end if;
  if p_expected_version=0 then
    insert into public.care_guide_designs(tenant_id,draft) values(p_tenant_id,p_design) on conflict do nothing;
  end if;
  update public.care_guide_designs set draft=p_design,published=p_design,
    published_version=published_version+1,published_at=now(),updated_at=now()
    where tenant_id=p_tenant_id and published_version=p_expected_version
    returning published_version into next_version;
  if next_version is null then raise exception 'Care Guide changed in another session. Refresh before publishing.'; end if;
  insert into public.care_guide_design_versions(tenant_id,version,design,published_by)
    values(p_tenant_id,next_version,p_design,auth.uid());
  return next_version;
end $$;
revoke all on function public.publish_care_guide_design(uuid,integer,jsonb) from public,anon;
grant execute on function public.publish_care_guide_design(uuid,integer,jsonb) to authenticated;
