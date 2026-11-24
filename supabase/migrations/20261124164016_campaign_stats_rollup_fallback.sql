-- QA pass 4 #1: one source of truth for campaign stats.
--
-- get_email_campaign_reporting_snapshot is the rollup every surface reads
-- (campaign list, report header, dashboard cards, Reports > Overview, Bloom).
-- It counts recipients, deliveries, opens and clicks from the send ledger
-- (email_messages) and tracking events. A sent campaign with no send records
-- (imported, demo, or sent before tracking) used to report 0 everywhere the
-- snapshot was used, while the list showed the stored crm_campaigns rollup.
--
-- Now, only when the send/event tables hold nothing for a sent campaign, the
-- snapshot falls back to the stored rollup and marks the result estimated
-- (metrics.estimated = true, diagnostics.source = 'crm_campaigns_rollup').
-- Rates are recomputed from the stored counts so the numbers agree with each
-- other. The internal _email_campaign_reporting_snapshot is unchanged, so
-- recompute_campaign_metrics never writes estimates back as recorded data.
-- Additive: existing keys keep their meaning; 'estimated' is a new key.

create or replace function public._email_campaign_stats_with_rollup_fallback(
  p_campaign_id uuid,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_campaign record;
  v_recipients bigint;
  v_sent bigint;
  v_delivered bigint;
  v_opens bigint;
  v_clicks bigint;
begin
  if coalesce((p_snapshot #>> '{metrics,totals,recipients}')::bigint, 0) > 0 then
    return jsonb_set(p_snapshot, '{metrics,estimated}', 'false'::jsonb, true);
  end if;

  select
    campaign.status,
    campaign.total_recipients,
    campaign.total_sent,
    campaign.total_opens,
    campaign.total_clicks
  into v_campaign
  from public.crm_campaigns as campaign
  where campaign.id = p_campaign_id;

  if not found
    or v_campaign.status not in ('sent', 'sent_with_errors')
    or greatest(coalesce(v_campaign.total_sent, 0), coalesce(v_campaign.total_recipients, 0)) <= 0
  then
    return jsonb_set(p_snapshot, '{metrics,estimated}', 'false'::jsonb, true);
  end if;

  v_sent := coalesce(nullif(v_campaign.total_sent, 0), v_campaign.total_recipients, 0);
  v_recipients := greatest(coalesce(v_campaign.total_recipients, 0), v_sent);
  -- No delivery evidence exists, so every stored send counts as delivered.
  v_delivered := v_sent;
  v_opens := least(greatest(coalesce(v_campaign.total_opens, 0), 0), v_delivered);
  v_clicks := least(greatest(coalesce(v_campaign.total_clicks, 0), 0), v_delivered);

  return jsonb_set(
    p_snapshot,
    '{metrics}',
    coalesce(p_snapshot -> 'metrics', '{}'::jsonb) || jsonb_build_object(
      'estimated', true,
      'totals', coalesce(p_snapshot #> '{metrics,totals}', '{}'::jsonb) || jsonb_build_object(
        'recipients', v_recipients,
        'observed_recipients', v_recipients,
        'sent', v_sent,
        'sent_events', v_sent,
        'delivered', v_delivered,
        'successful_reach', v_delivered,
        'opens', v_opens,
        'total_opens', v_opens,
        'opens_non_mpp', v_opens,
        'total_opens_non_mpp', v_opens,
        'clicks', v_clicks,
        'total_clicks', v_clicks,
        'unique_engaged', greatest(v_opens, v_clicks)
      ),
      'rates', coalesce(p_snapshot #> '{metrics,rates}', '{}'::jsonb) || jsonb_build_object(
        'delivery', case when v_sent > 0 then 100 else 0 end,
        'open_reported', case when v_delivered > 0 then round((v_opens::numeric / v_delivered) * 100, 2) else 0 end,
        'open_adjusted', case when v_delivered > 0 then round((v_opens::numeric / v_delivered) * 100, 2) else 0 end,
        'click', case when v_delivered > 0 then round((v_clicks::numeric / v_delivered) * 100, 2) else 0 end,
        'click_to_open', case when v_opens > 0 then round((v_clicks::numeric / v_opens) * 100, 2) else 0 end
      ),
      'scores', jsonb_build_object(
        'reach', case when v_sent > 0 then 100 else 0 end,
        'interaction', case when v_delivered > 0 then round((greatest(v_opens, v_clicks)::numeric / v_delivered) * 100, 2) else 0 end
      ),
      'diagnostics', coalesce(p_snapshot #> '{metrics,diagnostics}', '{}'::jsonb) || jsonb_build_object(
        'source', 'crm_campaigns_rollup',
        'estimated', true,
        'missing_send_ledger', true,
        'delivery_complete', true
      )
    ),
    true
  );
end;
$function$;

revoke all on function public._email_campaign_stats_with_rollup_fallback(uuid, jsonb) from public, anon, authenticated;

create or replace function public.get_email_campaign_reporting_snapshot(p_campaign_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_tenant_id uuid;
  v_location_scope text;
  v_primary_location_id uuid;
  v_authorized boolean := false;
begin
  select
    campaign.tenant_id,
    campaign.location_scope,
    campaign.primary_location_id
  into
    v_tenant_id,
    v_location_scope,
    v_primary_location_id
  from public.crm_campaigns as campaign
  where campaign.id = p_campaign_id;

  if not found then
    raise exception 'Campaign not found' using errcode = 'P0002';
  end if;

  if auth.role() is distinct from 'service_role' then
    if auth.uid() is null then
      raise exception 'Campaign access denied' using errcode = '42501';
    end if;

    v_authorized := case v_location_scope
      when 'all_locations' then
        public.has_tenant_permission(v_tenant_id, 'campaign.read', null::uuid)
      when 'one_location' then
        v_primary_location_id is not null
        and public.has_tenant_permission(
          v_tenant_id,
          'campaign.read',
          v_primary_location_id
        )
      when 'selected_locations' then exists (
        select 1
        from public.campaign_location_targets as target
        where target.campaign_id = p_campaign_id
          and target.tenant_id = v_tenant_id
          and public.has_tenant_permission(
            target.tenant_id,
            'campaign.read',
            target.location_id
          )
      )
      else false
    end;

    if not v_authorized then
      raise exception 'Campaign access denied' using errcode = '42501';
    end if;
  end if;

  return public._email_campaign_stats_with_rollup_fallback(
    p_campaign_id,
    public._email_campaign_reporting_snapshot(p_campaign_id)
  );
end;
$function$;
