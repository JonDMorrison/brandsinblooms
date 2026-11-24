-- Applied to udldmkqwnxhdeztyqcau on 2026-11-24 (recorded version in filename).

-- QA pass 4 #5: default sender for a tenant with one verified domain.
--
-- When a tenant has exactly one verified email_domains row (status active or
-- warming_up, the statuses the send path accepts) and no default
-- (tenants.default_from_email_domain_id is null), that domain becomes the
-- default, and its From is filled in where empty:
--   default_from_name  = the company name (company_profiles, else tenant name)
--   default_from_email = company_email when it is on that domain,
--                        otherwise mail@<domain>
-- An existing From name/address on the domain is never overwritten, and a
-- tenant that already has a default (or several verified domains) is left
-- alone. Applied at verification time by a trigger on email_domains, and
-- once now for existing tenants in that state. Additive only.

create or replace function public.assign_single_verified_default_sender(p_tenant_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_domain public.email_domains%rowtype;
  v_verified_count integer;
  v_company_name text;
  v_company_email text;
  v_tenant_name text;
  v_from_email text;
begin
  select tenant.name
  into v_tenant_name
  from public.tenants as tenant
  where tenant.id = p_tenant_id
    and tenant.default_from_email_domain_id is null
  for update;

  if not found then
    return false;
  end if;

  select count(*)
  into v_verified_count
  from public.email_domains as domain
  where domain.tenant_id = p_tenant_id
    and domain.status in ('active', 'warming_up');

  if v_verified_count <> 1 then
    return false;
  end if;

  select *
  into v_domain
  from public.email_domains as domain
  where domain.tenant_id = p_tenant_id
    and domain.status in ('active', 'warming_up');

  select
    nullif(btrim(profile.company_name), ''),
    nullif(lower(btrim(profile.company_email)), '')
  into v_company_name, v_company_email
  from public.users as member
  join public.company_profiles as profile on profile.user_id = member.id
  where member.tenant_id = p_tenant_id
  order by
    case member.role when 'owner' then 0 when 'admin' then 1 else 2 end,
    profile.updated_at desc nulls last
  limit 1;

  v_from_email := case
    when v_company_email is not null
      and split_part(v_company_email, '@', 2) = lower(v_domain.domain)
      then v_company_email
    else 'mail@' || lower(v_domain.domain)
  end;

  update public.email_domains as domain
  set default_from_name = coalesce(
        nullif(btrim(domain.default_from_name), ''),
        v_company_name,
        nullif(btrim(v_tenant_name), '')
      ),
      default_from_email = coalesce(
        nullif(btrim(domain.default_from_email), ''),
        v_from_email
      ),
      updated_at = now()
  where domain.id = v_domain.id;

  update public.tenants
  set default_from_email_domain_id = v_domain.id
  where id = p_tenant_id;

  return true;
end;
$function$;

revoke all on function public.assign_single_verified_default_sender(uuid) from public, anon, authenticated;

create or replace function public.email_domains_assign_default_sender()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.status in ('active', 'warming_up')
    and (tg_op = 'INSERT' or old.status is distinct from new.status)
    and (tg_op = 'INSERT' or old.status not in ('active', 'warming_up'))
  then
    perform public.assign_single_verified_default_sender(new.tenant_id);
  end if;
  return null;
end;
$function$;

revoke all on function public.email_domains_assign_default_sender() from public, anon, authenticated;

drop trigger if exists email_domains_assign_default_sender on public.email_domains;
create trigger email_domains_assign_default_sender
  after insert or update of status on public.email_domains
  for each row
  execute function public.email_domains_assign_default_sender();

-- Once now, for tenants already in that state.
select tenant.id, tenant.name, public.assign_single_verified_default_sender(tenant.id) as changed
from public.tenants as tenant
where tenant.default_from_email_domain_id is null
  and exists (
    select 1 from public.email_domains as domain
    where domain.tenant_id = tenant.id
      and domain.status in ('active', 'warming_up')
  );
