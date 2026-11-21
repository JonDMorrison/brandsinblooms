-- Apply explicit form consent without ever reviving a prior opt-out or
-- suppression. The row locks make the decision and update atomic with
-- preference-centre and unsubscribe writes that lock the same customer.
create or replace function public.apply_form_channel_consent(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_channel text,
  p_consent_at timestamptz,
  p_source text,
  p_details jsonb
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.crm_customers%rowtype;
  v_status text;
begin
  if p_channel not in ('email', 'sms')
     or p_consent_at is null
     or p_consent_at > now() + interval '5 minutes'
     or nullif(btrim(p_source), '') is null then
    raise exception 'invalid_form_consent';
  end if;

  select c.* into v_customer
  from public.crm_customers c
  where c.id = p_customer_id and c.tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'customer_not_found';
  end if;

  select cc.status into v_status
  from public.customer_consents cc
  where cc.customer_id = p_customer_id and cc.channel = p_channel
  for update;

  if v_customer.deleted_at is not null
     or v_customer.merged_into_customer_id is not null
     or coalesce(v_customer.suppressed, false)
     or coalesce(v_customer.opt_out, false)
     or (p_channel = 'email' and v_customer.email_opt_out_at is not null)
     or (p_channel = 'sms' and v_customer.sms_opt_out_at is not null)
     or v_status in ('opted_out', 'suppressed') then
    return 'suppression_preserved';
  end if;

  if p_channel = 'email' then
    update public.crm_customers
    set email_opt_in = true,
        email_opt_in_at = coalesce(email_opt_in_at, p_consent_at),
        email_consent = true,
        email_consent_source = p_source,
        email_consent_method = 'signup_form',
        email_consent_details = coalesce(p_details, '{}'::jsonb),
        updated_at = now()
    where id = p_customer_id;
  else
    update public.crm_customers
    set sms_opt_in = true,
        sms_opt_in_at = coalesce(sms_opt_in_at, p_consent_at),
        sms_consent = true,
        sms_consent_source = p_source,
        sms_consent_method = 'signup_form',
        sms_consent_details = coalesce(p_details, '{}'::jsonb),
        updated_at = now()
    where id = p_customer_id;
  end if;

  insert into public.customer_consents(
    customer_id, channel, status, consent_timestamp, created_at, updated_at
  ) values (
    p_customer_id, p_channel, 'opted_in', p_consent_at, now(), now()
  )
  on conflict (customer_id, channel) do update
    set status = 'opted_in',
        consent_timestamp = greatest(
          public.customer_consents.consent_timestamp,
          excluded.consent_timestamp
        ),
        updated_at = now()
    where public.customer_consents.status not in ('opted_out', 'suppressed');

  return 'opted_in';
end;
$$;

revoke all on function public.apply_form_channel_consent(
  uuid, uuid, text, timestamptz, text, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_form_channel_consent(
  uuid, uuid, text, timestamptz, text, jsonb
) to service_role;

comment on function public.apply_form_channel_consent(
  uuid, uuid, text, timestamptz, text, jsonb
) is 'Atomically applies explicit form consent while preserving every opt-out and suppression.';
