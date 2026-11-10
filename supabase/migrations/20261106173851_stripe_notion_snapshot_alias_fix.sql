create or replace function public.reconcile_stripe_notion_snapshot(p_account text, p_scopes jsonb, p_issues jsonb)
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
    and not exists(select 1 from jsonb_array_elements(p_issues) candidate where candidate->>'stripe_customer_id'=s.stripe_customer_id and (candidate->>'livemode')::boolean=s.livemode and candidate->>'mismatch_type'=s.mismatch_type);
  return query select * from public.stripe_notion_reconciliation_state s
    where s.stripe_account_id=p_account and s.notified_fingerprint is distinct from s.fingerprint
    order by s.livemode,s.stripe_customer_id,s.mismatch_type;
end;
$$;
revoke all on function public.reconcile_stripe_notion_snapshot(text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.reconcile_stripe_notion_snapshot(text,jsonb,jsonb) to service_role;

