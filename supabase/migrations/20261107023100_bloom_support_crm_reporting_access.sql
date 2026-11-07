-- Keep campaign reporting authorization aligned with the canonical CRM
-- tenant and location access model. Platform administrators work in a
-- selected tenant through admin_session_context, so users.tenant_id alone is
-- not an authorization boundary.

create or replace function public.get_email_campaign_reporting_snapshot(
  p_campaign_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_location_scope text;
  v_primary_location_id uuid;
  v_authorized boolean := false;
begin
  select
    campaign.tenant_id,
    campaign.location_scope,
    campaign.primary_location_id
  into
    v_tenant_id,
    v_location_scope,
    v_primary_location_id
  from public.crm_campaigns as campaign
  where campaign.id = p_campaign_id;

  if not found then
    raise exception 'Campaign not found' using errcode = 'P0002';
  end if;

  if auth.role() is distinct from 'service_role' then
    if auth.uid() is null then
      raise exception 'Campaign access denied' using errcode = '42501';
    end if;

    v_authorized := case v_location_scope
      when 'all_locations' then
        public.has_tenant_permission(v_tenant_id, 'campaign.read', null::uuid)
      when 'one_location' then
        v_primary_location_id is not null
        and public.has_tenant_permission(
          v_tenant_id,
          'campaign.read',
          v_primary_location_id
        )
      when 'selected_locations' then exists (
        select 1
        from public.campaign_location_targets as target
        where target.campaign_id = p_campaign_id
          and target.tenant_id = v_tenant_id
          and public.has_tenant_permission(
            target.tenant_id,
            'campaign.read',
            target.location_id
          )
      )
      else false
    end;

    if not v_authorized then
      raise exception 'Campaign access denied' using errcode = '42501';
    end if;
  end if;

  return public._email_campaign_reporting_snapshot(p_campaign_id);
end;
$$;

revoke all on function public.get_email_campaign_reporting_snapshot(uuid)
from public, anon;
grant execute on function public.get_email_campaign_reporting_snapshot(uuid)
to authenticated, service_role;

comment on function public.get_email_campaign_reporting_snapshot(uuid) is
  'Returns an uncapped email campaign report after canonical tenant and location authorization.';

-- This compatibility helper previously called the private reporting engine
-- directly. Route it through the same public authorization boundary so an
-- authenticated caller cannot bypass tenant checks with a campaign UUID.
create or replace function public.get_campaign_derived_metrics(
  p_campaign_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_email_campaign_reporting_snapshot(p_campaign_id)->'metrics'
$$;

revoke all on function public.get_campaign_derived_metrics(uuid)
from public, anon;
grant execute on function public.get_campaign_derived_metrics(uuid)
to authenticated, service_role;

comment on function public.get_campaign_derived_metrics(uuid) is
  'Returns authorized campaign metrics through the canonical reporting snapshot boundary.';
