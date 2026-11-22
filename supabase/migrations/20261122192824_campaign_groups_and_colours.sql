-- Organization lives outside the immutable campaign content/send snapshot.
create table public.campaign_groups (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 80),
 colour text not null default '#496A51' check (colour ~ '^#[0-9A-Fa-f]{6}$'),
 unique(tenant_id,id), unique(tenant_id,name)
);
create table public.campaign_group_memberships (
 campaign_id uuid not null references public.crm_campaigns(id) on delete cascade,
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 group_id uuid not null,
 primary key(campaign_id,group_id),
 foreign key(tenant_id,group_id) references public.campaign_groups(tenant_id,id) on delete cascade
);
create table public.campaign_colours (
 campaign_id uuid primary key references public.crm_campaigns(id) on delete cascade,
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 colour text not null check (colour ~ '^#[0-9A-Fa-f]{6}$')
);
create index campaign_groups_tenant_idx on public.campaign_groups(tenant_id);
create index campaign_group_memberships_tenant_idx on public.campaign_group_memberships(tenant_id,group_id);
create index campaign_colours_tenant_idx on public.campaign_colours(tenant_id);
alter table public.campaign_groups enable row level security;
alter table public.campaign_group_memberships enable row level security;
alter table public.campaign_colours enable row level security;
create policy campaign_groups_read on public.campaign_groups for select to authenticated using(public.has_tenant_permission(tenant_id,'campaign.read',null));
create policy campaign_groups_write on public.campaign_groups for all to authenticated using(public.has_tenant_permission(tenant_id,'campaign.write',null)) with check(public.has_tenant_permission(tenant_id,'campaign.write',null));
create policy campaign_memberships_read on public.campaign_group_memberships for select to authenticated using(exists(select 1 from public.crm_campaigns c where c.id=campaign_id and c.tenant_id=campaign_group_memberships.tenant_id));
create policy campaign_memberships_write on public.campaign_group_memberships for all to authenticated using(public.has_tenant_permission(tenant_id,'campaign.write',null) and exists(select 1 from public.crm_campaigns c where c.id=campaign_id and c.tenant_id=campaign_group_memberships.tenant_id)) with check(public.has_tenant_permission(tenant_id,'campaign.write',null) and exists(select 1 from public.crm_campaigns c where c.id=campaign_id and c.tenant_id=campaign_group_memberships.tenant_id));
create policy campaign_colours_read on public.campaign_colours for select to authenticated using(exists(select 1 from public.crm_campaigns c where c.id=campaign_id and c.tenant_id=campaign_colours.tenant_id));
create policy campaign_colours_write on public.campaign_colours for all to authenticated using(public.has_tenant_permission(tenant_id,'campaign.write',null) and exists(select 1 from public.crm_campaigns c where c.id=campaign_id and c.tenant_id=campaign_colours.tenant_id)) with check(public.has_tenant_permission(tenant_id,'campaign.write',null) and exists(select 1 from public.crm_campaigns c where c.id=campaign_id and c.tenant_id=campaign_colours.tenant_id));
grant select,insert,update,delete on public.campaign_groups,public.campaign_group_memberships,public.campaign_colours to authenticated;
grant all on public.campaign_groups,public.campaign_group_memberships,public.campaign_colours to service_role;

-- Change only an existing unclaimed schedule, without reopening locked content.
create function public.reschedule_campaign(p_campaign_id uuid,p_expected_updated_at timestamptz,p_scheduled_at timestamptz) returns void language plpgsql security invoker set search_path=public as $$
declare c public.crm_campaigns%rowtype; access jsonb;
begin
 access := public.get_current_crm_access();
 select * into c from public.crm_campaigns where id=p_campaign_id for update;
 if not found or c.tenant_id::text is distinct from access->>'tenantId' or not coalesce(access->'permissions' ? 'campaigns.send',false) then raise exception 'Campaign sending permission required'; end if;
 if c.status <> 'scheduled' or c.updated_at is distinct from p_expected_updated_at or c.claim_token is not null or c.send_started_at is not null or c.queue_started_at is not null then raise exception 'Campaign changed or sending has started. Refresh before trying again.'; end if;
 if p_scheduled_at is null or p_scheduled_at <= now() then raise exception 'Choose a future send time'; end if;
 update public.crm_campaigns set scheduled_at=p_scheduled_at,updated_at=clock_timestamp() where id=c.id;
end $$;
revoke all on function public.reschedule_campaign(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.reschedule_campaign(uuid,timestamptz,timestamptz) to authenticated;
