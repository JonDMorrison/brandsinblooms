-- Record a merchant's checkout-phone disclosure before a POS connection begins
-- importing new customers. The policy is intentionally forward-looking: the
-- trigger below runs only when a new provider identity link is created, so
-- enabling a policy never changes historical CRM contacts.

create table if not exists public.pos_sms_checkout_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null check (provider = lower(btrim(provider)) and provider <> ''),
  attestation_id uuid not null references public.consent_attestations(id) on delete restrict,
  attested_by_user_id uuid not null references auth.users(id) on delete restrict,
  is_active boolean not null default true,
  effective_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (is_active and deactivated_at is null)
    or (not is_active and deactivated_at is not null)
  )
);

create unique index if not exists pos_sms_checkout_policies_active_provider_idx
  on public.pos_sms_checkout_policies (tenant_id, provider)
  where is_active;

create index if not exists pos_sms_checkout_policies_tenant_created_idx
  on public.pos_sms_checkout_policies (tenant_id, created_at desc);

alter table public.pos_sms_checkout_policies enable row level security;

create policy "Users can view POS SMS checkout policies for their tenant"
  on public.pos_sms_checkout_policies
  for select
  using (
    exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.tenant_id = pos_sms_checkout_policies.tenant_id
    )
  );

alter table public.crm_sms_consent_events
  add column if not exists attestation_id uuid
  references public.consent_attestations(id) on delete set null;

create index if not exists crm_sms_consent_events_attestation_id_idx
  on public.crm_sms_consent_events (attestation_id)
  where attestation_id is not null;

-- Saving the policy is one database transaction, so a failed onboarding request
-- cannot leave a provider with its prior policy deactivated but no replacement.
create or replace function public.configure_pos_sms_checkout_policy(
  p_tenant_id uuid,
  p_user_id uuid,
  p_provider text
)
returns table (
  id uuid,
  provider text,
  effective_at timestamptz,
  attestation_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_provider text := lower(btrim(p_provider));
  v_attestation_id uuid;
  v_policy_id uuid;
  v_effective_at timestamptz;
  v_attestation_wording constant text :=
    'At checkout, our business makes clear that a customer''s mobile number may be used for promotional SMS messages, giving a number is optional, and they can reply STOP to opt out.';
begin
  if p_tenant_id is null
     or p_user_id is null
     or v_provider not in ('square', 'lightspeed', 'vmx', 'clover', 'shopify') then
    raise exception 'tenant, user, and a supported POS provider are required';
  end if;

  if not exists (
    select 1
    from public.users u
    where u.id = p_user_id
      and u.tenant_id = p_tenant_id
  ) then
    raise exception 'user does not belong to tenant';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_tenant_id::text || ':pos-sms-checkout:' || v_provider,
    0
  ));

  update public.pos_sms_checkout_policies
  set is_active = false,
      deactivated_at = now()
  where tenant_id = p_tenant_id
    and provider = v_provider
    and is_active;

  insert into public.consent_attestations (
    tenant_id,
    attested_by_user_id,
    attestation_type,
    contact_count,
    source,
    import_batch_id,
    attestation_wording
  ) values (
    p_tenant_id,
    p_user_id,
    'express',
    0,
    'pos_onboarding',
    v_provider,
    v_attestation_wording
  ) returning consent_attestations.id into v_attestation_id;

  insert into public.pos_sms_checkout_policies (
    tenant_id,
    provider,
    attestation_id,
    attested_by_user_id
  ) values (
    p_tenant_id,
    v_provider,
    v_attestation_id,
    p_user_id
  ) returning pos_sms_checkout_policies.id, pos_sms_checkout_policies.effective_at
    into v_policy_id, v_effective_at;

  return query
  select v_policy_id, v_provider, v_effective_at, v_attestation_id;
end;
$$;

revoke all on function public.configure_pos_sms_checkout_policy(uuid, uuid, text) from public;
grant execute on function public.configure_pos_sms_checkout_policy(uuid, uuid, text) to service_role;

