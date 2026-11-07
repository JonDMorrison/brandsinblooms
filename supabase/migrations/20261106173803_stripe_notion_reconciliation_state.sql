-- Internal mappings deliberately distinguish CMS identifiers from CRM tenants.
create table public.stripe_notion_customer_links (
  stripe_account_id text not null,
  livemode boolean not null,
  stripe_customer_id text not null,
  notion_page_id uuid not null,
  cms_project_id text,
  cms_site_id uuid,
  cms_tenant_id uuid,
  crm_tenant_id uuid,
  reviewed_at timestamptz not null default now(),
  reviewed_by text not null,
  primary key (stripe_account_id, livemode, stripe_customer_id),
  unique (stripe_account_id, livemode, notion_page_id)
);
create table public.stripe_notion_reconciliation_state (
  stripe_account_id text not null,
  livemode boolean not null,
  stripe_customer_id text not null,
  mismatch_type text not null,
  customer_email text,
  stripe_status text not null,
  notion_stage text not null,
  detail text not null,
  fingerprint text not null,
  notified_fingerprint text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  primary key (stripe_account_id, livemode, stripe_customer_id, mismatch_type)
);
alter table public.stripe_notion_customer_links enable row level security;
alter table public.stripe_notion_reconciliation_state enable row level security;
revoke all on public.stripe_notion_customer_links, public.stripe_notion_reconciliation_state from public, anon, authenticated;
grant all on public.stripe_notion_customer_links, public.stripe_notion_reconciliation_state to service_role;

create function public.reconcile_stripe_notion_snapshot(p_account text, p_scopes jsonb, p_issues jsonb)
returns setof public.stripe_notion_reconciliation_state
language plpgsql security invoker set search_path = '' as $$
declare i jsonb; previous public.stripe_notion_reconciliation_state;
begin
  perform pg_advisory_xact_lock(hashtextextended('stripe-notion:' || p_account, 0));
  for i in select value from jsonb_array_elements(p_issues) loop
    select * into previous from public.stripe_notion_reconciliation_state
      where stripe_account_id=p_account and livemode=(i->>'livemode')::boolean
        and stripe_customer_id=i->>'stripe_customer_id' and mismatch_type=i->>'mismatch_type';
    if previous.fingerprint is distinct from i->>'fingerprint' or previous.resolved_at is not null then
      insert into public.reconciliation_log(stripe_customer_id,customer_email,stripe_status,notion_stage,mismatch_type)
      values(i->>'stripe_customer_id',i->>'customer_email',i->>'stripe_status',i->>'notion_stage',i->>'mismatch_type');
    end if;
    insert into public.stripe_notion_reconciliation_state
      (stripe_account_id,livemode,stripe_customer_id,mismatch_type,customer_email,stripe_status,notion_stage,detail,fingerprint)
    values(p_account,(i->>'livemode')::boolean,i->>'stripe_customer_id',i->>'mismatch_type',i->>'customer_email',i->>'stripe_status',i->>'notion_stage',i->>'detail',i->>'fingerprint')
    on conflict (stripe_account_id,livemode,stripe_customer_id,mismatch_type) do update set
      customer_email=excluded.customer_email, stripe_status=excluded.stripe_status, notion_stage=excluded.notion_stage,
      detail=excluded.detail, fingerprint=excluded.fingerprint, last_seen_at=now(), resolved_at=null;
  end loop;
  update public.stripe_notion_reconciliation_state s set resolved_at=now(), fingerprint='resolved:' || s.fingerprint
  where s.stripe_account_id=p_account and s.resolved_at is null
    and exists(select 1 from jsonb_array_elements(p_scopes) c where c->>'stripe_customer_id'=s.stripe_customer_id and (c->>'livemode')::boolean=s.livemode)
    and not exists(select 1 from jsonb_array_elements(p_issues) i where i->>'stripe_customer_id'=s.stripe_customer_id and (i->>'livemode')::boolean=s.livemode and i->>'mismatch_type'=s.mismatch_type);
  return query select * from public.stripe_notion_reconciliation_state s
    where s.stripe_account_id=p_account and s.notified_fingerprint is distinct from s.fingerprint
    order by s.livemode,s.stripe_customer_id,s.mismatch_type;
end;
$$;
revoke all on function public.reconcile_stripe_notion_snapshot(text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.reconcile_stripe_notion_snapshot(text,jsonb,jsonb) to service_role;
