-- Email Deliverability Trust Layer
--
-- Purpose:
-- 1. Add machine-readable one-click unsubscribe headers to outgoing campaign email payloads.
-- 2. Add reconciliation functions so customer/campaign counters are rebuilt from source-of-truth ledgers.
-- 3. Add a recipient delivery timeline RPC for support/admin visibility.
--
-- This migration records production hotfixes applied on 2026-05-21 so future schema
-- resets and environments keep the same deliverability behavior.

-- -----------------------------------------------------------------------------
-- 1. One-click unsubscribe headers
-- -----------------------------------------------------------------------------

create or replace function public.apply_bulk_email_unsubscribe_headers()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_email text;
  v_tenant text;
  v_email_param text;
  v_token text;
  v_token_param text;
  v_unsubscribe_url text;
  v_existing_headers jsonb;
begin
  if new.payload is null or jsonb_typeof(new.payload) <> 'object' then
    return new;
  end if;

  v_email := lower(trim(coalesce(new.email, new.payload->>'to', '')));

  -- Resend payloads often store to as an array. Prefer the ledger email column, then fall back.
  if (v_email = '' or v_email like '[%') and jsonb_typeof(new.payload->'to') = 'array' then
    v_email := lower(trim(coalesce(new.payload->'to'->>0, '')));
  end if;

  v_tenant := coalesce(new.tenant_id::text, new.payload->'headers'->>'X-Tenant-ID');

  if coalesce(v_email, '') = '' or coalesce(v_tenant, '') = '' then
    return new;
  end if;

  -- Match the existing handle-unsubscribe token contract: btoa(email:tenant_id), URL-encoded for query safety.
  v_token := encode(convert_to(v_email || ':' || v_tenant, 'UTF8'), 'base64');
  v_email_param := replace(v_email, '@', '%40');
  v_token_param := replace(replace(replace(v_token, '+', '%2B'), '/', '%2F'), '=', '%3D');
  v_unsubscribe_url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/handle-unsubscribe?email=' || v_email_param || '&tenant_id=' || v_tenant || '&token=' || v_token_param;

  v_existing_headers := case
    when jsonb_typeof(new.payload->'headers') = 'object' then new.payload->'headers'
    else '{}'::jsonb
  end;

  new.payload := jsonb_set(
    new.payload,
    '{headers}',
    v_existing_headers || jsonb_build_object(
      'List-Unsubscribe', '<' || v_unsubscribe_url || '>',
      'List-Unsubscribe-Post', 'List-Unsubscribe=One-Click'
    ),
    true
  );

  return new;
end;
$$;

drop trigger if exists trg_apply_bulk_email_unsubscribe_headers on public.email_messages;
create trigger trg_apply_bulk_email_unsubscribe_headers
before insert or update of payload, email, tenant_id
on public.email_messages
for each row
execute function public.apply_bulk_email_unsubscribe_headers();

-- Backfill queued/sending payloads that have not yet gone to Resend.
update public.email_messages
set payload = payload,
    updated_at = now()
where payload is not null
  and resend_id is null
  and status in ('queued', 'sending')
  and tenant_id is not null
  and email is not null;

-- -----------------------------------------------------------------------------
-- 2. Customer and campaign rollup reconciliation
-- -----------------------------------------------------------------------------

