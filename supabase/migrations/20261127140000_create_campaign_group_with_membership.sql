-- "Add group" in the campaign editor must create the group and put the
-- campaign in it as one unit. Before this, the client inserted only into
-- campaign_groups and never wrote campaign_group_memberships.
--
-- SECURITY INVOKER: both writes still pass the RLS policies from
-- 20261122192824_campaign_groups_and_colours.sql. The explicit checks below
-- give a clear error instead of a bare RLS denial and keep tenant scoping
-- explicit rather than relying on RLS alone.
create or replace function public.create_campaign_group_with_membership(
  p_tenant_id uuid,
  p_campaign_id uuid,
  p_name text,
  p_colour text
) returns public.campaign_groups
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_group public.campaign_groups%rowtype;
  v_name text := trim(coalesce(p_name, ''));
begin
  if not public.has_tenant_permission(p_tenant_id, 'campaign.write', null) then
    raise exception 'Campaign editing permission required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.crm_campaigns c
    where c.id = p_campaign_id and c.tenant_id = p_tenant_id
  ) then
    raise exception 'Campaign not found for this company' using errcode = '42501';
  end if;

  if length(v_name) not between 1 and 80 then
    raise exception 'Group name must be 1 to 80 characters' using errcode = '22023';
  end if;

  -- A group name is unique per company; adding an existing name joins it.
  insert into public.campaign_groups (tenant_id, name, colour)
  values (p_tenant_id, v_name, p_colour)
  on conflict (tenant_id, name) do nothing
  returning * into v_group;

  if v_group.id is null then
    select * into v_group
    from public.campaign_groups g
    where g.tenant_id = p_tenant_id and g.name = v_name;
  end if;

  insert into public.campaign_group_memberships (campaign_id, tenant_id, group_id)
  values (p_campaign_id, p_tenant_id, v_group.id)
  on conflict (campaign_id, group_id) do nothing;

  return v_group;
end
$$;

revoke all on function public.create_campaign_group_with_membership(uuid, uuid, text, text) from public, anon;
grant execute on function public.create_campaign_group_with_membership(uuid, uuid, text, text) to authenticated;
