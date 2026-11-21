-- QA-17: form opt-ins leave no consent history.
-- apply_form_channel_consent (20261121143000) updates crm_customers and
-- customer_consents only. The customer dashboard consent history reads
-- crm_email_consent_events and crm_sms_consent_events, so every website and
-- form signup showed an empty history. This forward migration keeps the
-- function's suppression rules unchanged and adds one 'opt_in' event, with
-- consent_basis 'express' and the submission evidence, each time consent is
-- actually granted. A preserved suppression writes no event.
--
-- Rollback: re-run the function body from 20261121143000.

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

  -- Consent history (QA-17). The customer dashboard reads these tables; a
  -- form opt-in that writes only crm_customers leaves the history empty.
  -- Evidence keeps the page, placement and consent text the visitor saw.
  if p_channel = 'email' then
    insert into public.crm_email_consent_events (
      tenant_id, customer_id, email, event_type, source,
      user_agent, consent_basis, evidence, created_at
    ) values (
      p_tenant_id, p_customer_id, v_customer.email, 'opt_in', p_source,
      nullif(p_details->>'user_agent', ''), 'express',
      coalesce(p_details, '{}'::jsonb), p_consent_at
    );
  elsif coalesce(nullif(p_details->>'phone', ''), v_customer.phone) is not null then
    insert into public.crm_sms_consent_events (
      tenant_id, customer_id, phone, event_type, source,
      user_agent, consent_basis, evidence, created_at
    ) values (
      p_tenant_id, p_customer_id,
      coalesce(nullif(p_details->>'phone', ''), v_customer.phone),
      'opt_in', p_source,
      nullif(p_details->>'user_agent', ''), 'express',
      coalesce(p_details, '{}'::jsonb), p_consent_at
    );
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
