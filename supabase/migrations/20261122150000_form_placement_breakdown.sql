-- Where a form's signups came from (QA matrix test 9).
--
-- BloomSites tags each website signup with metadata.source = 'bloomsites' and
-- metadata.placement (footer, popup, checkout, event). The form Analytics tab
-- showed referrer pages only, so an owner could not see footer versus popup.
-- get_form_placement_breakdown returns accepted submissions in the window
-- grouped by placement, with a single "other" bucket for anything not from a
-- BloomSites placement (embeds, links, imports).
--
-- Same caller check get_form_analytics uses
-- (20261104130000_guard_form_read_rpcs_tenant_authorization.sql), and the form
-- must belong to p_tenant_id.
--
-- Rollback: drop function public.get_form_placement_breakdown(uuid, uuid, integer);

create or replace function public.get_form_placement_breakdown(
  p_tenant_id uuid,
  p_form_id uuid,
  p_days integer default 30
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 3650);
begin
  if auth.role() is distinct from 'service_role' then
    if auth.uid() is null or not (
      exists (
        select 1 from public.users u
        where u.id = auth.uid() and u.tenant_id = p_tenant_id
      )
      or public.is_master_admin(auth.uid())
    ) then
      raise exception 'Not authorized' using errcode = '42501';
    end if;
  end if;

  if not exists (
    select 1 from public.forms f where f.id = p_form_id and f.tenant_id = p_tenant_id
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return (
    with s as (
      select case
               when fs.metadata->>'source' = 'bloomsites'
                    and fs.metadata->>'placement' in ('footer', 'popup', 'checkout', 'event')
                 then fs.metadata->>'placement'
               else 'other'
             end as placement
      from public.form_submissions fs
      where fs.form_id = p_form_id
        and fs.result = 'accepted'
        and fs.submitted_at > now() - make_interval(days => v_days)
    )
    select jsonb_build_object(
      'days', v_days,
      'total', count(*),
      'footer', count(*) filter (where placement = 'footer'),
      'popup', count(*) filter (where placement = 'popup'),
      'checkout', count(*) filter (where placement = 'checkout'),
      'event', count(*) filter (where placement = 'event'),
      'other', count(*) filter (where placement = 'other')
    )
    from s
  );
end;
$$;

revoke all on function public.get_form_placement_breakdown(uuid, uuid, integer) from public, anon;
grant execute on function public.get_form_placement_breakdown(uuid, uuid, integer) to authenticated, service_role;
