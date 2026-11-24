-- QA pass 4 #6: one SMS eligibility rule for the wizard estimate, the enqueue
-- worker and the send-time check.
--
-- public.sms_eligible_customers(tenant) is check_sms_send_eligibility written
-- as a set: a live customer (not deleted, not merged) with a 10-digit phone
-- (a leading 1 is dropped), sms_opt_in true and sms_consent not false, an
-- opt-in date and a consent source, no later SMS consent record that is not
-- 'opted_in', and no active SMS suppression (by customer or phone).
--
-- get_sms_audience_estimate counts it for the SMS wizard (all subscribers, a
-- segment, personas, or an explicit customer list) for callers who may read
-- the tenant's campaigns. filter_sms_eligible_customer_ids lets the enqueue
-- worker (service role) drop ineligible customers before anything is queued.
-- Additive only: check_sms_send_eligibility is unchanged.

create or replace function public.sms_eligible_customers(p_tenant_id uuid)
returns table (customer_id uuid)
language sql
stable
security definer
set search_path to ''
as $function$
  with candidate as (
    select
      customer.id,
      regexp_replace(coalesce(customer.phone, ''), '[^0-9]', '', 'g') as raw_digits
    from public.crm_customers as customer
    where customer.tenant_id = p_tenant_id
      and customer.deleted_at is null
      and customer.merged_into_customer_id is null
      and customer.sms_opt_in is true
      and customer.sms_consent is distinct from false
      and customer.sms_opt_in_at is not null
      and nullif(trim(customer.sms_consent_source), '') is not null
  ),
  normalized as (
    select
      candidate.id,
      case
        when length(candidate.raw_digits) = 11 and left(candidate.raw_digits, 1) = '1'
          then right(candidate.raw_digits, 10)
        else candidate.raw_digits
      end as digits
    from candidate
  )
  select normalized.id
  from normalized
  where length(normalized.digits) = 10
    and coalesce((
      select consent.status
      from public.customer_consents as consent
      where consent.customer_id = normalized.id
        and consent.channel = 'sms'
      order by consent.consent_timestamp desc, consent.created_at desc, consent.id desc
      limit 1
    ), 'opted_in') = 'opted_in'
    and not exists (
      select 1
      from public.suppression_list as suppression
      where suppression.tenant_id = p_tenant_id
        and suppression.channel = 'sms'
        and suppression.lifted_at is null
        and (
          suppression.customer_id = normalized.id
          or regexp_replace(coalesce(suppression.phone, ''), '[^0-9]', '', 'g')
            in (normalized.digits, '1' || normalized.digits)
        )
    );
$function$;

revoke all on function public.sms_eligible_customers(uuid) from public, anon, authenticated;

create or replace function public.get_sms_audience_estimate(
  p_tenant_id uuid,
  p_segment_id uuid default null,
  p_persona_ids uuid[] default null,
  p_customer_ids uuid[] default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_audience_total bigint;
  v_eligible bigint;
begin
  if auth.role() is distinct from 'service_role'
    and not public.has_tenant_permission(p_tenant_id, 'campaign.read', null::uuid)
  then
    raise exception 'Campaign access denied' using errcode = '42501';
  end if;

  with audience as (
    select customer.id
    from public.crm_customers as customer
    where customer.tenant_id = p_tenant_id
      and customer.deleted_at is null
      and customer.merged_into_customer_id is null
      and (p_segment_id is null or exists (
        select 1 from public.customer_segments as membership
        where membership.segment_id = p_segment_id
          and membership.customer_id = customer.id
      ))
      and (coalesce(cardinality(p_persona_ids), 0) = 0 or exists (
        select 1 from public.customer_personas as assignment
        where assignment.customer_id = customer.id
          and assignment.persona_id = any(p_persona_ids)
      ))
      and (p_customer_ids is null or customer.id = any(p_customer_ids))
  )
  select
    count(*),
    count(*) filter (where audience.id in (
      select eligible.customer_id from public.sms_eligible_customers(p_tenant_id) as eligible
    ))
  into v_audience_total, v_eligible
  from audience;

  return jsonb_build_object(
    'audience', v_audience_total,
    'eligible', v_eligible,
    'excluded', v_audience_total - v_eligible
  );
end;
$function$;

revoke all on function public.get_sms_audience_estimate(uuid, uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.get_sms_audience_estimate(uuid, uuid, uuid[], uuid[]) to authenticated, service_role;

create or replace function public.filter_sms_eligible_customer_ids(
  p_tenant_id uuid,
  p_customer_ids uuid[]
)
returns setof uuid
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  return query
  select eligible.customer_id
  from public.sms_eligible_customers(p_tenant_id) as eligible
  where eligible.customer_id = any(p_customer_ids);
end;
$function$;

revoke all on function public.filter_sms_eligible_customer_ids(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.filter_sms_eligible_customer_ids(uuid, uuid[]) to service_role;
