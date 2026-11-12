-- Prevent any repeated sale-write attempt for a BloomSites source order.
-- A request with an uncertain network outcome is held for human reconciliation.
begin;

create table if not exists public.lightspeed_storefront_sale_exports (
  grant_id uuid not null references public.lightspeed_storefront_grants(id),
  site_id uuid not null,
  source_order_id uuid not null,
  status text not null default 'claimed' check(status in ('claimed','confirmed','needs_review')),
  provider_sale_id uuid,
  attempted_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (grant_id,source_order_id)
);
alter table public.lightspeed_storefront_sale_exports enable row level security;
revoke all on public.lightspeed_storefront_sale_exports from public,anon,authenticated;
grant select,insert,update on public.lightspeed_storefront_sale_exports to service_role;

create or replace function public.lightspeed_authority_sale_claim_v1(
  p_grant_id uuid,p_site_id uuid,p_order_id uuid
) returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_claimed integer;
begin
  if current_user <> 'service_role' then
    raise exception 'service role required' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.lightspeed_storefront_grants g
    where g.id=p_grant_id and g.site_id=p_site_id and g.status='active'
      and g.edition='x-series'
  ) then raise exception 'active merchant grant required' using errcode='42501'; end if;
  insert into public.lightspeed_storefront_sale_exports(grant_id,site_id,source_order_id)
    values(p_grant_id,p_site_id,p_order_id)
    on conflict(grant_id,source_order_id) do nothing;
  get diagnostics v_claimed = row_count;
  return v_claimed=1;
end $$;
revoke all on function public.lightspeed_authority_sale_claim_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.lightspeed_authority_sale_claim_v1(uuid,uuid,uuid) to service_role;

create or replace function public.lightspeed_authority_sale_finish_v1(
  p_grant_id uuid,p_order_id uuid,p_status text,p_provider_sale_id uuid
) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if current_user <> 'service_role' then
    raise exception 'service role required' using errcode='42501';
  end if;
  if p_status not in ('confirmed','needs_review') or
    (p_status='confirmed' and p_provider_sale_id is null) then
    raise exception 'invalid sale completion' using errcode='22023'; end if;
  update public.lightspeed_storefront_sale_exports
    set status=p_status,provider_sale_id=p_provider_sale_id,finished_at=now()
  where grant_id=p_grant_id and source_order_id=p_order_id and status='claimed';
  if not found then raise exception 'sale claim lost' using errcode='40001'; end if;
end $$;
revoke all on function public.lightspeed_authority_sale_finish_v1(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.lightspeed_authority_sale_finish_v1(uuid,uuid,text,uuid) to service_role;

comment on table public.lightspeed_storefront_sale_exports is
  'Service-only one-shot ledger for externally Stripe-paid Lightspeed sales. Never auto-retry uncertain POSTs.';
commit;