create or replace function public.reconcile_customer_email_rollups(
  p_tenant_id uuid default null,
  p_customer_id uuid default null
)
returns table(customers_updated integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with target_customers as (
    select c.id, c.tenant_id
    from public.crm_customers c
    where (p_tenant_id is null or c.tenant_id = p_tenant_id)
      and (p_customer_id is null or c.id = p_customer_id)
  ), message_rollups as (
    select
      m.customer_id,
      m.tenant_id,
      count(*) filter (where m.status = 'sent' or m.resend_id is not null) as total_sent,
      max(m.sent_at) filter (where m.status = 'sent' or m.resend_id is not null) as last_sent_at
    from public.email_messages m
    join target_customers tc on tc.id = m.customer_id and tc.tenant_id = m.tenant_id
    group by m.customer_id, m.tenant_id
  ), event_rollups as (
    select
      e.customer_id,
      e.tenant_id,
      count(distinct e.email_message_id) filter (where e.event_type = 'delivered') as total_delivered,
      count(distinct e.email_message_id) filter (where e.event_type in ('bounced','hard_bounced','soft_bounced')) as total_bounced,
      count(distinct e.email_message_id) filter (where e.event_type = 'opened') as total_opened,
      count(distinct e.email_message_id) filter (where e.event_type = 'clicked') as total_clicked,
      count(*) filter (where e.event_type in ('unsubscribed','complained')) as total_unsubscribes,
      max(coalesce(e.event_ts_provider, e.ingested_at, e.created_at)) filter (where e.event_type = 'delivered') as last_delivered_at,
      max(coalesce(e.event_ts_provider, e.ingested_at, e.created_at)) filter (where e.event_type = 'opened') as last_opened_at,
      max(coalesce(e.event_ts_provider, e.ingested_at, e.created_at)) filter (where e.event_type = 'clicked') as last_clicked_at,
      max(coalesce(e.event_ts_provider, e.ingested_at, e.created_at)) filter (where e.event_type in ('bounced','hard_bounced','soft_bounced')) as last_bounced_at
    from public.email_governance_email_events e
    join target_customers tc on tc.id = e.customer_id and tc.tenant_id = e.tenant_id
    group by e.customer_id, e.tenant_id
  ), combined as (
    select
      tc.id as customer_id,
      tc.tenant_id,
      coalesce(m.total_sent, 0) as total_sent,
      coalesce(ev.total_delivered, 0) as total_delivered,
      coalesce(ev.total_opened, 0) as total_opened,
      coalesce(ev.total_clicked, 0) as total_clicked,
      coalesce(ev.total_bounced, 0) as total_bounced,
      coalesce(ev.total_unsubscribes, 0) as total_unsubscribes,
      m.last_sent_at,
      ev.last_delivered_at,
      ev.last_opened_at,
      ev.last_clicked_at,
      ev.last_bounced_at
    from target_customers tc
    left join message_rollups m on m.customer_id = tc.id and m.tenant_id = tc.tenant_id
    left join event_rollups ev on ev.customer_id = tc.id and ev.tenant_id = tc.tenant_id
  ), updated_customers as (
    update public.crm_customers c
    set
      total_emails_sent = combined.total_sent,
      total_emails_delivered = combined.total_delivered,
      total_emails_opened = combined.total_opened,
      total_emails_clicked = combined.total_clicked,
      total_emails_bounced = combined.total_bounced,
      total_unsubscribes = combined.total_unsubscribes,
      email_open_rate = case when combined.total_delivered > 0 then least(round((combined.total_opened::numeric / combined.total_delivered::numeric), 4), 9.9999) else 0 end,
      email_click_rate = case when combined.total_delivered > 0 then least(round((combined.total_clicked::numeric / combined.total_delivered::numeric), 4), 9.9999) else 0 end,
      email_bounce_rate = case when combined.total_sent > 0 then least(round((combined.total_bounced::numeric / combined.total_sent::numeric), 4), 9.9999) else 0 end,
      last_email_sent_at = combined.last_sent_at,
      last_email_delivered_at = combined.last_delivered_at,
      last_open_at = coalesce(combined.last_opened_at, c.last_open_at),
      last_email_clicked_at = combined.last_clicked_at,
      last_email_bounced_at = combined.last_bounced_at,
      updated_at = now()
    from combined
    where c.id = combined.customer_id
      and c.tenant_id = combined.tenant_id
    returning c.id
  )
  select count(*) into v_count from updated_customers;

  customers_updated := v_count;
  return next;
end;
$$;

create or replace function public.reconcile_campaign_email_rollups(
  p_campaign_id uuid default null,
  p_tenant_id uuid default null
)
returns table(campaigns_updated integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with target_campaigns as (
    select c.id, c.tenant_id
    from public.crm_campaigns c
    where (p_campaign_id is null or c.id = p_campaign_id)
      and (p_tenant_id is null or c.tenant_id = p_tenant_id)
  ), message_rollups as (
    select
      m.campaign_id,
      m.tenant_id,
      count(*) as total_recipients,
      count(*) filter (where m.status = 'sent' or m.resend_id is not null) as messages_sent,
      count(*) filter (where m.status = 'failed') as messages_failed,
      count(*) filter (where m.status = 'skipped') as messages_skipped_from_messages,
      max(m.sent_at) filter (where m.status = 'sent' or m.resend_id is not null) as last_sent_at
    from public.email_messages m
    join target_campaigns tc on tc.id = m.campaign_id and tc.tenant_id = m.tenant_id
    group by m.campaign_id, m.tenant_id
  ), skip_rollups as (
    select
      s.campaign_id,
      s.tenant_id,
      count(*) as messages_skipped
    from public.email_send_skips s
    join target_campaigns tc on tc.id = s.campaign_id and tc.tenant_id = s.tenant_id
    group by s.campaign_id, s.tenant_id
  ), event_rollups as (
    select
      e.campaign_id,
      e.tenant_id,
      count(distinct e.email_message_id) filter (where e.event_type = 'delivered') as delivered,
      count(distinct e.email_message_id) filter (where e.event_type = 'opened') as opened,
      count(distinct e.email_message_id) filter (where e.event_type = 'clicked') as clicked,
      count(distinct e.email_message_id) filter (where e.event_type in ('bounced','hard_bounced','soft_bounced')) as bounced,
      count(*) filter (where e.event_type in ('unsubscribed','complained')) as unsubscribed
    from public.email_governance_email_events e
    join target_campaigns tc on tc.id = e.campaign_id and tc.tenant_id = e.tenant_id
    group by e.campaign_id, e.tenant_id
  ), combined as (
    select
      tc.id as campaign_id,
      tc.tenant_id,
      coalesce(m.total_recipients, 0) as total_recipients,
      coalesce(m.messages_sent, 0) as messages_sent,
      coalesce(m.messages_failed, 0) as messages_failed,
      greatest(coalesce(m.messages_skipped_from_messages, 0), coalesce(s.messages_skipped, 0)) as messages_skipped,
      m.last_sent_at,
      coalesce(e.delivered, 0) as delivered,
      coalesce(e.opened, 0) as opened,
      coalesce(e.clicked, 0) as clicked,
      coalesce(e.bounced, 0) as bounced,
      coalesce(e.unsubscribed, 0) as unsubscribed
    from target_campaigns tc
    left join message_rollups m on m.campaign_id = tc.id and m.tenant_id = tc.tenant_id
    left join skip_rollups s on s.campaign_id = tc.id and s.tenant_id = tc.tenant_id
    left join event_rollups e on e.campaign_id = tc.id and e.tenant_id = tc.tenant_id
  ), updated_campaigns as (
    update public.crm_campaigns c
    set
      total_recipients = nullif(combined.total_recipients, 0),
      messages_sent = combined.messages_sent,
      messages_failed = combined.messages_failed,
      messages_skipped = combined.messages_skipped,
      total_sent = combined.messages_sent,
      total_opens = combined.opened,
      total_clicks = combined.clicked,
      open_rate = case when combined.delivered > 0 then least(round((combined.opened::numeric / combined.delivered::numeric), 4), 9.9999) else 0 end,
      click_rate = case when combined.delivered > 0 then least(round((combined.clicked::numeric / combined.delivered::numeric), 4), 9.9999) else 0 end,
      metrics = coalesce(c.metrics, '{}'::jsonb) || jsonb_build_object(
        'sent', combined.messages_sent,
        'delivered', combined.delivered,
        'opened', combined.opened,
        'clicked', combined.clicked,
        'bounced', combined.bounced,
        'unsubscribed', combined.unsubscribed,
        'skipped', combined.messages_skipped,
        'failed', combined.messages_failed,
        'reconciled_at', now()
      ),
      rollup_refreshed_at = now(),
      updated_at = now()
    from combined
    where c.id = combined.campaign_id
      and c.tenant_id = combined.tenant_id
    returning c.id
  )
  select count(*) into v_count from updated_campaigns;

  campaigns_updated := v_count;
  return next;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Recipient delivery timeline for support/admin visibility
-- -----------------------------------------------------------------------------

create or replace function public.get_recipient_email_delivery_timeline(
  p_tenant_id uuid,
  p_email text default null,
  p_customer_id uuid default null,
  p_limit integer default 100
)
returns table(
  event_at timestamptz,
  timeline_type text,
  status text,
  campaign_id uuid,
  campaign_name text,
  campaign_subject text,
  customer_id uuid,
  email text,
  email_message_id uuid,
  provider_message_id text,
  details jsonb
)
language sql
security definer
set search_path = public
as $$
  with target_customer as (
    select c.*
    from public.crm_customers c
    where c.tenant_id = p_tenant_id
      and (
        (p_customer_id is not null and c.id = p_customer_id)
        or (p_customer_id is null and p_email is not null and lower(c.email) = lower(trim(p_email)))
      )
    order by c.updated_at desc
    limit 1
  ), eligibility as (
    select
      now() as event_at,
      'eligibility'::text as timeline_type,
      case
        when tc.id is null then 'customer_not_found'
        when coalesce(tc.opt_out, false) = true or tc.email_opt_out_at is not null then 'opted_out'
        when coalesce(tc.suppressed, false) = true then 'suppressed'
        when exists (
          select 1
          from public.suppression_list s
          where s.tenant_id = p_tenant_id
            and lower(s.email) = lower(tc.email)
            and s.channel = 'email'
            and s.lifted_at is null
            and (s.expires_at is null or s.expires_at > now())
        ) then 'suppressed'
        when coalesce(tc.email_opt_in, false) = true then 'eligible'
        else 'not_opted_in'
      end as status,
      null::uuid as campaign_id,
      null::text as campaign_name,
      null::text as campaign_subject,
      tc.id as customer_id,
      coalesce(tc.email, p_email) as email,
      null::uuid as email_message_id,
      null::text as provider_message_id,
      jsonb_build_object(
        'email_opt_in', tc.email_opt_in,
        'email_opt_in_at', tc.email_opt_in_at,
        'email_consent', tc.email_consent,
        'email_consent_source', tc.email_consent_source,
        'email_consent_method', tc.email_consent_method,
        'opt_out', tc.opt_out,
        'email_opt_out_at', tc.email_opt_out_at,
        'suppressed', tc.suppressed,
        'suppressed_at', tc.suppressed_at,
        'suppressed_reason', tc.suppressed_reason
      ) as details
    from target_customer tc
  ), message_events as (
    select
      coalesce(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) as event_at,
      'message'::text as timeline_type,
      m.status,
      m.campaign_id,
      c.name as campaign_name,
      c.subject_line as campaign_subject,
      m.customer_id,
      m.email,
      m.id as email_message_id,
      m.resend_id as provider_message_id,
      jsonb_build_object(
        'domain_id', m.domain_id,
        'attempts', m.attempts,
        'created_at', m.created_at,
        'sent_at', m.sent_at,
        'error_message', m.error_message,
        'dead_lettered_at', m.dead_lettered_at
      ) as details
    from public.email_messages m
    left join public.crm_campaigns c on c.id = m.campaign_id and c.tenant_id = m.tenant_id
    where m.tenant_id = p_tenant_id
      and (
        (p_customer_id is not null and m.customer_id = p_customer_id)
        or (p_customer_id is null and p_email is not null and lower(m.email) = lower(trim(p_email)))
      )
  ), provider_events as (
    select
      coalesce(e.event_ts_provider, e.ingested_at, e.created_at) as event_at,
      'provider_event'::text as timeline_type,
      e.event_type as status,
      e.campaign_id,
      c.name as campaign_name,
      c.subject_line as campaign_subject,
      e.customer_id,
      e.email,
      e.email_message_id,
      e.provider_message_id,
      jsonb_build_object(
        'provider', e.provider,
        'provider_event_id', e.provider_event_id,
        'webhook_delivery_id', e.webhook_delivery_id,
        'is_mpp_guess', e.is_mpp_guess,
        'ingested_at', e.ingested_at,
        'event_data', e.event_data
      ) as details
    from public.email_governance_email_events e
    left join public.crm_campaigns c on c.id = e.campaign_id and c.tenant_id = e.tenant_id
    where e.tenant_id = p_tenant_id
      and (
        (p_customer_id is not null and e.customer_id = p_customer_id)
        or (p_customer_id is null and p_email is not null and lower(e.email) = lower(trim(p_email)))
      )
  ), skip_events as (
    select
      s.created_at as event_at,
      'skip'::text as timeline_type,
      s.reason as status,
      s.campaign_id,
      c.name as campaign_name,
      c.subject_line as campaign_subject,
      s.customer_id,
      s.email,
      null::uuid as email_message_id,
      null::text as provider_message_id,
      jsonb_build_object(
        'automation_id', s.automation_id,
        'automation_node_id', s.automation_node_id,
        'reason', s.reason
      ) as details
    from public.email_send_skips s
    left join public.crm_campaigns c on c.id = s.campaign_id and c.tenant_id = s.tenant_id
    where s.tenant_id = p_tenant_id
      and (
        (p_customer_id is not null and s.customer_id = p_customer_id)
        or (p_customer_id is null and p_email is not null and lower(s.email) = lower(trim(p_email)))
      )
  )
  select * from eligibility
  union all
  select * from message_events
  union all
  select * from provider_events
  union all
  select * from skip_events
  order by event_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;