-- Keep POS identity resolution and marketing consent separate. The identity
-- resolver creates crm_customer_identity_links; this independent, after-insert
-- trigger applies the pre-recorded checkout policy only to a contact newly
-- entering that ledger.
create or replace function public.apply_pos_checkout_sms_consent()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_policy public.pos_sms_checkout_policies%rowtype;
  v_customer public.crm_customers%rowtype;
  v_sms_status text;
  v_now timestamptz := now();
begin
  begin
    select p.*
      into v_policy
    from public.pos_sms_checkout_policies p
    where p.tenant_id = new.tenant_id
      and p.provider = lower(new.provider)
      and p.is_active
      and p.effective_at <= v_now
      and p.deactivated_at is null
    order by p.effective_at desc
    limit 1;

    if not found then
      return new;
    end if;

    select c.*
      into v_customer
    from public.crm_customers c
    where c.id = new.crm_customer_id
      and c.tenant_id = new.tenant_id
    for update;

    if not found
       or v_customer.deleted_at is not null
       or v_customer.merged_into_customer_id is not null
       or nullif(btrim(v_customer.phone), '') is null then
      return new;
    end if;

    select cc.status
      into v_sms_status
    from public.customer_consents cc
    where cc.customer_id = v_customer.id
      and cc.channel = 'sms'
    order by cc.updated_at desc, cc.created_at desc, cc.id desc
    limit 1;

    -- Preserve any existing consent evidence and never override an opt-out or
    -- suppression. This trigger is an initial POS-import rule, not a backfill.
    if coalesce(v_customer.sms_opt_in, false)
       or coalesce(v_customer.sms_consent, false)
       or v_sms_status = 'opted_in'
       or v_customer.sms_opt_out_at is not null
       or coalesce(v_customer.suppressed, false)
       or v_sms_status in ('opted_out', 'suppressed') then
      return new;
    end if;

    update public.crm_customers c
    set sms_opt_in = true,
        sms_opt_in_at = v_now,
        sms_consent = true,
        sms_consent_source = 'pos_checkout_attestation',
        sms_consent_method = 'checkout_phone_disclosure',
        sms_consent_details = coalesce(c.sms_consent_details, '{}'::jsonb)
          || jsonb_build_object(
            'provider', new.provider,
            'policy_id', v_policy.id,
            'attestation_id', v_policy.attestation_id,
            'identity_link_id', new.id,
            'recorded_at', v_now
          ),
        updated_at = v_now
    where c.id = v_customer.id;

    insert into public.crm_sms_consent_events (
      tenant_id,
      customer_id,
      phone,
      event_type,
      source,
      actor_user_id,
      consent_basis,
      evidence,
      attestation_id,
      created_at
    ) values (
      new.tenant_id,
      v_customer.id,
      v_customer.phone,
      'pos_checkout_attested',
      'pos_checkout_attestation',
      v_policy.attested_by_user_id,
      'express',
      jsonb_build_object(
        'provider', new.provider,
        'policy_id', v_policy.id,
        'attestation_id', v_policy.attestation_id,
        'identity_link_id', new.id,
        'attestation_source', 'pos_onboarding'
      ),
      v_policy.attestation_id,
      v_now
    );

    insert into public.customer_consents (
      customer_id,
      channel,
      status,
      consent_timestamp,
      created_at,
      updated_at
    ) values (
      v_customer.id,
      'sms',
      'opted_in',
      v_now,
      v_now,
      v_now
    ) on conflict (customer_id, channel) do update
      set status = excluded.status,
          consent_timestamp = excluded.consent_timestamp,
          updated_at = excluded.updated_at;
  exception when others then
    -- POS import must remain available even if this optional consent sidecar
    -- encounters malformed legacy data. The failure is safe: no consent is set.
    raise warning 'Could not apply POS checkout SMS consent for identity link %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.apply_pos_checkout_sms_consent() from public;
grant execute on function public.apply_pos_checkout_sms_consent() to service_role;

drop trigger if exists trg_apply_pos_checkout_sms_consent
  on public.crm_customer_identity_links;

create trigger trg_apply_pos_checkout_sms_consent
  after insert on public.crm_customer_identity_links
  for each row
  execute function public.apply_pos_checkout_sms_consent();
