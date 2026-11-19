-- Central login milestone 59 (Wave 6, CRM delta fixes), pack db2: caller checks in SECURITY DEFINER functions,
-- RPC grants and triggers. Applies after 20261116080000 (policies and table grants only); nothing here depends on it.
-- Forward-only; no earlier migration is edited. Every function body below is the current definition (hosted dump plus
-- the programme chain, read with pg_get_functiondef) with only the marked change; names, arguments, results,
-- search_path and grants stay as they are unless a REVOKE says otherwise. Callers refused by a check get 42501;
-- service-role callers keep working. Records: crm-r2-F04 (database part), F54 (direct RPC part), F111 (database
-- part), F112 (database part), F118, F144, F148, F153, F154, F156, F157, F158, F160, F161, F162, F164 (getter part),
-- F166, F173, F175, F177, F178, F179, F181 (definer part), F183 (definer part), F184, F189, F190 (check_send_quota
-- part), F191 (definer part), F193.

-- =================================================================================================================
-- 1. Shared read checks for definer functions (crm-r2-F178, F193)
-- can_read_crm_customer: the crm_customers_select_by_scope rule (customer.read at the customer's primary store or at a
-- store in customer_location_activity; company-wide readers pass for every customer of their tenant). The policy's
-- first branch (customer.read with no store in the caller's own or admin-context tenant) is the same as
-- has_tenant_permission(tenant, 'customer.read', <any store>) for those roles, so it is covered.
-- can_read_crm_campaign: the get_email_campaign_reporting_snapshot rule (20261107023100:36-67): campaign.read under the
-- campaign's location scope; users.tenant_id alone is not an authorization boundary. Both: service role true.
CREATE OR REPLACE FUNCTION public.can_read_crm_customer(p_customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.role() IS NOT DISTINCT FROM 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.crm_customers AS customer
      WHERE customer.id = p_customer_id
        AND (
          public.has_tenant_permission(customer.tenant_id, 'customer.read', customer.primary_location_id)
          OR EXISTS (
            SELECT 1
            FROM public.customer_location_activity AS activity
            WHERE activity.customer_id = customer.id
              AND activity.tenant_id = customer.tenant_id
              AND public.has_tenant_permission(activity.tenant_id, 'customer.read', activity.location_id)
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_read_crm_campaign(p_campaign_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid;
  v_location_scope text;
  v_primary_location_id uuid;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;
  IF auth.uid() IS NULL OR p_campaign_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT campaign.tenant_id, campaign.location_scope, campaign.primary_location_id
  INTO v_tenant_id, v_location_scope, v_primary_location_id
  FROM public.crm_campaigns AS campaign
  WHERE campaign.id = p_campaign_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN coalesce(CASE v_location_scope
    WHEN 'all_locations' THEN
      public.has_tenant_permission(v_tenant_id, 'campaign.read', NULL::uuid)
    WHEN 'one_location' THEN
      v_primary_location_id IS NOT NULL
      AND public.has_tenant_permission(v_tenant_id, 'campaign.read', v_primary_location_id)
    WHEN 'selected_locations' THEN EXISTS (
      SELECT 1
      FROM public.campaign_location_targets AS target
      WHERE target.campaign_id = p_campaign_id
        AND target.tenant_id = v_tenant_id
        AND public.has_tenant_permission(target.tenant_id, 'campaign.read', target.location_id)
    )
    ELSE false
  END, false);
END;
$$;

REVOKE ALL ON FUNCTION public.can_read_crm_customer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_crm_campaign(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_crm_customer(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_crm_campaign(uuid) TO authenticated, service_role;

-- =================================================================================================================
-- 2. crm-r2-F177: get_recipient_email_delivery_timeline answered any signed-in caller for any tenant id it named.
-- It now starts with the 47/R-04 check (customer.read company-wide in the named tenant, 20261112180000). The body moves
-- from LANGUAGE sql to plpgsql only so the check can raise; the query is unchanged (#variable_conflict use_column keeps
-- its unqualified column names meaning the columns, as they did in the SQL body).

CREATE OR REPLACE FUNCTION public.get_recipient_email_delivery_timeline(p_tenant_id uuid, p_email text DEFAULT NULL::text, p_customer_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 100)
 RETURNS TABLE(event_at timestamp with time zone, timeline_type text, status text, campaign_id uuid, campaign_name text, campaign_subject text, customer_id uuid, email text, email_message_id uuid, provider_message_id text, details jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
  IF p_tenant_id IS NULL OR NOT public.has_tenant_permission(p_tenant_id, 'customer.read', NULL) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
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
END;
$function$;

-- =================================================================================================================
-- 3. crm-r2-F178 + F179: the customer dashboard RPCs answered any signed-in caller for any customer id. Each now starts
-- with can_read_crm_customer (same reach as reading the customer row itself). F179: purchases come only from POS orders
-- linked to this customer in the customer's own tenant (pos_orders.crm_customer_id and pos_orders.tenant_id, the
-- recalculate_purchase_metrics rule, 20260903183000:144-146), never from another tenant's POS customer that happens to
-- share the email or phone. track_incentive_redeemed and mark_expired_incentives have no app caller: service role only.

CREATE OR REPLACE FUNCTION public.get_customer_unified_timeline(p_customer_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_event_types text[] DEFAULT NULL::text[])
 RETURNS TABLE(id uuid, event_type text, event_category text, title text, description text, impact text, metadata jsonb, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_read_crm_customer(p_customer_id) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH all_events AS (
    -- Purchases from pos_orders linked to this customer in the customer's own tenant (crm-r2-F179)
    SELECT 
      po.id,
      'purchase'::TEXT as event_type,
      'purchase'::TEXT as event_category,
      COALESCE('Order #' || po.external_id, 'Purchase')::TEXT as title,
      ('$' || COALESCE(po.total_amount, 0)::TEXT || ' purchase')::TEXT as description,
      'positive'::TEXT as impact,
      jsonb_build_object(
        'total_amount', po.total_amount,
        'order_number', po.external_id,
        'items_count', COALESCE(jsonb_array_length(po.items), 0)
      ) as metadata,
      po.created_at
    FROM pos_orders po
    INNER JOIN crm_customers c ON c.id = po.crm_customer_id AND c.tenant_id = po.tenant_id
    WHERE c.id = p_customer_id
    
    UNION ALL
    
    -- SMS Messages
    SELECT 
      s.id,
      'sms'::TEXT as event_type,
      'sms'::TEXT as event_category,
      COALESCE(sc.name, 'SMS Message')::TEXT as title,
      LEFT(COALESCE(s.content, 'Message sent'), 100)::TEXT as description,
      'neutral'::TEXT as impact,
      jsonb_build_object(
        'status', s.status
      ) as metadata,
      s.created_at
    FROM sms_messages s
    LEFT JOIN crm_sms_campaigns sc ON s.campaign_id = sc.id
    WHERE s.customer_id = p_customer_id
    
    UNION ALL
    
    -- Email Events from email_tracking_events
    SELECT 
      e.id,
      e.event_type::TEXT as event_type,
      'email'::TEXT as event_category,
      COALESCE(c.subject_line, 'Email ' || e.event_type)::TEXT as title,
      ('Email ' || e.event_type)::TEXT as description,
      CASE 
        WHEN e.event_type IN ('open', 'opened', 'click', 'clicked') THEN 'positive'
        WHEN e.event_type IN ('bounce', 'complaint', 'unsubscribe') THEN 'negative'
        ELSE 'neutral'
      END::TEXT as impact,
      jsonb_build_object(
        'event_type', e.event_type,
        'campaign_id', e.campaign_id
      ) as metadata,
      e.created_at
    FROM email_tracking_events e
    LEFT JOIN crm_campaigns c ON e.campaign_id = c.id
    WHERE e.customer_id = p_customer_id
    
    UNION ALL
    
    -- Loyalty Points Transactions
    SELECT 
      l.id,
      l.transaction_type::TEXT as event_type,
      'loyalty'::TEXT as event_category,
      (CASE 
        WHEN l.points_amount > 0 THEN 'Earned ' || l.points_amount || ' points'
        ELSE 'Redeemed ' || ABS(l.points_amount) || ' points'
      END)::TEXT as title,
      COALESCE(l.description, l.source_type || ' transaction')::TEXT as description,
      CASE WHEN l.points_amount > 0 THEN 'positive' ELSE 'neutral' END::TEXT as impact,
      jsonb_build_object(
        'points_amount', l.points_amount,
        'points_balance_after', l.points_balance_after,
        'source_type', l.source_type,
        'redemption_value', l.redemption_value
      ) as metadata,
      l.created_at
    FROM loyalty_points_transactions l
    WHERE l.customer_id = p_customer_id
    
    UNION ALL
    
    -- Negative Behavior Events (risk signals)
    SELECT 
      n.id,
      n.event_type::TEXT as event_type,
      'risk'::TEXT as event_category,
      (n.event_type || ' detected')::TEXT as title,
      COALESCE(n.bounce_reason, n.event_subtype, 'Risk event recorded')::TEXT as description,
      'negative'::TEXT as impact,
      jsonb_build_object(
        'event_subtype', n.event_subtype,
        'risk_score_impact', n.risk_score_impact,
        'channel', n.channel
      ) as metadata,
      n.created_at
    FROM negative_behavior_events n
    WHERE n.customer_id = p_customer_id
  )
  SELECT 
    ae.id,
    ae.event_type,
    ae.event_category,
    ae.title,
    ae.description,
    ae.impact,
    ae.metadata,
    ae.created_at
  FROM all_events ae
  WHERE (p_event_types IS NULL OR ae.event_category = ANY(p_event_types))
  ORDER BY ae.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_customer_purchase_timeline(p_customer_id uuid, p_months integer DEFAULT 12)
 RETURNS TABLE(period_date date, order_count integer, total_revenue numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_read_crm_customer(p_customer_id) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      date_trunc('month', NOW() - (p_months || ' months')::INTERVAL),
      date_trunc('month', NOW()),
      '1 month'::INTERVAL
    )::DATE AS month_start
  ),
  -- The customer's own tenant: only orders linked to this customer there count (crm-r2-F179)
  customer_info AS (
    SELECT tenant_id FROM crm_customers WHERE id = p_customer_id
  ),
  order_data AS (
    SELECT 
      date_trunc('month', po.order_date)::DATE AS month_start,
      COUNT(*)::INT AS cnt,
      COALESCE(SUM(po.total_amount), 0) AS revenue
    FROM pos_orders po
    JOIN customer_info ci ON po.tenant_id = ci.tenant_id
    WHERE po.crm_customer_id = p_customer_id
      AND po.order_date >= NOW() - (p_months || ' months')::INTERVAL
    GROUP BY date_trunc('month', po.order_date)::DATE
  )
  SELECT 
    ds.month_start AS period_date,
    COALESCE(od.cnt, 0)::INT AS order_count,
    COALESCE(od.revenue, 0)::NUMERIC AS total_revenue
  FROM date_series ds
  LEFT JOIN order_data od ON od.month_start = ds.month_start
  ORDER BY ds.month_start;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_customer_engagement_timeline(p_customer_id uuid, p_months integer DEFAULT 6)
 RETURNS TABLE(period_date date, email_events integer, sms_events integer, engagement_score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_read_crm_customer(p_customer_id) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      date_trunc('week', NOW() - (p_months || ' months')::INTERVAL),
      date_trunc('week', NOW()),
      '1 week'::INTERVAL
    )::DATE AS week_start
  ),
  email_data AS (
    SELECT 
      date_trunc('week', ete.created_at)::DATE AS week_start,
      COUNT(*) AS cnt
    FROM email_tracking_events ete
    WHERE ete.customer_id = p_customer_id
      AND ete.created_at >= NOW() - (p_months || ' months')::INTERVAL
    GROUP BY date_trunc('week', ete.created_at)::DATE
  ),
  sms_data AS (
    SELECT 
      date_trunc('week', sm.created_at)::DATE AS week_start,
      COUNT(*) AS cnt
    FROM sms_messages sm
    WHERE sm.customer_id = p_customer_id
      AND sm.created_at >= NOW() - (p_months || ' months')::INTERVAL
    GROUP BY date_trunc('week', sm.created_at)::DATE
  )
  SELECT 
    ds.week_start AS period_date,
    COALESCE(ed.cnt, 0)::INT AS email_events,
    COALESCE(sd.cnt, 0)::INT AS sms_events,
    LEAST(100, (COALESCE(ed.cnt, 0) * 10 + COALESCE(sd.cnt, 0) * 15))::NUMERIC AS engagement_score
  FROM date_series ds
  LEFT JOIN email_data ed ON ed.week_start = ds.week_start
  LEFT JOIN sms_data sd ON sd.week_start = ds.week_start
  ORDER BY ds.week_start;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_customer_activity_heatmap(p_customer_id uuid, p_channel text DEFAULT 'email'::text)
 RETURNS TABLE(day_of_week integer, hour_of_day integer, event_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_read_crm_customer(p_customer_id) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_channel = 'email' THEN
    RETURN QUERY
    SELECT EXTRACT(DOW FROM ete.created_at)::INT, EXTRACT(HOUR FROM ete.created_at)::INT, COUNT(*)::INT
    FROM email_tracking_events ete
    WHERE ete.customer_id = p_customer_id
      AND ete.event_type IN ('open', 'opened', 'click', 'clicked')
      AND ete.created_at >= NOW() - INTERVAL '90 days'
    GROUP BY EXTRACT(DOW FROM ete.created_at), EXTRACT(HOUR FROM ete.created_at);
  ELSE
    RETURN QUERY
    SELECT EXTRACT(DOW FROM sm.created_at)::INT, EXTRACT(HOUR FROM sm.created_at)::INT, COUNT(*)::INT
    FROM sms_messages sm
    WHERE sm.customer_id = p_customer_id
      AND sm.status IN ('delivered', 'clicked', 'replied')
      AND sm.created_at >= NOW() - INTERVAL '90 days'
    GROUP BY EXTRACT(DOW FROM sm.created_at), EXTRACT(HOUR FROM sm.created_at);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_customer_engagement_decay(p_customer_id uuid)
 RETURNS TABLE(week_number integer, engagement_percentage numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_read_crm_customer(p_customer_id) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH weeks AS (SELECT generate_series(1, 10) AS week_num),
  weekly_engagement AS (
    SELECT CEIL(EXTRACT(EPOCH FROM (NOW() - ete.created_at)) / (7 * 24 * 3600))::INT AS weeks_ago,
           COUNT(*) AS event_count
    FROM email_tracking_events ete
    WHERE ete.customer_id = p_customer_id
      AND ete.event_type IN ('open', 'opened', 'click', 'clicked')
      AND ete.created_at >= NOW() - INTERVAL '10 weeks'
    GROUP BY 1
  ),
  max_engagement AS (SELECT GREATEST(MAX(event_count), 1) AS max_count FROM weekly_engagement)
  SELECT w.week_num::INT,
         COALESCE(ROUND((we.event_count::NUMERIC / me.max_count) * 100, 1), 0)
  FROM weeks w
  CROSS JOIN max_engagement me
  LEFT JOIN weekly_engagement we ON we.weeks_ago = w.week_num
  ORDER BY w.week_num;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_customer_channel_trend(p_customer_id uuid, p_months integer DEFAULT 6)
 RETURNS TABLE(month_label text, preferred_channel text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_read_crm_customer(p_customer_id) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      date_trunc('month', NOW() - (p_months || ' months')::INTERVAL),
      date_trunc('month', NOW()),
      '1 month'::INTERVAL
    ) AS month_start
  ),
  email_monthly AS (
    SELECT date_trunc('month', ete.created_at) AS month_start, COUNT(*) AS cnt
    FROM email_tracking_events ete
    WHERE ete.customer_id = p_customer_id
      AND ete.event_type IN ('open', 'opened', 'click', 'clicked')
      AND ete.created_at >= NOW() - (p_months || ' months')::INTERVAL
    GROUP BY 1
  ),
  sms_monthly AS (
    SELECT date_trunc('month', sm.created_at) AS month_start, COUNT(*) AS cnt
    FROM sms_messages sm
    WHERE sm.customer_id = p_customer_id
      AND sm.status IN ('delivered', 'clicked', 'replied')
      AND sm.created_at >= NOW() - (p_months || ' months')::INTERVAL
    GROUP BY 1
  )
  SELECT TO_CHAR(ds.month_start, 'Mon'),
         CASE WHEN COALESCE(em.cnt, 0) >= COALESCE(sm.cnt, 0) THEN 'email' ELSE 'sms' END
  FROM date_series ds
  LEFT JOIN email_monthly em ON em.month_start = ds.month_start
  LEFT JOIN sms_monthly sm ON sm.month_start = ds.month_start
  ORDER BY ds.month_start;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.track_incentive_redeemed(uuid, text, uuid, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_expired_incentives() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_incentive_redeemed(uuid, text, uuid, numeric, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_expired_incentives() TO service_role;

-- =================================================================================================================
-- 4. crm-r2-F193: the campaign recipient RPCs admitted the campaign owner or any member of the campaign's tenant, with
-- no campaign.read and no store scope. The owner-or-same-tenant block becomes can_read_crm_campaign (same refusal
-- shape as before: an empty result / not_found). Customer-profile fields (name, phone, spend, purchase dates, custom
-- fields) come only from a customer row in the campaign's tenant that the caller may read (company-wide readers skip
-- the per-row check); the recipient address and send status come from email_messages as before. The page RPC builds
-- its rows from get_campaign_recipient_matches, so it inherits the masking.

CREATE OR REPLACE FUNCTION public.get_campaign_recipient_matches(p_campaign_id uuid, p_search text DEFAULT NULL::text, p_event_filters text[] DEFAULT NULL::text[], p_event_filter text DEFAULT 'all'::text, p_time_range text DEFAULT 'all'::text, p_delivery_filter text DEFAULT 'all'::text, p_recipient_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(recipient_id uuid, customer_id uuid, customer_name text, customer_email text, send_status text, latest_event text, latest_event_at timestamp with time zone, delivery_status text, sent_at timestamp with time zone, created_at timestamp with time zone, has_sent boolean, has_delivered boolean, has_opened boolean, has_clicked boolean, has_bounced boolean, has_complained boolean, has_unsubscribed boolean, latest_event_rank integer, all_events text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET enable_nestloop TO 'off'
 SET jit TO 'off'
AS $function$
DECLARE
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;
  v_campaign_user_id UUID;
  v_campaign_tenant_id UUID;
  v_effective_tenant_id UUID;
  v_search TEXT := NULLIF(BTRIM(p_search), '');
  v_event_filter TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_event_filter), ''), 'all'));
  v_time_range TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_time_range), ''), 'all'));
  v_delivery_filter TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_delivery_filter), ''), 'all'));
  v_time_cutoff TIMESTAMPTZ := NULL;
  v_event_filters TEXT[] := ARRAY[]::TEXT[];
  v_customer_read_all BOOLEAN := false;
BEGIN
  v_actor_user_id := auth.uid();

  IF v_actor_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT u.tenant_id
  INTO v_actor_tenant_id
  FROM public.users u
  WHERE u.id = v_actor_user_id;

  SELECT c.user_id, c.tenant_id
  INTO v_campaign_user_id, v_campaign_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL AND v_campaign_tenant_id IS NULL THEN
    RETURN;
  END IF;

  v_effective_tenant_id := v_campaign_tenant_id;

  IF v_effective_tenant_id IS NULL AND v_campaign_user_id IS NOT NULL THEN
    SELECT u.tenant_id
    INTO v_effective_tenant_id
    FROM public.users u
    WHERE u.id = v_campaign_user_id;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.crm_campaigns c
    JOIN public.crm_segments s ON s.id = c.segment_id
    WHERE c.id = p_campaign_id
    LIMIT 1;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.campaign_segments cs
    JOIN public.crm_segments s ON s.id = cs.segment_id
    WHERE cs.campaign_id = p_campaign_id
    LIMIT 1;
  END IF;

  -- central-login 59 (crm-r2-F193): campaign.read under the campaign's location scope.
  IF NOT public.can_read_crm_campaign(p_campaign_id) THEN
    RETURN;
  END IF;

  v_customer_read_all := public.has_tenant_permission(v_effective_tenant_id, 'customer.read', NULL);

  IF p_event_filters IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT normalized_event), ARRAY[]::TEXT[])
    INTO v_event_filters
    FROM (
      SELECT LOWER(BTRIM(event_value)) AS normalized_event
      FROM unnest(p_event_filters) AS event_value
    ) normalized
    WHERE normalized_event IN ('delivered', 'opened', 'clicked', 'bounced', 'complained');
  END IF;

  IF array_length(v_event_filters, 1) IS NULL
    AND v_event_filter IN ('delivered', 'opened', 'clicked', 'bounced', 'complained') THEN
    v_event_filters := ARRAY[v_event_filter];
    v_event_filter := 'all';
  END IF;

  CASE v_time_range
    WHEN '1h' THEN v_time_cutoff := NOW() - INTERVAL '1 hour';
    WHEN '24h' THEN v_time_cutoff := NOW() - INTERVAL '24 hours';
    WHEN '7d' THEN v_time_cutoff := NOW() - INTERVAL '7 days';
    ELSE v_time_cutoff := NULL;
  END CASE;

  RETURN QUERY
  WITH recipient_base AS (
    SELECT
      m.id AS recipient_id,
      m.customer_id,
      m.email AS customer_email,
      m.status AS send_status,
      m.sent_at,
      m.last_attempt_at,
      m.created_at,
      c.first_name,
      c.last_name
    FROM public.email_messages m
    LEFT JOIN public.crm_customers c ON c.id = m.customer_id
      AND c.tenant_id = v_effective_tenant_id
      AND CASE WHEN v_customer_read_all THEN true ELSE public.can_read_crm_customer(m.customer_id) END
    WHERE m.campaign_id = p_campaign_id
      AND m.tenant_id = v_effective_tenant_id
      AND (
        p_recipient_ids IS NULL
        OR cardinality(p_recipient_ids) = 0
        OR m.id = ANY(p_recipient_ids)
      )
  ),
  event_rollup AS (
    SELECT
      LOWER(e.customer_email) AS recipient_email,
      BOOL_OR(e.event_type = 'sent') AS has_sent,
      BOOL_OR(e.event_type = 'delivered') AS has_delivered,
      BOOL_OR(e.event_type IN ('open', 'opened')) AS has_opened,
      BOOL_OR((e.event_type IN ('click', 'clicked') AND NOT COALESCE(e.is_mpp_guess, false))) AS has_clicked,
      BOOL_OR(e.event_type IN ('bounce', 'bounced')) AS has_bounced,
      BOOL_OR(e.event_type IN ('complaint', 'complained')) AS has_complained,
      BOOL_OR(e.event_type = 'unsubscribed') AS has_unsubscribed,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type = 'sent') AS sent_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type = 'delivered') AS delivered_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type IN ('open', 'opened')) AS opened_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE (e.event_type IN ('click', 'clicked') AND NOT COALESCE(e.is_mpp_guess, false))) AS clicked_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type IN ('bounce', 'bounced')) AS bounced_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type IN ('complaint', 'complained')) AS complained_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type = 'unsubscribed') AS unsubscribed_event_at,
      array_remove(array_agg(DISTINCT CASE
        WHEN e.event_type IN ('open', 'opened') THEN 'opened'
        WHEN (e.event_type IN ('click', 'clicked') AND NOT COALESCE(e.is_mpp_guess, false)) THEN 'clicked'
        WHEN e.event_type IN ('bounce', 'bounced') THEN 'bounced'
        WHEN e.event_type IN ('complaint', 'complained') THEN 'complained'
        WHEN e.event_type IN ('sent', 'delivered', 'unsubscribed') THEN LOWER(e.event_type)
        ELSE NULL
      END), NULL) AS all_events
    FROM public.email_tracking_events e
    WHERE e.campaign_id = p_campaign_id
      AND e.tenant_id = v_effective_tenant_id
    GROUP BY LOWER(e.customer_email)
  ),
  recipient_rows AS (
    SELECT
      rb.recipient_id,
      rb.customer_id,
      NULLIF(BTRIM(CONCAT(COALESCE(rb.first_name, ''), ' ', COALESCE(rb.last_name, ''))), '') AS customer_name,
      rb.customer_email,
      rb.send_status,
      CASE
        WHEN COALESCE(er.has_clicked, false) THEN 'clicked'
        WHEN COALESCE(er.has_opened, false) THEN 'opened'
        WHEN COALESCE(er.has_delivered, false) THEN 'delivered'
        WHEN COALESCE(er.has_sent, false) THEN 'sent'
        WHEN COALESCE(er.has_bounced, false) THEN 'bounced'
        WHEN COALESCE(er.has_complained, false) THEN 'complained'
        WHEN COALESCE(er.has_unsubscribed, false) THEN 'unsubscribed'
        WHEN rb.send_status = 'failed' THEN 'failed'
        WHEN rb.send_status = 'sending' THEN 'sending'
        WHEN rb.send_status = 'queued' THEN 'queued'
        WHEN rb.send_status = 'skipped' THEN 'skipped'
        ELSE 'sent'
      END AS latest_event,
      CASE
        WHEN COALESCE(er.has_clicked, false) THEN er.clicked_event_at
        WHEN COALESCE(er.has_opened, false) THEN er.opened_event_at
        WHEN COALESCE(er.has_delivered, false) THEN er.delivered_event_at
        WHEN COALESCE(er.has_sent, false) THEN er.sent_event_at
        WHEN COALESCE(er.has_bounced, false) THEN er.bounced_event_at
        WHEN COALESCE(er.has_complained, false) THEN er.complained_event_at
        WHEN COALESCE(er.has_unsubscribed, false) THEN er.unsubscribed_event_at
        ELSE COALESCE(rb.sent_at, rb.last_attempt_at, rb.created_at)
      END AS latest_event_at,
      CASE
        WHEN COALESCE(er.has_bounced, false) THEN 'bounced'
        WHEN rb.send_status = 'failed' THEN 'failed'
        WHEN COALESCE(er.has_delivered, false) OR COALESCE(er.has_opened, false) OR COALESCE(er.has_clicked, false) OR COALESCE(er.has_complained, false) THEN 'delivered'
        WHEN rb.send_status = 'sent' AND NOT COALESCE(er.has_delivered, false) AND NOT COALESCE(er.has_bounced, false) THEN 'pending'
        WHEN rb.send_status = 'sending' THEN 'pending'
        WHEN rb.send_status = 'queued' THEN 'pending'
        ELSE 'unknown'
      END AS delivery_status,
      rb.sent_at,
      rb.created_at,
      COALESCE(er.has_sent, false) AS has_sent,
      COALESCE(er.has_delivered, false) AS has_delivered,
      COALESCE(er.has_opened, false) AS has_opened,
      COALESCE(er.has_clicked, false) AS has_clicked,
      COALESCE(er.has_bounced, false) AS has_bounced,
      COALESCE(er.has_complained, false) AS has_complained,
      COALESCE(er.has_unsubscribed, false) AS has_unsubscribed,
      CASE
        WHEN COALESCE(er.has_clicked, false) THEN 7
        WHEN COALESCE(er.has_opened, false) THEN 6
        WHEN COALESCE(er.has_delivered, false) THEN 5
        WHEN COALESCE(er.has_sent, false) THEN 4
        WHEN COALESCE(er.has_bounced, false) THEN 3
        WHEN COALESCE(er.has_complained, false) THEN 2
        WHEN COALESCE(er.has_unsubscribed, false) THEN 1
        WHEN rb.send_status = 'failed' THEN 0
        ELSE 4
      END AS latest_event_rank,
      COALESCE(er.all_events, ARRAY[]::TEXT[]) AS all_events
    FROM recipient_base rb
    LEFT JOIN event_rollup er ON LOWER(rb.customer_email) = er.recipient_email
  )
  SELECT
    rr.recipient_id,
    rr.customer_id,
    rr.customer_name,
    rr.customer_email,
    rr.send_status,
    rr.latest_event,
    rr.latest_event_at,
    rr.delivery_status,
    rr.sent_at,
    rr.created_at,
    rr.has_sent,
    rr.has_delivered,
    rr.has_opened,
    rr.has_clicked,
    rr.has_bounced,
    rr.has_complained,
    rr.has_unsubscribed,
    rr.latest_event_rank,
    rr.all_events
  FROM recipient_rows rr
  WHERE (
      v_search IS NULL
      OR LOWER(rr.customer_email) LIKE '%' || LOWER(v_search) || '%'
      OR LOWER(COALESCE(rr.customer_name, '')) LIKE '%' || LOWER(v_search) || '%'
    )
    AND (
      v_time_cutoff IS NULL
      OR rr.latest_event_at >= v_time_cutoff
    )
    AND CASE v_delivery_filter
      WHEN 'delivered' THEN rr.has_delivered
      WHEN 'bounced' THEN rr.has_bounced
      WHEN 'pending' THEN rr.send_status IN ('sent', 'sending', 'queued') AND NOT rr.has_delivered AND NOT rr.has_bounced
      WHEN 'failed' THEN rr.send_status = 'failed'
      ELSE TRUE
    END
    AND CASE
      WHEN v_event_filter = 'engaged' THEN rr.has_opened OR rr.has_clicked
      WHEN v_event_filter = 'unengaged' THEN rr.has_delivered AND NOT rr.has_opened AND NOT rr.has_clicked AND NOT rr.has_bounced
      WHEN v_event_filter = 'issues' THEN rr.has_bounced OR rr.has_complained
      WHEN array_length(v_event_filters, 1) IS NOT NULL THEN
        ('delivered' = ANY(v_event_filters) AND rr.has_delivered)
        OR ('opened' = ANY(v_event_filters) AND rr.has_opened)
        OR ('clicked' = ANY(v_event_filters) AND rr.has_clicked)
        OR ('bounced' = ANY(v_event_filters) AND rr.has_bounced)
        OR ('complained' = ANY(v_event_filters) AND rr.has_complained)
      ELSE TRUE
    END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_campaign_recipients_page(p_campaign_id uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 25, p_search text DEFAULT NULL::text, p_event_filter text DEFAULT 'all'::text, p_sort_column text DEFAULT 'event_time'::text, p_sort_direction text DEFAULT 'desc'::text, p_event_filters text[] DEFAULT NULL::text[], p_time_range text DEFAULT 'all'::text, p_delivery_filter text DEFAULT 'all'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;
  v_campaign_user_id UUID;
  v_campaign_tenant_id UUID;
  v_effective_tenant_id UUID;
  v_page INTEGER := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size INTEGER := LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 100);
  v_offset INTEGER;
  v_search TEXT := NULLIF(BTRIM(p_search), '');
  v_event_filter TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_event_filter), ''), 'all'));
  v_sort_column TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_sort_column), ''), 'event_time'));
  v_sort_direction TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_sort_direction), ''), 'desc'));
  v_time_range TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_time_range), ''), 'all'));
  v_delivery_filter TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_delivery_filter), ''), 'all'));
  result JSONB;
BEGIN
  v_actor_user_id := auth.uid();
  v_offset := (v_page - 1) * v_page_size;

  IF v_actor_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'campaign', NULL,
      'rows', '[]'::jsonb,
      'pagination', jsonb_build_object('page', v_page, 'page_size', v_page_size, 'total_count', 0, 'total_pages', 0),
      'not_found', true
    );
  END IF;

  SELECT u.tenant_id INTO v_actor_tenant_id FROM public.users u WHERE u.id = v_actor_user_id;
  SELECT c.user_id, c.tenant_id INTO v_campaign_user_id, v_campaign_tenant_id FROM public.crm_campaigns c WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL AND v_campaign_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'campaign', NULL,
      'rows', '[]'::jsonb,
      'pagination', jsonb_build_object('page', v_page, 'page_size', v_page_size, 'total_count', 0, 'total_pages', 0),
      'not_found', true
    );
  END IF;

  v_effective_tenant_id := v_campaign_tenant_id;
  IF v_effective_tenant_id IS NULL AND v_campaign_user_id IS NOT NULL THEN
    SELECT u.tenant_id INTO v_effective_tenant_id FROM public.users u WHERE u.id = v_campaign_user_id;
  END IF;
  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id INTO v_effective_tenant_id
    FROM public.crm_campaigns c
    JOIN public.crm_segments s ON s.id = c.segment_id
    WHERE c.id = p_campaign_id
    LIMIT 1;
  END IF;
  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id INTO v_effective_tenant_id
    FROM public.campaign_segments cs
    JOIN public.crm_segments s ON s.id = cs.segment_id
    WHERE cs.campaign_id = p_campaign_id
    LIMIT 1;
  END IF;

  -- central-login 59 (crm-r2-F193): campaign.read under the campaign's location scope.
  IF NOT public.can_read_crm_campaign(p_campaign_id) THEN
    RETURN jsonb_build_object(
      'campaign', NULL,
      'rows', '[]'::jsonb,
      'pagination', jsonb_build_object('page', v_page, 'page_size', v_page_size, 'total_count', 0, 'total_pages', 0),
      'not_found', true
    );
  END IF;

  IF v_sort_column NOT IN ('customer_name', 'email', 'latest_event', 'event_time') THEN
    v_sort_column := 'event_time';
  END IF;
  IF v_sort_direction NOT IN ('asc', 'desc') THEN
    v_sort_direction := 'desc';
  END IF;

  WITH campaign_base AS (
    SELECT
      c.id,
      c.name,
      c.subject_line,
      c.status,
      c.scheduled_at,
      c.sent_at,
      c.created_at,
      CASE
        WHEN c.metrics IS NULL OR c.metrics = '{}'::jsonb THEN public.get_campaign_derived_metrics(c.id)
        ELSE c.metrics
      END AS metrics,
      t.settings AS tenant_settings
    FROM public.crm_campaigns c
    LEFT JOIN public.tenants t ON t.id = v_effective_tenant_id
    WHERE c.id = p_campaign_id
  ),
  segment_rows AS (
    SELECT DISTINCT s.id, s.name
    FROM public.crm_campaigns c
    JOIN public.crm_segments s ON s.id = c.segment_id
    WHERE c.id = p_campaign_id
    UNION
    SELECT DISTINCT s.id, s.name
    FROM public.campaign_segments cs
    JOIN public.crm_segments s ON s.id = cs.segment_id
    WHERE cs.campaign_id = p_campaign_id
  ),
  filtered AS (
    SELECT
      rr.*,
      COUNT(*) OVER() AS total_count
    FROM public.get_campaign_recipient_matches(
      p_campaign_id,
      v_search,
      p_event_filters,
      v_event_filter,
      v_time_range,
      v_delivery_filter,
      NULL
    ) rr
  ),
  paginated AS (
    SELECT *
    FROM filtered
    ORDER BY
      CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'asc' THEN LOWER(COALESCE(customer_name, customer_email)) END ASC NULLS LAST,
      CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'desc' THEN LOWER(COALESCE(customer_name, customer_email)) END DESC NULLS LAST,
      CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'asc' THEN LOWER(customer_email) END ASC NULLS LAST,
      CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'desc' THEN LOWER(customer_email) END DESC NULLS LAST,
      CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'asc' THEN latest_event_rank END ASC NULLS LAST,
      CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'desc' THEN latest_event_rank END DESC NULLS LAST,
      CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'asc' THEN latest_event_at END ASC NULLS LAST,
      CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'desc' THEN latest_event_at END DESC NULLS LAST,
      created_at DESC,
      recipient_id ASC
    LIMIT v_page_size OFFSET v_offset
  ),
  total_rows AS (
    SELECT COALESCE(MAX(total_count), 0)::INTEGER AS total_count FROM filtered
  ),
  campaign_recipient_count AS (
    SELECT COUNT(*)::INTEGER AS total_recipients
    FROM public.email_messages m
    WHERE m.campaign_id = p_campaign_id
      AND m.tenant_id = v_effective_tenant_id
  )
  SELECT jsonb_build_object(
    'campaign', (
      SELECT jsonb_build_object(
        'id', cb.id,
        'name', cb.name,
        'subject_line', cb.subject_line,
        'status', cb.status,
        'scheduled_at', cb.scheduled_at,
        'sent_at', cb.sent_at,
        'created_at', cb.created_at,
        'metrics', cb.metrics,
        'tenant_timezone', NULLIF(cb.tenant_settings->>'timezone', ''),
        'segments', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', sr.id, 'name', sr.name) ORDER BY sr.name ASC)
          FROM segment_rows sr
        ), '[]'::jsonb),
        'recipient_count', COALESCE((SELECT total_recipients FROM campaign_recipient_count), 0)
      )
      FROM campaign_base cb
    ),
    'rows', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'recipient_id', p.recipient_id,
        'customer_id', p.customer_id,
        'customer_name', p.customer_name,
        'customer_email', p.customer_email,
        'send_status', p.send_status,
        'latest_event', p.latest_event,
        'latest_event_at', p.latest_event_at,
        'delivery_status', p.delivery_status,
        'sent_at', p.sent_at,
        'created_at', p.created_at,
        'all_events', COALESCE(to_jsonb(p.all_events), '[]'::jsonb)
      ))
      FROM paginated p
    ), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', v_page,
      'page_size', v_page_size,
      'total_count', COALESCE((SELECT total_count FROM total_rows), 0),
      'total_pages', CASE
        WHEN COALESCE((SELECT total_count FROM total_rows), 0) = 0 THEN 0
        ELSE CEIL(COALESCE((SELECT total_count FROM total_rows), 0)::NUMERIC / v_page_size::NUMERIC)::INTEGER
      END
    ),
    'filters', jsonb_build_object(
      'search', v_search,
      'event_filter', v_event_filter,
      'event_filters', COALESCE(to_jsonb(p_event_filters), '[]'::jsonb),
      'time_range', v_time_range,
      'delivery_filter', v_delivery_filter,
      'sort_column', v_sort_column,
      'sort_direction', v_sort_direction
    ),
    'not_found', false
  ) INTO result;

  RETURN COALESCE(result, jsonb_build_object(
    'campaign', NULL,
    'rows', '[]'::jsonb,
    'pagination', jsonb_build_object('page', v_page, 'page_size', v_page_size, 'total_count', 0, 'total_pages', 0),
    'not_found', true
  ));
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_campaign_recipient_detail(p_campaign_id uuid, p_recipient_id uuid, p_search text DEFAULT NULL::text, p_event_filter text DEFAULT 'all'::text, p_sort_column text DEFAULT 'event_time'::text, p_sort_direction text DEFAULT 'desc'::text, p_event_filters text[] DEFAULT NULL::text[], p_time_range text DEFAULT 'all'::text, p_delivery_filter text DEFAULT 'all'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;
  v_campaign_user_id UUID;
  v_campaign_tenant_id UUID;
  v_effective_tenant_id UUID;
  v_search TEXT := NULLIF(BTRIM(p_search), '');
  v_event_filter TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_event_filter), ''), 'all'));
  v_sort_column TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_sort_column), ''), 'event_time'));
  v_sort_direction TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_sort_direction), ''), 'desc'));
  v_time_range TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_time_range), ''), 'all'));
  v_delivery_filter TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_delivery_filter), ''), 'all'));
  result JSONB;
  v_customer_read_all BOOLEAN := false;
BEGIN
  v_actor_user_id := auth.uid();

  IF v_actor_user_id IS NULL THEN
    RETURN jsonb_build_object('campaign', NULL, 'recipient', NULL, 'navigation', NULL, 'insights', NULL, 'timeline', '[]'::jsonb, 'activity_log', '[]'::jsonb, 'not_found', true);
  END IF;

  SELECT u.tenant_id INTO v_actor_tenant_id FROM public.users u WHERE u.id = v_actor_user_id;
  SELECT c.user_id, c.tenant_id INTO v_campaign_user_id, v_campaign_tenant_id FROM public.crm_campaigns c WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL AND v_campaign_tenant_id IS NULL THEN
    RETURN jsonb_build_object('campaign', NULL, 'recipient', NULL, 'navigation', NULL, 'insights', NULL, 'timeline', '[]'::jsonb, 'activity_log', '[]'::jsonb, 'not_found', true);
  END IF;

  v_effective_tenant_id := v_campaign_tenant_id;
  IF v_effective_tenant_id IS NULL AND v_campaign_user_id IS NOT NULL THEN
    SELECT u.tenant_id INTO v_effective_tenant_id FROM public.users u WHERE u.id = v_campaign_user_id;
  END IF;
  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id INTO v_effective_tenant_id
    FROM public.crm_campaigns c
    JOIN public.crm_segments s ON s.id = c.segment_id
    WHERE c.id = p_campaign_id
    LIMIT 1;
  END IF;
  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id INTO v_effective_tenant_id
    FROM public.campaign_segments cs
    JOIN public.crm_segments s ON s.id = cs.segment_id
    WHERE cs.campaign_id = p_campaign_id
    LIMIT 1;
  END IF;

  -- central-login 59 (crm-r2-F193): campaign.read under the campaign's location scope.
  IF NOT public.can_read_crm_campaign(p_campaign_id) THEN
    RETURN jsonb_build_object('campaign', NULL, 'recipient', NULL, 'navigation', NULL, 'insights', NULL, 'timeline', '[]'::jsonb, 'activity_log', '[]'::jsonb, 'not_found', true);
  END IF;

  v_customer_read_all := public.has_tenant_permission(v_effective_tenant_id, 'customer.read', NULL);

  IF v_sort_column NOT IN ('customer_name', 'email', 'latest_event', 'event_time') THEN
    v_sort_column := 'event_time';
  END IF;
  IF v_sort_direction NOT IN ('asc', 'desc') THEN
    v_sort_direction := 'desc';
  END IF;

  WITH campaign_base AS (
    SELECT
      c.id,
      c.name,
      c.subject_line,
      c.content,
      c.status,
      c.scheduled_at,
      c.sent_at,
      c.created_at,
      c.sender_display_name,
      c.actual_sender_email,
      c.delivery_method,
      c.from_email_domain_id,
      d.domain AS domain_name,
      d.default_from_name,
      d.default_from_email,
      d.default_reply_to,
      t.settings AS tenant_settings
    FROM public.crm_campaigns c
    LEFT JOIN public.email_domains d ON d.id = c.from_email_domain_id
    LEFT JOIN public.tenants t ON t.id = v_effective_tenant_id
    WHERE c.id = p_campaign_id
  ),
  segment_rows AS (
    SELECT DISTINCT s.id, s.name
    FROM public.crm_campaigns c
    JOIN public.crm_segments s ON s.id = c.segment_id
    WHERE c.id = p_campaign_id
    UNION
    SELECT DISTINCT s.id, s.name
    FROM public.campaign_segments cs
    JOIN public.crm_segments s ON s.id = cs.segment_id
    WHERE cs.campaign_id = p_campaign_id
  ),
  recipient_base AS (
    SELECT
      m.id AS recipient_id,
      m.customer_id,
      m.domain_id,
      m.email AS customer_email,
      m.payload,
      m.status AS send_status,
      m.resend_id,
      m.attempts,
      m.sent_at,
      m.last_attempt_at,
      m.error_message,
      m.created_at,
      c.first_name,
      c.last_name,
      c.phone,
      c.total_spent,
      c.lifetime_value,
      c.first_purchase_date,
      c.last_purchase_date,
      c.custom_fields
    FROM public.email_messages m
    LEFT JOIN public.crm_customers c ON c.id = m.customer_id
      AND c.tenant_id = v_effective_tenant_id
      AND CASE WHEN v_customer_read_all THEN true ELSE public.can_read_crm_customer(m.customer_id) END
    WHERE m.campaign_id = p_campaign_id
      AND m.tenant_id = v_effective_tenant_id
  ),
  event_rollup AS (
    SELECT
      LOWER(e.customer_email) AS recipient_email,
      BOOL_OR(e.event_type = 'sent') AS has_sent,
      BOOL_OR(e.event_type = 'delivered') AS has_delivered,
      BOOL_OR(e.event_type IN ('open', 'opened')) AS has_opened,
      BOOL_OR(e.event_type IN ('click', 'clicked')) AS has_clicked,
      BOOL_OR(e.event_type IN ('bounce', 'bounced')) AS has_bounced,
      BOOL_OR(e.event_type IN ('complaint', 'complained')) AS has_complained,
      BOOL_OR(e.event_type = 'unsubscribed') AS has_unsubscribed,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type = 'sent') AS sent_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type = 'delivered') AS delivered_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type IN ('open', 'opened')) AS opened_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type IN ('click', 'clicked')) AS clicked_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type IN ('bounce', 'bounced')) AS bounced_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type IN ('complaint', 'complained')) AS complained_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type = 'unsubscribed') AS unsubscribed_event_at
    FROM public.email_tracking_events e
    WHERE e.campaign_id = p_campaign_id
      AND e.tenant_id = v_effective_tenant_id
    GROUP BY LOWER(e.customer_email)
  ),
  recipient_rows AS (
    SELECT
      rb.recipient_id,
      rb.customer_id,
      rb.domain_id,
      rb.customer_email,
      rb.payload,
      rb.send_status,
      rb.resend_id,
      rb.attempts,
      rb.sent_at,
      rb.last_attempt_at,
      rb.error_message,
      rb.created_at,
      rb.phone,
      rb.total_spent,
      rb.lifetime_value,
      rb.first_purchase_date,
      rb.last_purchase_date,
      rb.custom_fields,
      NULLIF(BTRIM(CONCAT(COALESCE(rb.first_name, ''), ' ', COALESCE(rb.last_name, ''))), '') AS customer_name,
      COALESCE(er.has_sent, false) AS has_sent,
      COALESCE(er.has_delivered, false) AS has_delivered,
      COALESCE(er.has_opened, false) AS has_opened,
      COALESCE(er.has_clicked, false) AS has_clicked,
      COALESCE(er.has_bounced, false) AS has_bounced,
      COALESCE(er.has_complained, false) AS has_complained,
      COALESCE(er.has_unsubscribed, false) AS has_unsubscribed,
      CASE
        WHEN COALESCE(er.has_clicked, false) THEN 'clicked'
        WHEN COALESCE(er.has_opened, false) THEN 'opened'
        WHEN COALESCE(er.has_delivered, false) THEN 'delivered'
        WHEN COALESCE(er.has_sent, false) THEN 'sent'
        WHEN COALESCE(er.has_bounced, false) THEN 'bounced'
        WHEN COALESCE(er.has_complained, false) THEN 'complained'
        WHEN COALESCE(er.has_unsubscribed, false) THEN 'unsubscribed'
        WHEN rb.send_status = 'failed' THEN 'failed'
        WHEN rb.send_status = 'sending' THEN 'sending'
        WHEN rb.send_status = 'queued' THEN 'queued'
        WHEN rb.send_status = 'skipped' THEN 'skipped'
        ELSE 'sent'
      END AS latest_event,
      CASE
        WHEN COALESCE(er.has_clicked, false) THEN er.clicked_event_at
        WHEN COALESCE(er.has_opened, false) THEN er.opened_event_at
        WHEN COALESCE(er.has_delivered, false) THEN er.delivered_event_at
        WHEN COALESCE(er.has_sent, false) THEN er.sent_event_at
        WHEN COALESCE(er.has_bounced, false) THEN er.bounced_event_at
        WHEN COALESCE(er.has_complained, false) THEN er.complained_event_at
        WHEN COALESCE(er.has_unsubscribed, false) THEN er.unsubscribed_event_at
        ELSE COALESCE(rb.sent_at, rb.last_attempt_at, rb.created_at)
      END AS latest_event_at,
      CASE
        WHEN COALESCE(er.has_bounced, false) THEN 'bounced'
        WHEN COALESCE(er.has_complained, false) THEN 'complained'
        WHEN rb.send_status = 'failed' THEN 'failed'
        WHEN COALESCE(er.has_delivered, false) OR COALESCE(er.has_opened, false) OR COALESCE(er.has_clicked, false) THEN 'delivered'
        WHEN rb.send_status = 'sending' THEN 'delayed'
        WHEN COALESCE(er.has_sent, false) OR rb.send_status = 'sent' THEN 'sent'
        WHEN rb.send_status = 'queued' THEN 'queued'
        ELSE 'unknown'
      END AS delivery_status,
      CASE
        WHEN COALESCE(er.has_clicked, false) THEN 7
        WHEN COALESCE(er.has_opened, false) THEN 6
        WHEN COALESCE(er.has_delivered, false) THEN 5
        WHEN COALESCE(er.has_sent, false) THEN 4
        WHEN COALESCE(er.has_bounced, false) THEN 3
        WHEN COALESCE(er.has_complained, false) THEN 2
        WHEN COALESCE(er.has_unsubscribed, false) THEN 1
        WHEN rb.send_status = 'failed' THEN 0
        ELSE 4
      END AS latest_event_rank
    FROM recipient_base rb
    LEFT JOIN event_rollup er ON LOWER(rb.customer_email) = er.recipient_email
  ),
  filtered AS (
    SELECT rr.*
    FROM public.get_campaign_recipient_matches(
      p_campaign_id,
      v_search,
      p_event_filters,
      v_event_filter,
      v_time_range,
      v_delivery_filter,
      NULL
    ) rr
  ),
  ordered_filtered AS (
    SELECT
      f.recipient_id,
      COALESCE(f.customer_name, f.customer_email) AS display_name,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'asc' THEN LOWER(COALESCE(f.customer_name, f.customer_email)) END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'desc' THEN LOWER(COALESCE(f.customer_name, f.customer_email)) END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'asc' THEN LOWER(f.customer_email) END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'desc' THEN LOWER(f.customer_email) END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'asc' THEN f.latest_event_rank END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'desc' THEN f.latest_event_rank END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'asc' THEN f.latest_event_at END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'desc' THEN f.latest_event_at END DESC NULLS LAST,
          f.created_at DESC,
          f.recipient_id ASC
      ) AS list_position,
      COUNT(*) OVER () AS total_filtered_count,
      LAG(f.recipient_id) OVER (
        ORDER BY
          CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'asc' THEN LOWER(COALESCE(f.customer_name, f.customer_email)) END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'desc' THEN LOWER(COALESCE(f.customer_name, f.customer_email)) END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'asc' THEN LOWER(f.customer_email) END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'desc' THEN LOWER(f.customer_email) END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'asc' THEN f.latest_event_rank END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'desc' THEN f.latest_event_rank END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'asc' THEN f.latest_event_at END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'desc' THEN f.latest_event_at END DESC NULLS LAST,
          f.created_at DESC,
          f.recipient_id ASC
      ) AS previous_recipient_id,
      LAG(COALESCE(f.customer_name, f.customer_email)) OVER (
        ORDER BY
          CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'asc' THEN LOWER(COALESCE(f.customer_name, f.customer_email)) END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'desc' THEN LOWER(COALESCE(f.customer_name, f.customer_email)) END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'asc' THEN LOWER(f.customer_email) END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'desc' THEN LOWER(f.customer_email) END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'asc' THEN f.latest_event_rank END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'desc' THEN f.latest_event_rank END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'asc' THEN f.latest_event_at END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'desc' THEN f.latest_event_at END DESC NULLS LAST,
          f.created_at DESC,
          f.recipient_id ASC
      ) AS previous_label,
      LEAD(f.recipient_id) OVER (
        ORDER BY
          CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'asc' THEN LOWER(COALESCE(f.customer_name, f.customer_email)) END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'desc' THEN LOWER(COALESCE(f.customer_name, f.customer_email)) END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'asc' THEN LOWER(f.customer_email) END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'desc' THEN LOWER(f.customer_email) END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'asc' THEN f.latest_event_rank END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'desc' THEN f.latest_event_rank END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'asc' THEN f.latest_event_at END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'desc' THEN f.latest_event_at END DESC NULLS LAST,
          f.created_at DESC,
          f.recipient_id ASC
      ) AS next_recipient_id,
      LEAD(COALESCE(f.customer_name, f.customer_email)) OVER (
        ORDER BY
          CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'asc' THEN LOWER(COALESCE(f.customer_name, f.customer_email)) END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'desc' THEN LOWER(COALESCE(f.customer_name, f.customer_email)) END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'asc' THEN LOWER(f.customer_email) END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'desc' THEN LOWER(f.customer_email) END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'asc' THEN f.latest_event_rank END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'desc' THEN f.latest_event_rank END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'asc' THEN f.latest_event_at END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'desc' THEN f.latest_event_at END DESC NULLS LAST,
          f.created_at DESC,
          f.recipient_id ASC
      ) AS next_label
    FROM filtered f
  ),
  detail_row AS (
    SELECT rr.*
    FROM recipient_rows rr
    WHERE rr.recipient_id = p_recipient_id
  ),
  navigation_row AS (
    SELECT * FROM ordered_filtered WHERE recipient_id = p_recipient_id
  ),
  event_history AS (
    SELECT
      e.id,
      LOWER(e.event_type) AS event_type,
      COALESCE(e.event_ts_provider, e.created_at) AS event_at,
      e.created_at,
      e.provider_message_id,
      e.webhook_delivery_id,
      e.link_id,
      COALESCE(tl.url, e.event_data ->> 'click_link') AS link_url,
      e.user_agent,
      CASE WHEN e.ip_address IS NULL THEN NULL ELSE e.ip_address::TEXT END AS ip_address,
      COALESCE(e.is_mpp_guess, false) AS is_mpp_guess,
      COALESCE(e.event_data, '{}'::jsonb) AS event_data
    FROM public.email_tracking_events e
    JOIN detail_row d ON LOWER(d.customer_email) = LOWER(e.customer_email)
    LEFT JOIN public.tracked_links tl ON tl.id = e.link_id
    WHERE e.campaign_id = p_campaign_id
      AND e.tenant_id = v_effective_tenant_id
  ),
  event_insights AS (
    SELECT
      COUNT(*) FILTER (WHERE event_type IN ('open', 'opened'))::INTEGER AS open_count,
      COUNT(*) FILTER (WHERE event_type IN ('click', 'clicked'))::INTEGER AS click_count,
      COUNT(*) FILTER (WHERE event_type IN ('bounce', 'bounced'))::INTEGER AS bounce_count,
      COUNT(*) FILTER (WHERE event_type IN ('complaint', 'complained'))::INTEGER AS complaint_count,
      BOOL_OR(event_type IN ('open', 'opened')) AS opened,
      BOOL_OR(event_type IN ('click', 'clicked')) AS clicked,
      BOOL_OR(event_type IN ('bounce', 'bounced')) AS bounced,
      BOOL_OR(event_type IN ('complaint', 'complained')) AS complained,
      BOOL_OR(event_type = 'unsubscribed') AS unsubscribed,
      BOOL_OR(event_type IN ('open', 'opened') AND is_mpp_guess) AS has_mpp_open,
      MIN(event_at) FILTER (WHERE event_type IN ('open', 'opened')) AS first_open_at,
      MAX(event_at) FILTER (WHERE event_type IN ('open', 'opened')) AS last_open_at,
      MIN(event_at) FILTER (WHERE event_type IN ('click', 'clicked')) AS first_click_at,
      MAX(event_at) FILTER (WHERE event_type IN ('click', 'clicked')) AS last_click_at
    FROM event_history
  ),
  timeline_entries AS (
    SELECT 'queued'::TEXT AS event_type, d.created_at AS event_at, 'Queued for send'::TEXT AS label, NULL::JSONB AS metadata, 0 AS sort_weight
    FROM detail_row d
    UNION ALL
    SELECT 'attempted'::TEXT AS event_type, d.last_attempt_at AS event_at, 'Latest send attempt'::TEXT AS label, jsonb_build_object('attempts', d.attempts) AS metadata, 1 AS sort_weight
    FROM detail_row d
    WHERE d.last_attempt_at IS NOT NULL
    UNION ALL
    SELECT
      eh.event_type,
      eh.event_at,
      CASE eh.event_type
        WHEN 'sent' THEN 'Sent to provider'
        WHEN 'delivered' THEN 'Delivered'
        WHEN 'open' THEN 'Opened'
        WHEN 'opened' THEN 'Opened'
        WHEN 'click' THEN 'Clicked'
        WHEN 'clicked' THEN 'Clicked'
        WHEN 'bounce' THEN 'Bounced'
        WHEN 'bounced' THEN 'Bounced'
        WHEN 'complaint' THEN 'Complaint'
        WHEN 'complained' THEN 'Complaint'
        WHEN 'unsubscribed' THEN 'Unsubscribed'
        ELSE INITCAP(eh.event_type)
      END AS label,
      jsonb_strip_nulls(jsonb_build_object(
        'provider_message_id', eh.provider_message_id,
        'link_url', eh.link_url,
        'is_mpp_guess', eh.is_mpp_guess,
        'event_data', eh.event_data
      )) AS metadata,
      10 AS sort_weight
    FROM event_history eh
  )
  SELECT jsonb_build_object(
    'campaign', (
      SELECT jsonb_build_object(
        'id', cb.id,
        'name', cb.name,
        'subject_line', cb.subject_line,
        'content', cb.content,
        'status', cb.status,
        'scheduled_at', cb.scheduled_at,
        'sent_at', cb.sent_at,
        'created_at', cb.created_at,
        'tenant_timezone', cb.tenant_settings ->> 'timezone',
        'from_name', COALESCE(cb.sender_display_name, cb.default_from_name, 'BloomSuite'),
        'from_email', COALESCE(cb.actual_sender_email, cb.default_from_email, CASE WHEN cb.domain_name IS NOT NULL THEN 'mail@' || cb.domain_name ELSE NULL END),
        'reply_to', COALESCE(cb.default_reply_to, cb.actual_sender_email, cb.default_from_email, CASE WHEN cb.domain_name IS NOT NULL THEN 'mail@' || cb.domain_name ELSE NULL END),
        'delivery_method', cb.delivery_method,
        'domain_id', cb.from_email_domain_id,
        'domain_name', cb.domain_name,
        'segments', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', sr.id, 'name', sr.name) ORDER BY sr.name) FROM segment_rows sr), '[]'::jsonb)
      )
      FROM campaign_base cb
    ),
    'recipient', (
      SELECT jsonb_build_object(
        'recipient_id', d.recipient_id,
        'customer_id', d.customer_id,
        'customer_name', d.customer_name,
        'customer_email', d.customer_email,
        'phone', d.phone,
        'send_status', d.send_status,
        'latest_event', d.latest_event,
        'latest_event_at', d.latest_event_at,
        'delivery_status', d.delivery_status,
        'sent_at', d.sent_at,
        'last_attempt_at', d.last_attempt_at,
        'created_at', d.created_at,
        'attempts', d.attempts,
        'resend_id', d.resend_id,
        'domain_id', d.domain_id,
        'error_message', d.error_message,
        'has_sent', d.has_sent,
        'has_delivered', d.has_delivered,
        'has_opened', d.has_opened,
        'has_clicked', d.has_clicked,
        'has_bounced', d.has_bounced,
        'has_complained', d.has_complained,
        'has_unsubscribed', d.has_unsubscribed,
        'total_spent', d.total_spent,
        'lifetime_value', d.lifetime_value,
        'first_purchase_date', d.first_purchase_date,
        'last_purchase_date', d.last_purchase_date,
        'custom_fields', COALESCE(d.custom_fields, '{}'::jsonb),
        'payload', COALESCE(d.payload, '{}'::jsonb)
      )
      FROM detail_row d
    ),
    'navigation', (
      SELECT jsonb_build_object(
        'position', nr.list_position,
        'total_filtered_count', nr.total_filtered_count,
        'previous_recipient_id', nr.previous_recipient_id,
        'previous_label', nr.previous_label,
        'next_recipient_id', nr.next_recipient_id,
        'next_label', nr.next_label
      )
      FROM navigation_row nr
    ),
    'insights', (
      SELECT jsonb_build_object(
        'opened', COALESCE(ei.opened, false),
        'clicked', COALESCE(ei.clicked, false),
        'bounced', COALESCE(ei.bounced, false),
        'complained', COALESCE(ei.complained, false),
        'unsubscribed', COALESCE(ei.unsubscribed, false),
        'has_mpp_open', COALESCE(ei.has_mpp_open, false),
        'open_count', COALESCE(ei.open_count, 0),
        'click_count', COALESCE(ei.click_count, 0),
        'bounce_count', COALESCE(ei.bounce_count, 0),
        'complaint_count', COALESCE(ei.complaint_count, 0),
        'first_open_at', ei.first_open_at,
        'last_open_at', ei.last_open_at,
        'first_click_at', ei.first_click_at,
        'last_click_at', ei.last_click_at
      )
      FROM event_insights ei
    ),
    'timeline', COALESCE((
      SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('event_type', te.event_type, 'event_at', te.event_at, 'label', te.label, 'metadata', te.metadata)) ORDER BY te.event_at ASC NULLS LAST, te.sort_weight ASC)
      FROM timeline_entries te
    ), '[]'::jsonb),
    'activity_log', COALESCE((
      SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', eh.id, 'event_type', eh.event_type, 'event_at', eh.event_at, 'provider_message_id', eh.provider_message_id, 'webhook_delivery_id', eh.webhook_delivery_id, 'link_id', eh.link_id, 'link_url', eh.link_url, 'user_agent', eh.user_agent, 'ip_address', eh.ip_address, 'is_mpp_guess', eh.is_mpp_guess, 'event_data', eh.event_data)) ORDER BY eh.event_at DESC NULLS LAST, eh.created_at DESC NULLS LAST)
      FROM event_history eh
    ), '[]'::jsonb),
    'not_found', NOT EXISTS (SELECT 1 FROM detail_row)
  ) INTO result;

  RETURN COALESCE(result, jsonb_build_object('campaign', NULL, 'recipient', NULL, 'navigation', NULL, 'insights', NULL, 'timeline', '[]'::jsonb, 'activity_log', '[]'::jsonb, 'not_found', true));
END;
$function$;

-- =================================================================================================================
-- 5. crm-r2-F183 (definer part): the merge engine counted, recorded and rewrote every row that carried the duplicate's
-- id, whatever tenant the row belonged to. Every count, snapshot, UPDATE and rollback match now leaves alone a row that
-- names another tenant: through its own tenant_id column, or, for a table without one, through the parent row that
-- carries the tenant (automation, campaign, segment, tag, import job, recovery job, BloomSuite POS connection). A row
-- that names no tenant at all (empty tenant or parent, or a table with neither: customer_consents, customer_personas,
-- customer_timeline_events) belongs to the customer alone and still moves with it, as before. The planting itself is
-- closed by the S3 tenant binding (another pack). A pre-fix history that recorded another tenant's rows now fails
-- closed on rollback ("tracked references changed") instead of rewriting that tenant's rows.
CREATE OR REPLACE FUNCTION public.crm_merge_reference_tenant_scope(p_schema text, p_table text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  -- Returns a predicate over alias t in which $2 is the merge's tenant id.
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS a
      WHERE a.attrelid = pg_catalog.to_regclass(pg_catalog.format('%I.%I', p_schema, p_table))
        AND a.attname = 'tenant_id'
        AND a.attnum > 0
        AND NOT a.attisdropped
    ) THEN '(t.tenant_id IS NULL OR t.tenant_id = $2)'
    ELSE coalesce((
      SELECT pg_catalog.format(
        'NOT EXISTS (SELECT 1 FROM %2$I.%3$I AS p WHERE p.%4$I = t.%1$I AND p.%5$I IS NOT NULL AND p.%5$I <> $2)',
        m.child_column, m.parent_schema, m.parent_table, m.parent_key, m.parent_tenant_column)
      FROM (VALUES
        ('public', 'automation_events', 'automation_id', 'public', 'crm_automations', 'id', 'tenant_id'),
        ('public', 'crm_automation_logs', 'automation_id', 'public', 'crm_automations', 'id', 'tenant_id'),
        ('public', 'sms_automation_logs', 'automation_id', 'public', 'sms_automations', 'id', 'tenant_id'),
        ('public', 'crm_email_sends', 'campaign_id', 'public', 'crm_campaigns', 'id', 'tenant_id'),
        ('public', 'customer_segments', 'segment_id', 'public', 'crm_segments', 'id', 'tenant_id'),
        ('public', 'customer_tags', 'tag_id', 'public', 'crm_tags', 'id', 'tenant_id'),
        ('public', 'import_job_items', 'import_job_id', 'public', 'import_jobs', 'id', 'tenant_id'),
        ('intelligence_ops', 'spending_recovery_rows', 'job_id', 'intelligence_ops', 'spending_recovery_jobs', 'id', 'tenant_id'),
        ('bloom_pos_private', 'customer_links', 'key_id', 'bloom_pos_private', 'connections', 'key_id', 'crm_tenant_id'),
        ('bloom_pos_private', 'marketing_requests', 'key_id', 'bloom_pos_private', 'connections', 'key_id', 'crm_tenant_id')
      ) AS m(schema_name, table_name, child_column, parent_schema, parent_table, parent_key, parent_tenant_column)
      WHERE m.schema_name = p_schema
        AND m.table_name = p_table
    ), 'true')
  END;
$$;

REVOKE ALL ON FUNCTION public.crm_merge_reference_tenant_scope(text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.merge_crm_customers(p_tenant_id uuid, p_survivor_customer_id uuid, p_duplicate_customer_id uuid, p_reason text, p_suggestion_id uuid DEFAULT NULL::uuid, p_performed_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_survivor public.crm_customers%ROWTYPE;
  v_duplicate public.crm_customers%ROWTYPE;
  v_history_id uuid := gen_random_uuid();
  v_target record;
  v_pk_expr text;
  v_pk_columns text[];
  v_pk_rows jsonb;
  v_reference_log jsonb := '[]'::jsonb;
  v_discarded_log jsonb := '[]'::jsonb;
  v_discarded_row jsonb;
  v_discarded_batch jsonb;
  v_row_count integer;
  v_total_count integer := 0;
  v_email_blocked boolean;
  v_sms_blocked boolean;
  v_scope text;
BEGIN
  IF p_tenant_id IS NULL
     OR p_survivor_customer_id IS NULL
     OR p_duplicate_customer_id IS NULL
     OR p_survivor_customer_id = p_duplicate_customer_id THEN
    RAISE EXCEPTION 'tenant and two different customer ids are required';
  END IF;

  IF length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 3 AND 1000 THEN
    RAISE EXCEPTION 'merge reason must contain between 3 and 1000 characters';
  END IF;

  -- Serialize both directions of the same pair and lock in deterministic order.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_tenant_id::text || ':crm-merge:' ||
    least(p_survivor_customer_id, p_duplicate_customer_id)::text || ':' ||
    greatest(p_survivor_customer_id, p_duplicate_customer_id)::text,
    0
  ));

  PERFORM 1
  FROM public.crm_customers c
  WHERE c.id IN (p_survivor_customer_id, p_duplicate_customer_id)
  ORDER BY c.id
  FOR UPDATE;

  SELECT * INTO v_survivor
  FROM public.crm_customers
  WHERE id = p_survivor_customer_id;

  SELECT * INTO v_duplicate
  FROM public.crm_customers
  WHERE id = p_duplicate_customer_id;

  IF v_survivor.id IS NULL OR v_duplicate.id IS NULL THEN
    RAISE EXCEPTION 'both customers must exist';
  END IF;
  IF v_survivor.tenant_id <> p_tenant_id OR v_duplicate.tenant_id <> p_tenant_id THEN
    RAISE EXCEPTION 'customers must belong to the requested tenant';
  END IF;
  IF v_survivor.deleted_at IS NOT NULL OR v_survivor.merged_into_customer_id IS NOT NULL THEN
    RAISE EXCEPTION 'survivor must be an active canonical customer';
  END IF;
  IF v_duplicate.deleted_at IS NOT NULL OR v_duplicate.merged_into_customer_id IS NOT NULL THEN
    RAISE EXCEPTION 'duplicate must be an active unmerged customer';
  END IF;

  IF p_suggestion_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.crm_customer_merge_suggestions s
    WHERE s.id = p_suggestion_id
      AND s.tenant_id = p_tenant_id
      AND s.status = 'open'
      AND s.candidate_customer_ids @> ARRAY[p_survivor_customer_id, p_duplicate_customer_id]
  ) THEN
    RAISE EXCEPTION 'open merge suggestion does not contain both customers';
  END IF;

  SELECT
    coalesce(v_survivor.opt_out, false)
      OR coalesce(v_duplicate.opt_out, false)
      OR coalesce(v_survivor.suppressed, false)
      OR coalesce(v_duplicate.suppressed, false)
      OR v_survivor.email_opt_out_at IS NOT NULL
      OR v_duplicate.email_opt_out_at IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM public.customer_consents cc
        WHERE cc.customer_id IN (p_survivor_customer_id, p_duplicate_customer_id)
          AND cc.channel = 'email' AND cc.status IN ('opted_out', 'suppressed')
      ),
    coalesce(v_survivor.opt_out, false)
      OR coalesce(v_duplicate.opt_out, false)
      OR v_survivor.sms_opt_out_at IS NOT NULL
      OR v_duplicate.sms_opt_out_at IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM public.customer_consents cc
        WHERE cc.customer_id IN (p_survivor_customer_id, p_duplicate_customer_id)
          AND cc.channel = 'sms' AND cc.status IN ('opted_out', 'suppressed')
      )
  INTO v_email_blocked, v_sms_blocked;

  INSERT INTO public.crm_customer_merge_history (
    id, tenant_id, survivor_customer_id, duplicate_customer_id,
    suggestion_id, reason, performed_by, survivor_before, duplicate_before
  ) VALUES (
    v_history_id, p_tenant_id, p_survivor_customer_id, p_duplicate_customer_id,
    p_suggestion_id, btrim(p_reason), p_performed_by,
    to_jsonb(v_survivor), to_jsonb(v_duplicate)
  );

  -- Customer creation currently seeds four derived, one-row metric records.
  -- Both profiles therefore collide even when the duplicate record has never
  -- had activity. Archive and remove only a provably inert duplicate row. Any
  -- real metric value is a manual-consolidation blocker, never silent data loss.
  IF EXISTS (
    SELECT 1 FROM public.customer_email_metrics m
    WHERE m.customer_id = p_duplicate_customer_id AND (
      coalesce(m.total_sent, 0) <> 0 OR coalesce(m.total_delivered, 0) <> 0
      OR coalesce(m.total_opened, 0) <> 0 OR coalesce(m.total_clicked, 0) <> 0
      OR coalesce(m.total_bounced, 0) <> 0 OR coalesce(m.hard_bounces, 0) <> 0
      OR coalesce(m.soft_bounces, 0) <> 0 OR coalesce(m.total_unsubscribes, 0) <> 0
      OR coalesce(m.engagement_score, 0) <> 0 OR m.last_sent_at IS NOT NULL
      OR m.last_delivered_at IS NOT NULL OR m.last_opened_at IS NOT NULL
      OR m.last_clicked_at IS NOT NULL OR m.last_bounced_at IS NOT NULL
      OR m.avg_time_to_open_minutes IS NOT NULL OR m.avg_time_to_click_minutes IS NOT NULL
    )
  ) THEN RAISE EXCEPTION 'duplicate has non-empty email metrics; consolidate before merging';
  END IF;

  DELETE FROM public.customer_email_metrics
  WHERE customer_id = p_duplicate_customer_id
  RETURNING to_jsonb(customer_email_metrics) INTO v_discarded_row;
  IF v_discarded_row IS NOT NULL THEN
    v_discarded_log := v_discarded_log || jsonb_build_array(jsonb_build_object(
      'schema', 'public', 'table', 'customer_email_metrics', 'row', v_discarded_row
    ));
  END IF;

  -- Exact duplicate segment membership is one logical relationship. Keep the
  -- survivor's assignment and archive the redundant row for rollback.
  WITH removed AS (
    DELETE FROM public.customer_segments d
    WHERE d.customer_id = p_duplicate_customer_id
      AND EXISTS (
        SELECT 1 FROM public.customer_segments s
        WHERE s.customer_id = p_survivor_customer_id
          AND s.segment_id = d.segment_id
      )
    RETURNING d.*
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'schema', 'public', 'table', 'customer_segments', 'row', to_jsonb(removed)
  )), '[]'::jsonb)
  INTO v_discarded_batch
  FROM removed;
  v_discarded_log := v_discarded_log || v_discarded_batch;

  IF EXISTS (
    SELECT 1 FROM public.customer_sms_metrics m
    WHERE m.customer_id = p_duplicate_customer_id AND (
      coalesce(m.total_sent, 0) <> 0 OR coalesce(m.total_delivered, 0) <> 0
      OR coalesce(m.total_failed, 0) <> 0 OR coalesce(m.total_clicked, 0) <> 0
      OR coalesce(m.total_replied, 0) <> 0 OR coalesce(m.total_opt_outs, 0) <> 0
      OR coalesce(m.engagement_score, 0) <> 0 OR m.last_sent_at IS NOT NULL
      OR m.last_delivered_at IS NOT NULL OR m.last_clicked_at IS NOT NULL
      OR m.last_replied_at IS NOT NULL OR m.last_opt_out_at IS NOT NULL
      OR m.avg_time_to_response_minutes IS NOT NULL
    )
  ) THEN RAISE EXCEPTION 'duplicate has non-empty SMS metrics; consolidate before merging';
  END IF;

  DELETE FROM public.customer_sms_metrics
  WHERE customer_id = p_duplicate_customer_id
  RETURNING to_jsonb(customer_sms_metrics) INTO v_discarded_row;
  IF v_discarded_row IS NOT NULL THEN
    v_discarded_log := v_discarded_log || jsonb_build_array(jsonb_build_object(
      'schema', 'public', 'table', 'customer_sms_metrics', 'row', v_discarded_row
    ));
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.customer_engagement_summary m
    WHERE m.customer_id = p_duplicate_customer_id AND (
      coalesce(m.email_score, 0) <> 0 OR coalesce(m.sms_score, 0) <> 0
      OR coalesce(m.purchase_score, 0) <> 0 OR coalesce(m.overall_engagement_score, 0) <> 0
      OR m.last_engagement_at IS NOT NULL OR coalesce(m.engagement_tier, 'cold') <> 'cold'
    )
  ) THEN RAISE EXCEPTION 'duplicate has non-empty engagement metrics; consolidate before merging';
  END IF;

  DELETE FROM public.customer_engagement_summary
  WHERE customer_id = p_duplicate_customer_id
  RETURNING to_jsonb(customer_engagement_summary) INTO v_discarded_row;
  IF v_discarded_row IS NOT NULL THEN
    v_discarded_log := v_discarded_log || jsonb_build_array(jsonb_build_object(
      'schema', 'public', 'table', 'customer_engagement_summary', 'row', v_discarded_row
    ));
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.customer_identity_metrics m
    WHERE m.customer_id = p_duplicate_customer_id AND (
      m.store_id IS NOT NULL OR m.store_name IS NOT NULL OR m.city IS NOT NULL
      OR m.state_region IS NOT NULL OR m.postal_code IS NOT NULL
      OR m.lat IS NOT NULL OR m.lon IS NOT NULL OR m.signup_source IS NOT NULL
      OR m.signup_campaign IS NOT NULL OR m.signup_referrer_id IS NOT NULL
      OR coalesce(m.timezone, 'America/New_York') <> 'America/New_York'
      OR coalesce(m.country_code, 'US') <> 'US'
      OR coalesce(m.preferred_channel, 'none') <> 'none'
    )
  ) THEN RAISE EXCEPTION 'duplicate has non-empty identity metrics; consolidate before merging';
  END IF;

  DELETE FROM public.customer_identity_metrics
  WHERE customer_id = p_duplicate_customer_id
  RETURNING to_jsonb(customer_identity_metrics) INTO v_discarded_row;
  IF v_discarded_row IS NOT NULL THEN
    v_discarded_log := v_discarded_log || jsonb_build_array(jsonb_build_object(
      'schema', 'public', 'table', 'customer_identity_metrics', 'row', v_discarded_row
    ));
  END IF;

  -- Discover every real FK plus the explicitly-audited legacy UUID references.
  -- The history table is excluded so prior merge audit records remain immutable.
  FOR v_target IN
    WITH fk_targets AS (
      SELECT DISTINCT n.nspname AS schema_name, c.relname AS table_name,
        a.attname AS column_name, c.oid AS relid
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN unnest(con.conkey) k(attnum) ON true
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
      WHERE con.contype = 'f'
        AND con.confrelid = 'public.crm_customers'::regclass
        AND c.relname <> 'crm_customer_merge_history'
    ), legacy_targets(schema_name, table_name, column_name) AS (
      VALUES
        ('public', 'analytics_events', 'contact_id'),
        ('public', 'campaign_attribution', 'contact_id'),
        ('public', 'crm_automation_logs', 'customer_id'),
        ('public', 'crm_outbox', 'customer_id'),
        ('public', 'crm_subscriptions', 'customer_id'),
        ('public', 'email_governance_email_events', 'customer_id'),
        ('public', 'import_job_items', 'mapped_customer_id')
    )
    SELECT schema_name, table_name, column_name, relid
    FROM fk_targets
    UNION
    SELECT l.schema_name, l.table_name, l.column_name, c.oid
    FROM legacy_targets l
    JOIN pg_namespace n ON n.nspname = l.schema_name
    JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = l.table_name
    JOIN pg_attribute a ON a.attrelid = c.oid
      AND a.attname = l.column_name AND NOT a.attisdropped
    ORDER BY 1, 2, 3
  LOOP
    -- central-login 59 (crm-r2-F183): rows naming another tenant are never counted, recorded or moved.
    v_scope := public.crm_merge_reference_tenant_scope(v_target.schema_name, v_target.table_name);
    EXECUTE format(
      'SELECT count(*) FROM %I.%I t WHERE t.%I = $1 AND %s',
      v_target.schema_name, v_target.table_name, v_target.column_name, v_scope
    ) INTO v_row_count USING p_duplicate_customer_id, p_tenant_id;

    CONTINUE WHEN v_row_count = 0;

    SELECT array_agg(a.attname ORDER BY key_column.ordinality),
      string_agg(format('%L, t.%I', a.attname, a.attname), ', ' ORDER BY key_column.ordinality)
    INTO v_pk_columns, v_pk_expr
    FROM pg_index i
    JOIN unnest(i.indkey::smallint[]) WITH ORDINALITY key_column(attnum, ordinality) ON true
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = key_column.attnum
    WHERE i.indrelid = v_target.relid AND i.indisprimary;

    IF v_pk_columns IS NULL THEN
      RAISE EXCEPTION 'cannot safely merge %.%: referenced rows have no primary key',
        v_target.table_name, v_target.column_name;
    END IF;

    EXECUTE format(
      'SELECT coalesce(jsonb_agg(jsonb_build_object(%s)), ''[]''::jsonb) '
      'FROM %I.%I t WHERE t.%I = $1 AND %s',
      v_pk_expr, v_target.schema_name, v_target.table_name, v_target.column_name, v_scope
    ) INTO v_pk_rows USING p_duplicate_customer_id, p_tenant_id;

    IF jsonb_array_length(v_pk_rows) <> v_row_count THEN
      RAISE EXCEPTION 'reference snapshot mismatch for %.%',
        v_target.table_name, v_target.column_name;
    END IF;

    v_reference_log := v_reference_log || jsonb_build_array(jsonb_build_object(
      'schema', v_target.schema_name,
      'table', v_target.table_name,
      'column', v_target.column_name,
      'primary_key_columns', to_jsonb(v_pk_columns),
      'rows', v_pk_rows
    ));
    v_total_count := v_total_count + v_row_count;

    IF v_total_count > 100000 THEN
      RAISE EXCEPTION 'merge exceeds the 100000-reference safety limit';
    END IF;

    -- A uniqueness violation intentionally aborts and rolls back the whole merge.
    EXECUTE format(
      'UPDATE %I.%I t SET %I = $3 WHERE t.%I = $1 AND %s',
      v_target.schema_name, v_target.table_name, v_target.column_name,
      v_target.column_name, v_scope
    ) USING p_duplicate_customer_id, p_tenant_id, p_survivor_customer_id;
  END LOOP;

  UPDATE public.crm_customers s
  SET first_name = coalesce(nullif(s.first_name, ''), nullif(v_duplicate.first_name, '')),
      last_name = coalesce(nullif(s.last_name, ''), nullif(v_duplicate.last_name, '')),
      phone = coalesce(nullif(s.phone, ''), nullif(v_duplicate.phone, '')),
      user_id = coalesce(s.user_id, v_duplicate.user_id),
      tags = ARRAY(
        SELECT DISTINCT value FROM unnest(
          coalesce(s.tags, '{}'::text[]) || coalesce(v_duplicate.tags, '{}'::text[])
        ) value WHERE value IS NOT NULL AND value <> ''
      ),
      product_tags = ARRAY(
        SELECT DISTINCT value FROM unnest(
          coalesce(s.product_tags, '{}'::text[]) || coalesce(v_duplicate.product_tags, '{}'::text[])
        ) value WHERE value IS NOT NULL AND value <> ''
      ),
      custom_fields = coalesce(v_duplicate.custom_fields, '{}'::jsonb)
        || coalesce(s.custom_fields, '{}'::jsonb),
      order_history = (
        SELECT coalesce(jsonb_agg(DISTINCT value), '[]'::jsonb)
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(s.order_history) = 'array' THEN s.order_history ELSE '[]'::jsonb END
          || CASE WHEN jsonb_typeof(v_duplicate.order_history) = 'array' THEN v_duplicate.order_history ELSE '[]'::jsonb END
        ) value
      ),
      persona = coalesce(nullif(s.persona, ''), nullif(v_duplicate.persona, '')),
      persona_id = coalesce(s.persona_id, v_duplicate.persona_id),
      store_id = coalesce(nullif(s.store_id, ''), nullif(v_duplicate.store_id, '')),
      store_name = coalesce(nullif(s.store_name, ''), nullif(v_duplicate.store_name, '')),
      city = coalesce(nullif(s.city, ''), nullif(v_duplicate.city, '')),
      state_region = coalesce(nullif(s.state_region, ''), nullif(v_duplicate.state_region, '')),
      postal_code = coalesce(nullif(s.postal_code, ''), nullif(v_duplicate.postal_code, '')),
      lat = coalesce(s.lat, v_duplicate.lat),
      lon = coalesce(s.lon, v_duplicate.lon),
      signup_source = coalesce(nullif(s.signup_source, ''), nullif(v_duplicate.signup_source, '')),
      signup_campaign = coalesce(nullif(s.signup_campaign, ''), nullif(v_duplicate.signup_campaign, '')),
      signup_referrer_id = coalesce(s.signup_referrer_id, v_duplicate.signup_referrer_id),
      first_purchase_date = least(s.first_purchase_date, v_duplicate.first_purchase_date),
      last_purchase_date = greatest(s.last_purchase_date, v_duplicate.last_purchase_date),
      last_visit_date = greatest(s.last_visit_date, v_duplicate.last_visit_date),
      lifetime_value = greatest(coalesce(s.lifetime_value, 0), coalesce(v_duplicate.lifetime_value, 0)),
      total_spent = greatest(coalesce(s.total_spent, 0), coalesce(v_duplicate.total_spent, 0)),
      pos_total_spent = greatest(coalesce(s.pos_total_spent, 0), coalesce(v_duplicate.pos_total_spent, 0)),
      pos_order_count = greatest(coalesce(s.pos_order_count, 0), coalesce(v_duplicate.pos_order_count, 0)),
      loyalty_member = coalesce(s.loyalty_member, false) OR coalesce(v_duplicate.loyalty_member, false),
      loyalty_rewards_balance = greatest(
        coalesce(s.loyalty_rewards_balance, 0), coalesce(v_duplicate.loyalty_rewards_balance, 0)
      ),
      is_vip = coalesce(s.is_vip, false) OR coalesce(v_duplicate.is_vip, false),
      opt_out = coalesce(s.opt_out, false) OR coalesce(v_duplicate.opt_out, false),
      suppressed = coalesce(s.suppressed, false) OR coalesce(v_duplicate.suppressed, false),
      suppressed_at = CASE WHEN coalesce(s.suppressed, false) OR coalesce(v_duplicate.suppressed, false)
        THEN coalesce(greatest(s.suppressed_at, v_duplicate.suppressed_at), now()) ELSE NULL END,
      suppressed_reason = CASE WHEN coalesce(s.suppressed, false) OR coalesce(v_duplicate.suppressed, false)
        THEN coalesce(s.suppressed_reason, v_duplicate.suppressed_reason, 'merged_consent_safety') ELSE NULL END,
      email_opt_in = (coalesce(s.email_opt_in, false) OR coalesce(v_duplicate.email_opt_in, false))
        AND NOT v_email_blocked,
      sms_opt_in = (coalesce(s.sms_opt_in, false) OR coalesce(v_duplicate.sms_opt_in, false))
        AND NOT v_sms_blocked,
      email_opt_in_at = greatest(s.email_opt_in_at, v_duplicate.email_opt_in_at),
      sms_opt_in_at = greatest(s.sms_opt_in_at, v_duplicate.sms_opt_in_at),
      email_consent_source = coalesce(s.email_consent_source, v_duplicate.email_consent_source),
      email_consent_ip = coalesce(s.email_consent_ip, v_duplicate.email_consent_ip),
      email_consent_method = coalesce(s.email_consent_method, v_duplicate.email_consent_method),
      email_consent_details = coalesce(s.email_consent_details, v_duplicate.email_consent_details),
      sms_consent_source = coalesce(s.sms_consent_source, v_duplicate.sms_consent_source),
      sms_consent_ip = coalesce(s.sms_consent_ip, v_duplicate.sms_consent_ip),
      sms_consent_method = coalesce(s.sms_consent_method, v_duplicate.sms_consent_method),
      sms_consent_details = coalesce(s.sms_consent_details, v_duplicate.sms_consent_details),
      email_opt_out_at = greatest(s.email_opt_out_at, v_duplicate.email_opt_out_at),
      sms_opt_out_at = greatest(s.sms_opt_out_at, v_duplicate.sms_opt_out_at),
      email_consent = CASE
        WHEN v_email_blocked THEN false
        WHEN coalesce(s.email_consent, false) OR coalesce(v_duplicate.email_consent, false) THEN true
        ELSE NULL END,
      sms_consent = CASE
        WHEN v_sms_blocked THEN false
        WHEN coalesce(s.sms_consent, false) OR coalesce(v_duplicate.sms_consent, false) THEN true
        ELSE NULL END,
      last_open_at = greatest(s.last_open_at, v_duplicate.last_open_at),
      last_email_sent_at = greatest(s.last_email_sent_at, v_duplicate.last_email_sent_at),
      last_email_delivered_at = greatest(s.last_email_delivered_at, v_duplicate.last_email_delivered_at),
      last_email_clicked_at = greatest(s.last_email_clicked_at, v_duplicate.last_email_clicked_at),
      last_email_bounced_at = greatest(s.last_email_bounced_at, v_duplicate.last_email_bounced_at),
      total_emails_sent = greatest(coalesce(s.total_emails_sent, 0), coalesce(v_duplicate.total_emails_sent, 0)),
      total_emails_delivered = greatest(coalesce(s.total_emails_delivered, 0), coalesce(v_duplicate.total_emails_delivered, 0)),
      total_emails_opened = greatest(coalesce(s.total_emails_opened, 0), coalesce(v_duplicate.total_emails_opened, 0)),
      total_emails_clicked = greatest(coalesce(s.total_emails_clicked, 0), coalesce(v_duplicate.total_emails_clicked, 0)),
      total_emails_bounced = greatest(coalesce(s.total_emails_bounced, 0), coalesce(v_duplicate.total_emails_bounced, 0)),
      total_soft_bounces = greatest(coalesce(s.total_soft_bounces, 0), coalesce(v_duplicate.total_soft_bounces, 0)),
      total_hard_bounces = greatest(coalesce(s.total_hard_bounces, 0), coalesce(v_duplicate.total_hard_bounces, 0)),
      total_unsubscribes = greatest(coalesce(s.total_unsubscribes, 0), coalesce(v_duplicate.total_unsubscribes, 0)),
      updated_at = now()
  WHERE s.id = p_survivor_customer_id;

  UPDATE public.crm_customers
  SET merged_into_customer_id = p_survivor_customer_id,
      deleted_at = now(),
      opt_out = true,
      email_opt_in = false,
      sms_opt_in = false,
      suppressed = true,
      suppressed_at = now(),
      suppressed_reason = 'merged_duplicate',
      updated_at = now()
  WHERE id = p_duplicate_customer_id;

  UPDATE public.crm_customer_merge_history
  SET moved_references = v_reference_log,
      moved_reference_count = v_total_count,
      removed_duplicate_rows = v_discarded_log,
      removed_duplicate_row_count = jsonb_array_length(v_discarded_log)
  WHERE id = v_history_id;

  IF p_suggestion_id IS NOT NULL THEN
    UPDATE public.crm_customer_merge_suggestions
    SET status = 'merged',
        resolution = jsonb_build_object(
          'history_id', v_history_id,
          'survivor_customer_id', p_survivor_customer_id,
          'duplicate_customer_id', p_duplicate_customer_id,
          'reason', btrim(p_reason)
        ),
        resolved_by = p_performed_by,
        resolved_at = now(),
        updated_at = now()
    WHERE id = p_suggestion_id;
  END IF;

  RETURN jsonb_build_object(
    'history_id', v_history_id,
    'survivor_customer_id', p_survivor_customer_id,
    'duplicate_customer_id', p_duplicate_customer_id,
    'moved_reference_count', v_total_count,
    'status', 'applied'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rollback_crm_customer_merge(p_history_id uuid, p_reason text, p_performed_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_history public.crm_customer_merge_history%ROWTYPE;
  v_reference jsonb;
  v_discarded jsonb;
  v_pk jsonb;
  v_pk_column text;
  v_where text;
  v_set_clause text;
  v_updated integer;
  v_changed integer;
  v_expected integer;
  v_rolled_back integer := 0;
  v_scope text;
BEGIN
  IF length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 3 AND 1000 THEN
    RAISE EXCEPTION 'rollback reason must contain between 3 and 1000 characters';
  END IF;

  SELECT * INTO v_history
  FROM public.crm_customer_merge_history
  WHERE id = p_history_id
  FOR UPDATE;

  IF v_history.id IS NULL THEN
    RAISE EXCEPTION 'merge history not found';
  END IF;
  IF v_history.status <> 'applied' THEN
    RAISE EXCEPTION 'only an applied merge can be rolled back';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_history.tenant_id::text || ':crm-merge:' ||
    least(v_history.survivor_customer_id, v_history.duplicate_customer_id)::text || ':' ||
    greatest(v_history.survivor_customer_id, v_history.duplicate_customer_id)::text,
    0
  ));

  PERFORM 1 FROM public.crm_customers
  WHERE id IN (v_history.survivor_customer_id, v_history.duplicate_customer_id)
  ORDER BY id FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1 FROM public.crm_customers
    WHERE id = v_history.duplicate_customer_id
      AND merged_into_customer_id = v_history.survivor_customer_id
      AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'duplicate alias no longer matches this merge';
  END IF;

  -- Restore customer rows first so both valid FK targets are active again.
  SELECT string_agg(format('%I = r.%I', a.attname, a.attname), ', ' ORDER BY a.attnum)
  INTO v_set_clause
  FROM pg_attribute a
  WHERE a.attrelid = 'public.crm_customers'::regclass
    AND a.attnum > 0 AND NOT a.attisdropped AND a.attname <> 'id';

  EXECUTE format(
    'UPDATE public.crm_customers c SET %s '
    'FROM jsonb_populate_record(NULL::public.crm_customers, $1) r WHERE c.id = $2',
    v_set_clause
  ) USING v_history.duplicate_before, v_history.duplicate_customer_id;

  -- Recreate the exact inert derived rows removed to avoid unique collisions.
  FOR v_discarded IN SELECT value FROM jsonb_array_elements(v_history.removed_duplicate_rows)
  LOOP
    EXECUTE format(
      'INSERT INTO %I.%I SELECT * FROM jsonb_populate_record(NULL::%I.%I, $1)',
      v_discarded->>'schema', v_discarded->>'table',
      v_discarded->>'schema', v_discarded->>'table'
    ) USING v_discarded->'row';
  END LOOP;

  -- A changed/deleted tracked row aborts rollback rather than producing a split identity.
  FOR v_reference IN SELECT value FROM jsonb_array_elements(v_history.moved_references)
  LOOP
    v_expected := jsonb_array_length(v_reference->'rows');
    v_updated := 0;
    -- central-login 59 (crm-r2-F183): rows naming another tenant are never moved back.
    v_scope := public.crm_merge_reference_tenant_scope(v_reference->>'schema', v_reference->>'table');

    FOR v_pk IN SELECT value FROM jsonb_array_elements(v_reference->'rows')
    LOOP
      v_where := '';
      FOR v_pk_column IN SELECT jsonb_array_elements_text(v_reference->'primary_key_columns')
      LOOP
        v_where := v_where || CASE WHEN v_where = '' THEN '' ELSE ' AND ' END ||
          format('to_jsonb(t.%I) = $3->%L', v_pk_column, v_pk_column);
      END LOOP;

      EXECUTE format(
        'UPDATE %I.%I t SET %I = $4 WHERE t.%I = $1 AND %s AND %s',
        v_reference->>'schema', v_reference->>'table', v_reference->>'column',
        v_reference->>'column', v_scope, v_where
      ) USING v_history.survivor_customer_id, v_history.tenant_id, v_pk, v_history.duplicate_customer_id;

      GET DIAGNOSTICS v_changed = ROW_COUNT;
      v_updated := v_updated + v_changed;
    END LOOP;

    IF v_updated <> v_expected THEN
      RAISE EXCEPTION 'rollback blocked: tracked references changed in %.%',
        v_reference->>'table', v_reference->>'column';
    END IF;
    v_rolled_back := v_rolled_back + v_updated;
  END LOOP;

  EXECUTE format(
    'UPDATE public.crm_customers c SET %s '
    'FROM jsonb_populate_record(NULL::public.crm_customers, $1) r WHERE c.id = $2',
    v_set_clause
  ) USING v_history.survivor_before, v_history.survivor_customer_id;

  IF v_history.suggestion_id IS NOT NULL THEN
    UPDATE public.crm_customer_merge_suggestions
    SET status = 'open', resolution = NULL, resolved_by = NULL,
        resolved_at = NULL, updated_at = now()
    WHERE id = v_history.suggestion_id
      AND status = 'merged'
      AND resolution->>'history_id' = p_history_id::text;
  END IF;

  UPDATE public.crm_customer_merge_history
  SET status = 'rolled_back', rolled_back_at = now(),
      rolled_back_by = p_performed_by, rollback_reason = btrim(p_reason)
  WHERE id = p_history_id;

  RETURN jsonb_build_object(
    'history_id', p_history_id,
    'restored_reference_count', v_rolled_back,
    'status', 'rolled_back'
  );
END;
$function$;

-- =================================================================================================================
-- 6. crm-r2-F191 (definer part) and crm-r2-F181 (defence in depth).
-- accept_bloomsuite_pos_before_marketing: the CustomerChanged projection stamps the CRM customer only on orders of the
-- mapped business (tenant_id = the connection's CRM tenant), never on another tenant's row naming the bridge
-- connection. assign_pos_order_location: a 'bloomsuite' connection now resolves (provider 'other', as the bridge
-- writes), so another tenant can no longer insert an order on it unchecked, and the bridge's own SaleCompleted insert,
-- refused today with 23503 'POS order connection is not registered', lands again. compute_pos_order_revenue_attribution:
-- an order whose own tenant differs from its connection's tenant is unresolved (no campaign credit).
-- auto_resolve_pos_customer_identity: a browser-role write to pos_customers may only create or change contacts where
-- the caller holds customer.write (the service-role POS import is unaffected; F132/F181's table policy is another
-- pack's change).

CREATE OR REPLACE FUNCTION public.accept_bloomsuite_pos_before_marketing(p_key text, p_envelope jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 c bloom_pos_private.connections; prior bloom_pos_private.inbox;
 sale_row bloom_pos_private.inbox; existing_return bloom_pos_private.return_events;
 eid uuid; rev bigint; kind text; rid text; subject text; data jsonb;
 occurred timestamptz; customer uuid; linked uuid; target uuid; old_link uuid;
 sale_id text; return_id text; cents bigint; refund_cents bigint; refunded_at_value timestamptz;
 payload_currency text; order_id uuid; sale_customer uuid; sale_data jsonb; order_status text;
 stale boolean:=false;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Connection service required' USING ERRCODE='42501';
 END IF;
 SELECT b.* INTO c FROM bloom_pos_private.connections b
 JOIN public.pos_connections pc ON pc.id=b.pos_connection_id
 WHERE b.key_id=p_key AND b.enabled AND b.currency IS NOT NULL
  AND pc.tenant_id=b.crm_tenant_id AND pc.is_active
  AND pc.platform='bloomsuite' AND pc.settings->>'provider'='bloomsuite_pos' FOR SHARE OF b,pc;
 IF NOT FOUND THEN RAISE EXCEPTION 'Connection unavailable or tenant mapping is invalid'; END IF;
 IF jsonb_typeof(p_envelope) IS DISTINCT FROM 'object'
  OR p_envelope->>'tenantId' IS DISTINCT FROM c.pos_tenant_id::text
  OR p_envelope->>'source' IS DISTINCT FROM 'POS'
  OR p_envelope->'version' IS DISTINCT FROM '1'::jsonb
  OR jsonb_typeof(p_envelope->'data') IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_envelope->'revision') IS DISTINCT FROM 'number'
 THEN RAISE EXCEPTION 'Invalid BloomSuite POS event scope'; END IF;
 eid:=(p_envelope->>'id')::uuid;
 rev:=bloom_pos_private.event_integer(p_envelope->'revision',1,'Invalid BloomSuite POS event revision');
 kind:=p_envelope->>'type';rid:=p_envelope->>'recordId';
 occurred:=(p_envelope->>'occurredAt')::timestamptz;
 IF eid IS NULL OR coalesce(length(rid),0) NOT BETWEEN 1 AND 200 OR occurred IS NULL OR NOT isfinite(occurred)
  OR kind IS NULL OR kind NOT IN ('SaleCompleted','ReturnCompleted','VoidCompleted','StockMoved',
   'CataloguePriceChanged','CustomerChanged','VariantStockMoved','ReservationChanged',
   'CustomerIdentityLinked','ConsentAuthorityConfigured','CustomerConsentEvidenceReceived',
   'CataloguePhotosChanged','WebOrderFulfillmentChanged')
 THEN RAISE EXCEPTION 'Invalid BloomSuite POS event'; END IF;
 data:=p_envelope->'data';
 IF data ? 'payload' THEN
  IF kind NOT IN ('SaleCompleted','ReturnCompleted','VoidCompleted','StockMoved')
   OR jsonb_typeof(data->'payload') IS DISTINCT FROM 'object'
   OR data->>'type' IS DISTINCT FROM kind OR data->>'tenantId' IS DISTINCT FROM c.pos_tenant_id::text
   OR data->'version' IS DISTINCT FROM '1'::jsonb OR (data->>'id')::uuid IS NULL
  THEN RAISE EXCEPTION 'Invalid original POS event scope'; END IF;
  occurred:=(data->>'occurredAt')::timestamptz;
  IF occurred IS NULL OR NOT isfinite(occurred) THEN RAISE EXCEPTION 'Invalid original POS event time'; END IF;
  data:=data->'payload';
 END IF;
 subject:=CASE WHEN kind='ReturnCompleted' THEN data->>'originalSaleId'
  WHEN kind IN ('SaleCompleted','VoidCompleted') THEN data->>'saleId'
  WHEN kind IN ('CustomerChanged','CustomerIdentityLinked') THEN data->>'customerId' ELSE rid END;
 IF coalesce(length(subject),0) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Event subject required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('bloomsuite-crm:'||p_key,0));
 SELECT * INTO prior FROM bloom_pos_private.inbox
 WHERE event_id=eid OR (key_id=p_key AND event_type=kind AND record_id=rid AND revision=rev) LIMIT 1;
 IF FOUND THEN
  IF prior.key_id<>p_key OR prior.envelope IS DISTINCT FROM p_envelope THEN RAISE EXCEPTION 'BloomSuite POS retry changed'; END IF;
  RETURN jsonb_build_object('accepted',true,'eventId',eid,'duplicate',true);
 END IF;

 IF kind IN ('SaleCompleted','ReturnCompleted','VoidCompleted') THEN
  sale_id:=subject;
  IF kind='SaleCompleted' THEN
   IF jsonb_typeof(data->'lineItems') IS DISTINCT FROM 'array'
    OR jsonb_typeof(data->'tenders') IS DISTINCT FROM 'array'
    OR jsonb_typeof(data->'totalCents') IS DISTINCT FROM 'number'
    OR jsonb_array_length(data->'lineItems') NOT BETWEEN 1 AND 100
    OR jsonb_array_length(data->'tenders') NOT BETWEEN 1 AND 100
   THEN RAISE EXCEPTION 'Invalid POS sale'; END IF;
   cents:=bloom_pos_private.event_integer(data->'totalCents',0,'Invalid POS sale money');
   payload_currency:=coalesce(data->>'currency',c.currency);
   IF payload_currency IS DISTINCT FROM c.currency THEN RAISE EXCEPTION 'POS currency differs from mapped business'; END IF;
   customer:=NULLIF(data->>'customerId','')::uuid;
   SELECT * INTO prior FROM bloom_pos_private.inbox
    WHERE key_id=p_key AND event_type=kind AND subject_id=subject ORDER BY revision DESC LIMIT 1;
   IF FOUND AND bloom_pos_private.event_data(prior.envelope) IS DISTINCT FROM data THEN
    RAISE EXCEPTION 'A completed sale cannot be replaced by a different sale payload';
   END IF;
  ELSIF kind='ReturnCompleted' THEN
   return_id:=data->>'returnSaleId';
   IF coalesce(length(return_id),0) NOT BETWEEN 1 AND 200 OR return_id=subject
    OR jsonb_typeof(data->'returnAmountCents') IS DISTINCT FROM 'number'
   THEN RAISE EXCEPTION 'Invalid POS return'; END IF;
   cents:=bloom_pos_private.event_integer(data->'returnAmountCents',0,'Invalid POS return money');
   SELECT * INTO existing_return FROM bloom_pos_private.return_events WHERE key_id=p_key AND return_sale_id=return_id;
   IF FOUND AND (existing_return.original_sale_id<>subject OR existing_return.amount_cents<>cents
    OR (SELECT bloom_pos_private.event_data(envelope) FROM bloom_pos_private.inbox WHERE event_id=existing_return.event_id) IS DISTINCT FROM data)
   THEN RAISE EXCEPTION 'A completed return cannot be replaced by a different return payload'; END IF;
  END IF;
 END IF;
 INSERT INTO bloom_pos_private.inbox(event_id,key_id,event_type,record_id,revision,envelope,subject_id)
 VALUES(eid,p_key,kind,rid,rev,p_envelope,subject);

 IF kind IN ('CustomerChanged','CustomerIdentityLinked') THEN
  customer:=subject::uuid;
  SELECT EXISTS(SELECT 1 FROM bloom_pos_private.inbox WHERE key_id=p_key
   AND event_type=kind AND subject_id=subject AND revision>rev) INTO stale;
  IF NOT stale THEN
   linked:=CASE WHEN kind='CustomerChanged' THEN NULLIF(data->>'sharedProfileId','')::uuid
    WHEN data->>'externalSource'='CRM' THEN NULLIF(data->>'externalCustomerId','')::uuid ELSE NULL END;
   IF kind='CustomerChanged' AND NULLIF(data->>'mergedIntoCustomerId','') IS NOT NULL THEN
    target:=(data->>'mergedIntoCustomerId')::uuid;
    SELECT crm_customer_id INTO old_link FROM bloom_pos_private.customer_links WHERE key_id=p_key AND pos_customer_id=customer;
    SELECT crm_customer_id INTO linked FROM bloom_pos_private.customer_links WHERE key_id=p_key AND pos_customer_id=target;
    IF linked IS NULL OR old_link IS DISTINCT FROM linked THEN RAISE EXCEPTION 'Customer merge requires a reviewed matching CRM identity'; END IF;
   END IF;
   IF linked IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM public.pos_orders WHERE tenant_id=c.crm_tenant_id AND crm_customer_id=linked AND currency IS DISTINCT FROM c.currency) THEN
     RAISE EXCEPTION 'Customer purchase currencies require review before linking';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.crm_customers cc WHERE cc.id=linked AND cc.tenant_id=c.crm_tenant_id
     AND cc.deleted_at IS NULL AND cc.merged_into_customer_id IS NULL)
    THEN RAISE EXCEPTION 'Shared CRM customer is not active in the mapped business'; END IF;
    SELECT crm_customer_id INTO old_link FROM bloom_pos_private.customer_links WHERE key_id=p_key AND pos_customer_id=customer;
    IF old_link IS NOT NULL AND old_link<>linked THEN RAISE EXCEPTION 'Existing customer link conflicts; review required'; END IF;
    INSERT INTO bloom_pos_private.customer_links(key_id,pos_customer_id,crm_customer_id,source_event_id) VALUES(p_key,customer,linked,eid)
    ON CONFLICT(key_id,pos_customer_id) DO UPDATE SET source_event_id=excluded.source_event_id;
    UPDATE public.pos_orders SET crm_customer_id=linked,customer_resolution_status='linked',customer_resolution_reason=NULL,
     updated_at=clock_timestamp() WHERE pos_connection_id=c.pos_connection_id AND tenant_id=c.crm_tenant_id
     AND external_customer_id=customer::text; -- central-login 59 (crm-r2-F191): only the mapped business's orders
    PERFORM public.recalculate_purchase_metrics(linked);
   END IF;
  END IF;
 ELSIF kind IN ('SaleCompleted','ReturnCompleted','VoidCompleted') THEN
  IF kind='ReturnCompleted' THEN
   INSERT INTO bloom_pos_private.return_events(event_id,key_id,original_sale_id,return_sale_id,amount_cents,occurred_at)
    VALUES(eid,p_key,subject,return_id,cents,occurred) ON CONFLICT(key_id,return_sale_id) DO NOTHING;
  END IF;
  SELECT * INTO sale_row FROM bloom_pos_private.inbox WHERE key_id=p_key AND event_type='SaleCompleted' AND subject_id=sale_id ORDER BY revision LIMIT 1;
  IF FOUND THEN
   sale_data:=bloom_pos_private.event_data(sale_row.envelope);
   sale_customer:=NULLIF(sale_data->>'customerId','')::uuid;
   SELECT coalesce(sum(amount_cents),0),max(occurred_at) INTO refund_cents,refunded_at_value FROM bloom_pos_private.return_events WHERE key_id=p_key AND original_sale_id=sale_id;
   order_status:=CASE WHEN EXISTS(SELECT 1 FROM bloom_pos_private.inbox WHERE key_id=p_key AND event_type='VoidCompleted' AND subject_id=sale_id) THEN 'voided'
    WHEN refund_cents>0 AND refund_cents>=bloom_pos_private.event_integer(sale_data->'totalCents',0,'Invalid POS sale money') THEN 'refunded' ELSE 'completed' END;
   INSERT INTO public.pos_orders(pos_connection_id,external_id,external_customer_id,order_date,total_amount,currency,status,items,raw_data,tenant_id,provider,refund_amount,refunded_at)
   VALUES(c.pos_connection_id,sale_id,sale_customer::text,bloom_pos_private.event_time(sale_row.envelope),(sale_data->>'totalCents')::numeric/100,
     coalesce(sale_data->>'currency',c.currency),order_status,sale_data->'lineItems',sale_row.envelope,c.crm_tenant_id,'other',refund_cents::numeric/100,refunded_at_value)
   ON CONFLICT(pos_connection_id,external_id) DO UPDATE SET status=excluded.status,refund_amount=excluded.refund_amount,refunded_at=excluded.refunded_at,updated_at=clock_timestamp()
   RETURNING id INTO order_id;
   SELECT l.crm_customer_id INTO linked FROM bloom_pos_private.customer_links l JOIN public.crm_customers cc ON cc.id=l.crm_customer_id AND cc.tenant_id=c.crm_tenant_id
    WHERE l.key_id=p_key AND l.pos_customer_id=sale_customer AND cc.deleted_at IS NULL AND cc.merged_into_customer_id IS NULL;
   UPDATE public.pos_orders SET crm_customer_id=linked,
    customer_resolution_status=CASE WHEN linked IS NOT NULL THEN 'linked' WHEN sale_customer IS NULL THEN 'missing_identity' ELSE 'unmatched' END,
    customer_resolution_reason=CASE WHEN linked IS NULL THEN 'Awaiting a verified BloomSuite POS customer link' ELSE NULL END WHERE id=order_id;
   IF linked IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM public.pos_orders WHERE tenant_id=c.crm_tenant_id AND crm_customer_id=linked AND currency IS DISTINCT FROM c.currency) THEN
     RAISE EXCEPTION 'Customer purchase currencies require review before linking';
    END IF;
    PERFORM public.recalculate_purchase_metrics(linked);
   END IF;
  END IF;
 END IF;
 UPDATE public.pos_connections SET last_sync_at=clock_timestamp(),sync_status='success',sync_error=NULL WHERE id=c.pos_connection_id;
 RETURN jsonb_build_object('accepted',true,'eventId',eid,'duplicate',false,'stale',stale);
END $function$;

CREATE OR REPLACE FUNCTION public.assign_pos_order_location()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id uuid;
  v_provider text;
  v_connection_location text;
  v_display_name text;
  v_external_location text;
BEGIN
  SELECT source.tenant_id, source.provider, source.location_id, source.name
  INTO v_tenant_id, v_provider, v_connection_location, v_display_name
  FROM (
    -- central-login 59 (crm-r2-F191): BloomSuite POS bridge connections resolve too; their orders use provider 'other'.
    SELECT connection.tenant_id,
      CASE connection.platform WHEN 'bloomsuite' THEN 'other' ELSE connection.platform END AS provider,
      connection.settings->>'location_id' AS location_id,
      connection.name
    FROM public.pos_connections AS connection
    WHERE connection.id = NEW.pos_connection_id
      AND connection.platform IN (
        'square', 'clover', 'lightspeed', 'shopify', 'vmx', 'other', 'bloomsuite'
      )
    UNION ALL
    SELECT connection.tenant_id, 'square', connection.location_id,
      connection.merchant_name
    FROM public.square_connections AS connection
    WHERE connection.id = NEW.pos_connection_id
    UNION ALL
    SELECT connection.tenant_id, 'clover', connection.merchant_id,
      connection.merchant_name
    FROM public.clover_connections AS connection
    WHERE connection.id = NEW.pos_connection_id
    UNION ALL
    SELECT
      (array_agg(history.tenant_id ORDER BY history.tenant_id))[1],
      min(lower(history.connection_type)), NULL::text, NULL::text
    FROM public.pos_sync_jobs AS history
    WHERE history.connection_id = NEW.pos_connection_id
      AND lower(history.connection_type) IN (
        'square', 'clover', 'lightspeed', 'shopify', 'vmx', 'other'
      )
    GROUP BY history.connection_id
    HAVING count(DISTINCT history.tenant_id) = 1
       AND count(DISTINCT lower(history.connection_type)) = 1
  ) AS source
  ORDER BY CASE
    WHEN source.provider IN ('square', 'clover')
      AND source.location_id IS NOT NULL THEN 0
    WHEN source.provider IN ('square', 'clover') THEN 1
    ELSE 2
  END
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    IF NEW.provider IS NOT NULL OR NEW.external_location_id IS NOT NULL THEN
      RAISE EXCEPTION 'POS order connection is not registered'
        USING ERRCODE = '23503';
    END IF;
    RETURN NEW;
  END IF;

  IF auth.role() = 'authenticated' THEN
    IF auth.uid() IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.users AS actor
      WHERE actor.id = auth.uid() AND actor.tenant_id = v_tenant_id
    ) THEN
      RAISE EXCEPTION 'POS order location assignment is not authorized'
        USING ERRCODE = '42501';
    END IF;
  ELSIF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'POS order location assignment requires authorization'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.tenant_id IS NOT NULL AND NEW.tenant_id IS DISTINCT FROM v_tenant_id THEN
    RAISE EXCEPTION 'POS order tenant does not match its connection'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.provider IS NOT NULL AND NEW.provider IS DISTINCT FROM v_provider THEN
    RAISE EXCEPTION 'POS order provider does not match its connection'
      USING ERRCODE = '23514';
  END IF;

  NEW.tenant_id := v_tenant_id;
  NEW.provider := v_provider;

  IF v_provider NOT IN ('square', 'clover') THEN
    RETURN NEW;
  END IF;

  v_external_location := coalesce(
    nullif(btrim(NEW.external_location_id), ''),
    nullif(btrim(NEW.raw_data #>> '{payment,location_id}'), ''),
    nullif(btrim(NEW.raw_data #>> '{order,location_id}'), ''),
    nullif(btrim(NEW.raw_data #>> '{invoice,location_id}'), ''),
    nullif(btrim(v_connection_location), '')
  );
  NEW.external_location_id := v_external_location;

  IF v_external_location IS NULL THEN
    NEW.location_id := NULL;
  ELSE
    NEW.location_id := public.resolve_pos_location(
      v_tenant_id,
      v_provider,
      v_external_location,
      coalesce(nullif(btrim(v_display_name), ''),
        initcap(v_provider) || ' Store ' || v_external_location),
      'UTC'
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.compute_pos_order_revenue_attribution(p_order_id uuid, p_window_days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_order record;
  v_touch record;
  v_gross numeric;
  v_refund numeric;
  v_net numeric;
  v_currency text;
BEGIN
  IF p_window_days < 1 OR p_window_days > 90 THEN
    RAISE EXCEPTION 'Attribution window must be between 1 and 90 days';
  END IF;

  SELECT
    orders.*,
    connection.tenant_id AS resolved_tenant_id,
    customer.tenant_id AS customer_tenant_id
  INTO v_order
  FROM public.pos_orders AS orders
  JOIN public.pos_connections AS connection
    ON connection.id = orders.pos_connection_id
  LEFT JOIN public.crm_customers AS customer
    ON customer.id = orders.crm_customer_id
  WHERE orders.id = p_order_id
  FOR UPDATE OF orders;

  IF NOT FOUND THEN
    DELETE FROM public.campaign_revenue_attributions
    WHERE order_id = p_order_id;
    RETURN jsonb_build_object('attributed', false, 'reason', 'order_not_found');
  END IF;

  v_gross := greatest(coalesce(v_order.total_amount, 0), 0);
  v_refund := greatest(coalesce(v_order.refund_amount, 0), 0);
  v_net := greatest(v_gross - v_refund, 0);
  v_currency := coalesce(nullif(upper(trim(v_order.currency)), ''), 'USD');

  IF lower(coalesce(v_order.status, '')) IN (
    'cancelled', 'canceled', 'void', 'voided', 'deleted'
  ) THEN
    v_net := 0;
  END IF;

  IF v_order.crm_customer_id IS NULL
     OR v_order.customer_tenant_id IS DISTINCT FROM v_order.resolved_tenant_id
     OR v_order.tenant_id IS DISTINCT FROM v_order.resolved_tenant_id -- central-login 59 (crm-r2-F191)
     OR v_net <= 0 THEN
    DELETE FROM public.campaign_revenue_attributions
    WHERE order_id = p_order_id;
    RETURN jsonb_build_object(
      'attributed', false,
      'reason', CASE WHEN v_net <= 0 THEN 'no_net_revenue' ELSE 'unresolved_customer' END
    );
  END IF;

  SELECT candidate.*
  INTO v_touch
  FROM (
    SELECT
      'email'::text AS channel,
      event.campaign_id AS email_campaign_id,
      NULL::uuid AS sms_campaign_id,
      'email_governance_email_events'::text AS touch_source,
      event.id AS touch_event_id,
      coalesce(event.event_ts_provider, event.ingested_at, event.created_at) AS touch_at
    FROM public.email_governance_email_events AS event
    JOIN public.crm_campaigns AS campaign
      ON campaign.id = event.campaign_id
     AND campaign.tenant_id = event.tenant_id
    WHERE event.tenant_id = v_order.resolved_tenant_id
      AND event.customer_id = v_order.crm_customer_id
      AND event.campaign_id IS NOT NULL
      AND event.event_type = 'clicked'
      AND NOT event.is_mpp_guess
      AND NOT event.is_spam_trap
      AND coalesce(event.event_ts_provider, event.ingested_at, event.created_at) <= v_order.order_date
      AND coalesce(event.event_ts_provider, event.ingested_at, event.created_at) >=
        v_order.order_date - make_interval(days => p_window_days)

    UNION ALL

    SELECT
      'sms'::text AS channel,
      NULL::uuid AS email_campaign_id,
      click_event.campaign_id AS sms_campaign_id,
      'sms_link_click_events'::text AS touch_source,
      click_event.id AS touch_event_id,
      click_event.clicked_at AS touch_at
    FROM public.sms_link_click_events AS click_event
    JOIN public.crm_sms_campaigns AS campaign
      ON campaign.id = click_event.campaign_id
     AND campaign.tenant_id = click_event.tenant_id
    WHERE click_event.tenant_id = v_order.resolved_tenant_id
      AND click_event.customer_id = v_order.crm_customer_id
      AND click_event.campaign_id IS NOT NULL
      AND click_event.clicked_at <= v_order.order_date
      AND click_event.clicked_at >=
        v_order.order_date - make_interval(days => p_window_days)
  ) AS candidate
  WHERE candidate.touch_at IS NOT NULL
  ORDER BY candidate.touch_at DESC, candidate.channel, candidate.touch_event_id
  LIMIT 1;

  IF NOT FOUND THEN
    DELETE FROM public.campaign_revenue_attributions
    WHERE order_id = p_order_id;
    RETURN jsonb_build_object('attributed', false, 'reason', 'no_eligible_click');
  END IF;

  INSERT INTO public.campaign_revenue_attributions (
    tenant_id, order_id, customer_id, channel, email_campaign_id,
    sms_campaign_id, touch_source, touch_event_id, touch_at, order_at,
    attribution_window_days, gross_revenue, refund_amount,
    attributed_revenue, currency, updated_at
  ) VALUES (
    v_order.resolved_tenant_id, v_order.id, v_order.crm_customer_id,
    v_touch.channel, v_touch.email_campaign_id, v_touch.sms_campaign_id,
    v_touch.touch_source, v_touch.touch_event_id, v_touch.touch_at,
    v_order.order_date, p_window_days, v_gross, v_refund, v_net,
    v_currency, statement_timestamp()
  )
  ON CONFLICT (order_id) DO UPDATE SET
    tenant_id = excluded.tenant_id,
    customer_id = excluded.customer_id,
    channel = excluded.channel,
    email_campaign_id = excluded.email_campaign_id,
    sms_campaign_id = excluded.sms_campaign_id,
    touch_source = excluded.touch_source,
    touch_event_id = excluded.touch_event_id,
    touch_at = excluded.touch_at,
    order_at = excluded.order_at,
    attribution_window_days = excluded.attribution_window_days,
    gross_revenue = excluded.gross_revenue,
    refund_amount = excluded.refund_amount,
    attributed_revenue = excluded.attributed_revenue,
    currency = excluded.currency,
    updated_at = statement_timestamp();

  RETURN jsonb_build_object(
    'attributed', true,
    'channel', v_touch.channel,
    'campaignId', coalesce(v_touch.email_campaign_id, v_touch.sms_campaign_id),
    'attributedRevenue', v_net,
    'currency', v_currency
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_resolve_pos_customer_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_connection public.pos_connections%ROWTYPE;
  v_first_name text;
  v_last_name text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.external_id IS NOT DISTINCT FROM NEW.external_id
     AND OLD.email IS NOT DISTINCT FROM NEW.email
     AND OLD.phone IS NOT DISTINCT FROM NEW.phone
     AND OLD.name IS NOT DISTINCT FROM NEW.name
     AND OLD.pos_connection_id IS NOT DISTINCT FROM NEW.pos_connection_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_connection
  FROM public.pos_connections
  WHERE id = NEW.pos_connection_id;

  -- central-login 59 (crm-r2-F181): browser roles change contacts only where they hold customer.write.
  IF auth.role() IN ('anon', 'authenticated')
     AND NOT public.has_tenant_permission(v_connection.tenant_id, 'customer.write', NULL) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  IF v_connection.id IS NULL OR v_connection.tenant_id IS NULL THEN
    INSERT INTO public.crm_customer_identity_failures (
      tenant_id, pos_connection_id, pos_customer_id, provider,
      external_id, error_message, source_payload
    ) VALUES (
      v_connection.tenant_id,
      NEW.pos_connection_id,
      NEW.id,
      coalesce(v_connection.platform, NEW.pos_source),
      NEW.external_id,
      'POS connection is missing a tenant',
      jsonb_build_object('name', NEW.name, 'email', NEW.email, 'phone', NEW.phone)
    );
    RETURN NEW;
  END IF;

  v_first_name := nullif(split_part(btrim(coalesce(NEW.name, '')), ' ', 1), '');
  v_last_name := nullif(btrim(regexp_replace(
    btrim(coalesce(NEW.name, '')),
    '^\S+\s*',
    ''
  )), '');

  BEGIN
    PERFORM public.resolve_crm_customer_identity(
      v_connection.tenant_id,
      coalesce(nullif(lower(btrim(v_connection.platform)), ''), 'pos'),
      NEW.external_id,
      NEW.pos_connection_id,
      NEW.id,
      NEW.email,
      NEW.phone,
      v_connection.user_id,
      jsonb_build_object(
        'first_name', v_first_name,
        'last_name', v_last_name,
        'custom_fields', jsonb_build_object(
          'pos_tags', coalesce(to_jsonb(NEW.tags), '[]'::jsonb)
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.crm_customer_identity_failures (
      tenant_id, pos_connection_id, pos_customer_id, provider,
      external_id, error_message, source_payload
    ) VALUES (
      v_connection.tenant_id,
      NEW.pos_connection_id,
      NEW.id,
      coalesce(v_connection.platform, NEW.pos_source),
      NEW.external_id,
      SQLERRM,
      jsonb_build_object('name', NEW.name, 'email', NEW.email, 'phone', NEW.phone)
    );
  END;

  RETURN NEW;
END;
$function$;

-- =================================================================================================================
-- 7. crm-r2-F154 (+ the unowned delete_customers_except gap, recorded as a new issue): the bulk-delete definers need
-- customer.delete in the named tenant (owner/admin, a master admin working in that tenant, or the service role).
-- delete_customers_except also gets the definer search_path the other two already have (it resolves the same tables).

CREATE OR REPLACE FUNCTION public.delete_nameless_customers(p_tenant_id uuid, p_limit integer DEFAULT 500)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count int;
BEGIN
  IF p_tenant_id IS NULL OR NOT public.has_tenant_permission(p_tenant_id, 'customer.delete', NULL) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  WITH to_delete AS (
    SELECT id 
    FROM crm_customers 
    WHERE tenant_id = p_tenant_id
      AND (first_name IS NULL OR TRIM(first_name) = '')
      AND (last_name IS NULL OR TRIM(last_name) = '')
    LIMIT p_limit
  )
  DELETE FROM crm_customers 
  WHERE id IN (SELECT id FROM to_delete);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_phone_duplicates(p_tenant_id uuid, p_limit integer DEFAULT 500)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count int;
BEGIN
  IF p_tenant_id IS NULL OR NOT public.has_tenant_permission(p_tenant_id, 'customer.delete', NULL) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  WITH phone_ranked AS (
    SELECT id, phone,
      ROW_NUMBER() OVER (
        PARTITION BY REGEXP_REPLACE(phone, '\D', '', 'g') 
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
      ) as rn
    FROM crm_customers 
    WHERE tenant_id = p_tenant_id
      AND phone IS NOT NULL 
      AND TRIM(phone) != ''
  ),
  to_delete AS (
    SELECT id FROM phone_ranked WHERE rn > 1 LIMIT p_limit
  )
  DELETE FROM crm_customers 
  WHERE id IN (SELECT id FROM to_delete);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_customers_except(p_keep_email text, p_tenant_id uuid)
 RETURNS TABLE(deleted_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  IF p_tenant_id IS NULL OR NOT public.has_tenant_permission(p_tenant_id, 'customer.delete', NULL) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  
  -- Delete all customers except the one to keep
  WITH deleted AS (
    DELETE FROM crm_customers
    WHERE tenant_id = p_tenant_id
    AND email != p_keep_email
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_deleted_count FROM deleted;
  
  RETURN QUERY SELECT v_deleted_count;
END;
$function$;

-- =================================================================================================================
-- 8. crm-r2-F157: get_domain_email_stats_30d answered any signed-in caller for every tenant (NULL) or any named tenant.
-- The all-tenant form is for a master admin or the service role; a named tenant needs reporting.read there (or a
-- master admin). The current return signature (with the warmup columns) is kept. get_overdue_campaigns has no app
-- caller (the browser uses get_my_overdue_campaigns): service role only.

CREATE OR REPLACE FUNCTION public.get_domain_email_stats_30d(p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(domain_id uuid, domain_name text, tenant_id uuid, verification_status text, warmup_stage integer, daily_limit integer, daily_used integer, emails_sent_30d bigint, emails_delivered_30d bigint, emails_opened_30d bigint, emails_clicked_30d bigint, emails_bounced_30d bigint, emails_complained_30d bigint, open_rate_30d numeric, click_rate_30d numeric, bounce_rate_30d numeric, complaint_rate_30d numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    auth.role() IS NOT DISTINCT FROM 'service_role'
    OR coalesce(public.is_master_admin(auth.uid()), false)
    OR (p_tenant_id IS NOT NULL AND public.has_tenant_permission(p_tenant_id, 'reporting.read', NULL))
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT 
    s.domain_id,
    s.domain_name,
    s.tenant_id,
    s.verification_status,
    s.warmup_stage,
    s.daily_limit,
    s.daily_used,
    s.emails_sent_30d,
    s.emails_delivered_30d,
    s.emails_opened_30d,
    s.emails_clicked_30d,
    s.emails_bounced_30d,
    s.emails_complained_30d,
    s.open_rate_30d,
    s.click_rate_30d,
    s.bounce_rate_30d,
    s.complaint_rate_30d
  FROM email_domain_stats_30d s
  WHERE p_tenant_id IS NULL OR s.tenant_id = p_tenant_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_overdue_campaigns(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_overdue_campaigns(uuid) TO service_role;

-- =================================================================================================================
-- 9. crm-r2-F158: the last-open trigger on email_tracking_events updated, and un-suppressed, every customer in any
-- tenant with the opened address. An open now changes only last_open_at of the event's own tenant's customer, and only
-- when the event's campaign (if it names one) is in that tenant. It never lifts a suppression: an open is not consent
-- and must not reverse a bounce, complaint or manual suppression (20260222130000 meant to remove this).

CREATE OR REPLACE FUNCTION public.update_customer_last_open()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.event_type = 'opened'
     AND NEW.tenant_id IS NOT NULL
     AND (
       NEW.campaign_id IS NULL
       OR EXISTS (SELECT 1 FROM crm_campaigns c WHERE c.id = NEW.campaign_id AND c.tenant_id = NEW.tenant_id)
     ) THEN
    UPDATE crm_customers
    SET last_open_at = NEW.created_at
    WHERE email = NEW.customer_email
      AND tenant_id = NEW.tenant_id
      AND (last_open_at IS NULL OR last_open_at < NEW.created_at);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- =================================================================================================================
-- 10. Billing definers, (a) server-only: crm-r2-F118 (refill_tokens), F144 (check_email_quota, check_sms_quota), F148
-- (track_incentive_sent, track_content_interaction), F173 (can_run_sync x2, get_remaining_budget, can_send_emails,
-- can_send_sms), F189 (evaluate_tenant_hard_stop, log_form_automation_execution, the six refresh_all_* and five
-- recalculate_* helpers), F164 (the governance config getters). Each is tenant- or user-keyed with no caller check and
-- has no browser or Edge caller that runs as a signed-in user (the browser refresh/recalculate wrappers in the metrics
-- hooks are not imported anywhere; 20260903150000 already meant the loyalty pair to be service-only). SQL callers are
-- all SECURITY DEFINER functions, which run as the owner and keep working. refresh_all_purchase_metrics already checks
-- its caller (42501) and is left as it is.
REVOKE EXECUTE ON FUNCTION public.refill_tokens(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_email_quota(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_sms_quota(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.track_incentive_sent(uuid, uuid, text, numeric, text, text, text, uuid, timestamp with time zone) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.track_content_interaction(uuid, uuid, text, text, text, text, uuid, uuid, uuid, text, text, text, integer, integer, integer, integer, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_run_sync(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_run_sync(uuid, public.pos_provider) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_remaining_budget(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_send_emails(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_send_sms(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.evaluate_tenant_hard_stop(uuid, timestamp with time zone) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_form_automation_execution(uuid, uuid, uuid, uuid, uuid, text, text, integer, text, jsonb, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_all_content_intent_metrics(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_all_cross_channel_metrics(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_all_lifecycle_metrics(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_all_loyalty_metrics(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_all_post_purchase_metrics(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_all_risk_signals(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_loyalty_metrics(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_content_intent_metrics(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_lifecycle_metrics(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_post_purchase_metrics(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_risk_signals(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_email_governance_config() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_gov_cfg_value(text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_gov_cfg_num(text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_gov_cfg_int(text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_gov_cfg_interval(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refill_tokens(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_email_quota(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_sms_quota(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.track_incentive_sent(uuid, uuid, text, numeric, text, text, text, uuid, timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.track_content_interaction(uuid, uuid, text, text, text, text, uuid, uuid, uuid, text, text, text, integer, integer, integer, integer, integer, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_run_sync(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_run_sync(uuid, public.pos_provider) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_remaining_budget(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_send_emails(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_send_sms(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_tenant_hard_stop(uuid, timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_form_automation_execution(uuid, uuid, uuid, uuid, uuid, text, text, integer, text, jsonb, uuid, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_content_intent_metrics(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_cross_channel_metrics(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_lifecycle_metrics(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_loyalty_metrics(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_post_purchase_metrics(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_risk_signals(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_loyalty_metrics(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_content_intent_metrics(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_lifecycle_metrics(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_post_purchase_metrics(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_risk_signals(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_email_governance_config() TO service_role;
GRANT EXECUTE ON FUNCTION public.email_gov_cfg_value(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_gov_cfg_num(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_gov_cfg_int(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_gov_cfg_interval(text[]) TO service_role;

-- =================================================================================================================
-- 11. Billing definers, (b) browser-called, so they keep their grant and gain a caller check (the 20261113080000
-- pattern): crm-r2-F118 (spend_tokens, get_token_balance: the caller's own account only; spend_tokens refuses a zero or
-- negative amount, which credited the balance), F162 (get_usage_stats: own account), F173 (enqueue_pos_sync_job: a
-- member of the tenant, or integrations.manage there, as the four *-full-sync functions call it with the member's
-- token), F189 (get_tenant_suppression_bypass_state, get_tenant_reputation_policy, generate_ticket_number,
-- track_global_image_usage: a member of the tenant or a master admin; track_global_image_usage also only in the
-- caller's own name). The tenant helpers keep answering the service role and owner-run work with no JWT (pg_cron, the
-- 20260903183000 rule), and the SECURITY DEFINER readers that call get_tenant_reputation_policy for their own allowed
-- callers (tenant health dashboard: members; admin email panel: master admins).

CREATE OR REPLACE FUNCTION public.spend_tokens(p_user_id uuid, p_tokens integer, p_action_type text DEFAULT 'generation'::text, p_content_type text DEFAULT NULL::text, p_campaign_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  current_balance INTEGER;
  profile_id UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_tokens IS NULL OR p_tokens <= 0 THEN
    RAISE EXCEPTION 'Token amount must be positive' USING ERRCODE = '22023';
  END IF;

  -- Get user's company profile and current token balance
  SELECT id, tokens_balance INTO profile_id, current_balance
  FROM public.company_profiles 
  WHERE user_id = p_user_id;
  
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'No company profile found for user';
  END IF;
  
  -- Check if user has enough tokens (allow negative for overage)
  IF current_balance < p_tokens AND current_balance >= 0 THEN
    -- User will go into overage, but allow it
    NULL;
  END IF;
  
  -- Deduct tokens
  UPDATE public.company_profiles 
  SET tokens_balance = tokens_balance - p_tokens
  WHERE id = profile_id;
  
  -- Log the usage
  INSERT INTO public.token_usage (
    user_id, 
    action_type, 
    tokens_consumed, 
    tokens_remaining,
    content_type,
    campaign_id
  ) VALUES (
    p_user_id,
    p_action_type,
    p_tokens,
    current_balance - p_tokens,
    p_content_type,
    p_campaign_id
  );
  
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_token_balance(p_user_id uuid)
 RETURNS TABLE(tokens_balance integer, tokens_reset_at timestamp with time zone, is_trial boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT 
    cp.tokens_balance,
    cp.tokens_reset_at,
    s.plan = 'free_trial' as is_trial
  FROM public.company_profiles cp
  LEFT JOIN public.subscriptions s ON s.user_id = cp.user_id
  WHERE cp.user_id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_usage_stats(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_subscription RECORD;
  v_tier_limits RECORD;
  v_email_limit INTEGER;
  v_sms_limit INTEGER;
  v_email_percent NUMERIC;
  v_sms_percent NUMERIC;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  -- Get subscription
  SELECT * INTO v_subscription 
  FROM subscriptions 
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'No subscription found');
  END IF;
  
  -- Get limits from tier or legacy columns
  IF v_subscription.tier IS NOT NULL THEN
    SELECT * INTO v_tier_limits FROM tier_limits WHERE tier = v_subscription.tier;
    v_email_limit := v_tier_limits.email_limit;
    v_sms_limit := v_tier_limits.sms_limit;
  ELSE
    v_email_limit := COALESCE(v_subscription.email_quota, 10000);
    v_sms_limit := COALESCE(v_subscription.sms_quota, 1000);
  END IF;
  
  -- Calculate percentages (handle unlimited case)
  IF v_email_limit > 0 THEN
    v_email_percent := ROUND((COALESCE(v_subscription.email_usage, 0)::NUMERIC / v_email_limit) * 100, 1);
  ELSE
    v_email_percent := 0;
  END IF;
  
  IF v_sms_limit > 0 THEN
    v_sms_percent := ROUND((COALESCE(v_subscription.sms_usage, 0)::NUMERIC / v_sms_limit) * 100, 1);
  ELSE
    v_sms_percent := 0;
  END IF;
  
  RETURN jsonb_build_object(
    'tier', COALESCE(v_subscription.tier, 'legacy'),
    'is_founding_customer', COALESCE(v_subscription.is_founding_customer, false),
    'email', jsonb_build_object(
      'used', COALESCE(v_subscription.email_usage, 0),
      'limit', v_email_limit,
      'remaining', GREATEST(0, v_email_limit - COALESCE(v_subscription.email_usage, 0)),
      'percent', v_email_percent,
      'unlimited', v_email_limit = -1,
      'overage_this_month', COALESCE(v_subscription.overage_emails_this_month, 0),
      'overage_rate', COALESCE(v_tier_limits.email_overage_rate, 0.002)
    ),
    'sms', jsonb_build_object(
      'used', COALESCE(v_subscription.sms_usage, 0),
      'limit', v_sms_limit,
      'remaining', GREATEST(0, v_sms_limit - COALESCE(v_subscription.sms_usage, 0)),
      'percent', v_sms_percent,
      'unlimited', v_sms_limit = -1,
      'overage_this_month', COALESCE(v_subscription.overage_sms_this_month, 0),
      'overage_rate', COALESCE(v_tier_limits.sms_overage_rate, 0.03)
    ),
    'billing_interval', v_subscription.billing_interval,
    'end_date', v_subscription.end_date,
    'plan', v_subscription.plan
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_pos_sync_job(p_tenant_id uuid, p_provider pos_provider, p_sync_type pos_sync_type DEFAULT 'full'::pos_sync_type, p_estimated_rows integer DEFAULT 0, p_triggered_by text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_month DATE := date_trunc('month', CURRENT_DATE)::date;
  v_budget RECORD;
  v_counter RECORD;
  v_gate JSONB;
  v_existing_job public.pos_sync_jobs_v2;
  v_job public.pos_sync_jobs_v2;
  v_is_master_admin BOOLEAN := COALESCE(public.is_master_admin(auth.uid()), false);
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT (
       EXISTS (SELECT 1 FROM public.users AS app_user WHERE app_user.id = auth.uid() AND app_user.tenant_id = p_tenant_id)
       OR public.has_tenant_permission(p_tenant_id, 'integrations.manage', NULL)
     ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  PERFORM public.ensure_org_usage_initialized(p_tenant_id);

  SELECT * INTO v_budget
  FROM public.org_usage_budgets
  WHERE tenant_id = p_tenant_id
    AND month = v_month;

  SELECT * INTO v_counter
  FROM public.org_usage_counters
  WHERE tenant_id = p_tenant_id
    AND month = v_month;

  SELECT *
  INTO v_existing_job
  FROM public.pos_sync_jobs_v2
  WHERE tenant_id = p_tenant_id
    AND provider = p_provider
    AND sync_type = COALESCE(p_sync_type, 'full')
    AND status IN ('pending', 'in_progress', 'delayed')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_job.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'id', v_existing_job.id,
      'jobId', v_existing_job.id,
      'job_id', v_existing_job.id,
      'status', 'queued',
      'reason', 'already_queued',
      'message', 'A sync job is already queued for this tenant and sync type.',
      'success', true,
      'plan', v_budget.plan,
      'current', v_counter.sync_jobs_used,
      'max', v_budget.max_sync_jobs
    );
  END IF;

  v_gate := public.can_run_sync(p_tenant_id, p_provider);
  IF COALESCE((v_gate->>'allow')::boolean, false) = false THEN
    RETURN jsonb_build_object(
      'id', NULL,
      'jobId', NULL,
      'job_id', NULL,
      'status', 'denied',
      'reason', v_gate->>'reason',
      'message', COALESCE(v_gate->>'message', 'Sync could not be queued.'),
      'success', false,
      'plan', COALESCE(v_gate->>'plan', v_budget.plan),
      'current', COALESCE((v_gate->>'current')::integer, v_counter.sync_jobs_used),
      'max', COALESCE((v_gate->>'max')::integer, v_budget.max_sync_jobs)
    );
  END IF;

  INSERT INTO public.pos_sync_jobs_v2 (
    tenant_id,
    provider,
    sync_type,
    status,
    estimated_rows,
    triggered_by,
    scheduled_at,
    progress_message,
    batch_size,
    max_retries,
    created_at,
    updated_at
  )
  VALUES (
    p_tenant_id,
    p_provider,
    COALESCE(p_sync_type, 'full'),
    'pending',
    COALESCE(p_estimated_rows, 0),
    COALESCE(p_triggered_by, 'manual'),
    now(),
    'Queued - waiting to start',
    100,
    3,
    now(),
    now()
  )
  RETURNING * INTO v_job;

  IF NOT v_is_master_admin THEN
    UPDATE public.org_usage_counters
    SET sync_jobs_used = sync_jobs_used + 1,
        updated_at = now()
    WHERE tenant_id = p_tenant_id
      AND month = v_month;
  END IF;

  RETURN jsonb_build_object(
    'id', v_job.id,
    'jobId', v_job.id,
    'job_id', v_job.id,
    'status', 'queued',
    'reason', 'queued',
    'message', 'Sync job queued successfully.',
    'success', true,
    'plan', v_budget.plan,
    'current', CASE
      WHEN v_is_master_admin THEN v_counter.sync_jobs_used
      ELSE v_counter.sync_jobs_used + 1
    END,
    'max', v_budget.max_sync_jobs
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_tenant_suppression_bypass_state(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;
  IF auth.uid() IS NOT NULL THEN
    IF NOT (
      EXISTS (SELECT 1 FROM public.users AS app_user WHERE app_user.id = auth.uid() AND app_user.tenant_id = p_tenant_id)
      OR coalesce(public.is_master_admin(auth.uid()), false)
    ) THEN
      RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
  ELSIF auth.role() IS DISTINCT FROM 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  BEGIN
    SELECT
      COALESCE(s.suppression_bypass_enabled, false) AS suppression_bypass_enabled,
      s.suppression_bypass_until,
      s.suppression_bypass_reason,
      COALESCE(s.suppression_bypass_automation_mode, 'campaign_only') AS suppression_bypass_automation_mode
    INTO v_row
    FROM public.email_governance_tenant_control_state s
    WHERE s.tenant_id = p_tenant_id;
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      v_row := NULL;
  END;

  RETURN jsonb_build_object(
    'suppression_bypass_enabled', COALESCE(v_row.suppression_bypass_enabled, false),
    'suppression_bypass_until', v_row.suppression_bypass_until,
    'suppression_bypass_reason', v_row.suppression_bypass_reason,
    'suppression_bypass_automation_mode', COALESCE(v_row.suppression_bypass_automation_mode, 'campaign_only'),
    'suppression_bypass_active', (
      COALESCE(v_row.suppression_bypass_enabled, false)
      AND (v_row.suppression_bypass_until IS NULL OR v_row.suppression_bypass_until > v_now)
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_tenant_reputation_policy(p_tenant_id uuid)
 RETURNS TABLE(tenant_id uuid, score integer, tier text, action text, recipient_cap integer, job_batch_size integer, send_pacing_multiplier numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_score INTEGER := 100;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'p_tenant_id is required'; END IF;
  IF auth.uid() IS NOT NULL THEN
    IF NOT (
      EXISTS (SELECT 1 FROM public.users AS app_user WHERE app_user.id = auth.uid() AND app_user.tenant_id = p_tenant_id)
      OR coalesce(public.is_master_admin(auth.uid()), false)
    ) THEN
      RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
  ELSIF auth.role() IS DISTINCT FROM 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT s.score INTO v_score FROM public.email_governance_tenant_reputation_scores s WHERE s.tenant_id = p_tenant_id LIMIT 1;
  v_score := COALESCE(v_score, 100);
  tenant_id := p_tenant_id; score := v_score;
  IF NOT public.email_reputation_enforcement_enabled() OR v_score >= 90 THEN
    tier := 'normal'; action := 'allow'; recipient_cap := NULL; job_batch_size := 50; send_pacing_multiplier := 1;
  ELSIF v_score >= 75 THEN
    tier := 'throttled'; action := 'throttle'; recipient_cap := 10000; job_batch_size := 25; send_pacing_multiplier := 2;
  ELSIF v_score >= 60 THEN
    tier := 'restricted'; action := 'throttle'; recipient_cap := 2000; job_batch_size := 10; send_pacing_multiplier := 4;
  ELSE
    tier := 'critical'; action := 'pause'; recipient_cap := 0; job_batch_size := 10; send_pacing_multiplier := 4;
  END IF;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_ticket_number(p_tenant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  next_number INTEGER;
  ticket_number TEXT;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NOT (
      EXISTS (SELECT 1 FROM public.users AS app_user WHERE app_user.id = auth.uid() AND app_user.tenant_id = p_tenant_id)
      OR coalesce(public.is_master_admin(auth.uid()), false)
    ) THEN
      RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
  ELSIF auth.role() IS DISTINCT FROM 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(MAX(CAST(SUBSTRING(support_tickets.ticket_number FROM 'TKT-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM support_tickets
  WHERE support_tickets.tenant_id = p_tenant_id;
  
  ticket_number := 'TKT-' || LPAD(next_number::text, 6, '0');
  RETURN ticket_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_global_image_usage(p_image_id uuid, p_tenant_id uuid, p_user_id uuid, p_context text, p_campaign_id uuid DEFAULT NULL::uuid, p_block_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_is_new_tenant BOOLEAN;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF p_user_id IS DISTINCT FROM auth.uid() OR NOT (
      EXISTS (SELECT 1 FROM public.users AS app_user WHERE app_user.id = auth.uid() AND app_user.tenant_id = p_tenant_id)
      OR coalesce(public.is_master_admin(auth.uid()), false)
    ) THEN
      RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
  ELSIF auth.role() IS DISTINCT FROM 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  -- Check if this is first use by this tenant
  SELECT NOT EXISTS (
    SELECT 1 FROM public.image_tenant_usage 
    WHERE image_id = p_image_id AND tenant_id = p_tenant_id
  ) INTO v_is_new_tenant;
  
  -- Update global image counters
  UPDATE public.global_image_gallery
  SET 
    total_usage_count = total_usage_count + 1,
    unique_tenant_count = CASE 
      WHEN v_is_new_tenant THEN unique_tenant_count + 1 
      ELSE unique_tenant_count 
    END,
    last_used_at = now(),
    updated_at = now()
  WHERE id = p_image_id;
  
  -- Insert or update tenant usage record
  INSERT INTO public.image_tenant_usage (
    image_id, tenant_id, user_id, used_in_context,
    campaign_id, block_id, usage_count, last_used_at
  )
  VALUES (
    p_image_id, p_tenant_id, p_user_id, p_context,
    p_campaign_id, p_block_id, 1, now()
  )
  ON CONFLICT (image_id, tenant_id, block_id)
  DO UPDATE SET
    usage_count = image_tenant_usage.usage_count + 1,
    last_used_at = now(),
    updated_at = now();
END;
$function$;

-- =================================================================================================================
-- 12. crm-r2-F04 + F112 (database part): resolve_effective_subscription_tier decides a tenant's budget plan.
-- F04: a free trial whose end_date has passed is 'expired' (it kept the free_trial budget for ever).
-- F112: the subscription of the tenant's owner or admin wins over any other member's row (a staff member's own
-- subscription replaced the owner's plan); among those, the existing order (current, then lapsed, then expired; the
-- most recent first) still decides. The stripe-webhook and SubscriptionContext halves are code changes (another pack).

CREATE OR REPLACE FUNCTION public.resolve_effective_subscription_tier(p_tenant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tier TEXT;
BEGIN
  SELECT COALESCE(
    NULLIF(lower(trim(s.tier)), ''),
    CASE
      WHEN s.plan::text IN ('seed', 'sprout', 'bloom', 'thrive') THEN s.plan::text
      WHEN s.plan::text = 'free_trial' AND s.end_date < CURRENT_DATE THEN 'expired'
      WHEN s.plan::text IN ('free_trial', 'expired') THEN s.plan::text
      ELSE NULL
    END
  )
  INTO v_tier
  FROM public.subscriptions s
  JOIN public.users u ON u.id = s.user_id
  WHERE u.tenant_id = p_tenant_id
    AND s.deleted_at IS NULL
  ORDER BY
    CASE WHEN u.role IN ('owner', 'admin') THEN 0 ELSE 1 END,
    CASE
      WHEN s.plan::text = 'expired' THEN 2
      WHEN s.end_date >= CURRENT_DATE THEN 0
      ELSE 1
    END,
    COALESCE(s.updated_at, s.created_at) DESC,
    s.created_at DESC
  LIMIT 1;

  RETURN COALESCE(v_tier, 'free_trial');
END;
$function$;

-- =================================================================================================================
-- 13. crm-r2-F111 (database part): a Stripe event delivered late overwrote a newer stored subscription state. The
-- webhook stores the event's own time (event.created) in stripe_event_created_at on every subscription write (code,
-- another pack); an update carrying an older event time than the stored one is skipped (the row keeps the newer state
-- and the webhook still answers 200, so Stripe does not retry a stale event). Writes that do not set the column (usage
-- counters, alerts) are unaffected. Binding each event to the row with the same stripe_subscription_id is the code half.
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS stripe_event_created_at timestamptz;
COMMENT ON COLUMN public.subscriptions.stripe_event_created_at IS
  'Stripe event.created of the last applied subscription event; an older event never overwrites a newer one.';

CREATE OR REPLACE FUNCTION public.skip_stale_stripe_subscription_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.stripe_event_created_at IS NOT NULL
     AND OLD.stripe_event_created_at IS NOT NULL
     AND NEW.stripe_event_created_at < OLD.stripe_event_created_at THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.skip_stale_stripe_subscription_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS skip_stale_stripe_subscription_event ON public.subscriptions;
CREATE TRIGGER skip_stale_stripe_subscription_event
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.skip_stale_stripe_subscription_event();

-- =================================================================================================================
-- 14. crm-r2-F153, F156, F175 (send control): claiming, completing, pausing, resuming, stopping and retrying a
-- campaign's send, and building its jobs, need campaign.send in the campaign's tenant (marketing, sender, owner/admin,
-- a master admin working there, or the service role). The existing owner-or-same-tenant checks stay. A missing
-- campaign keeps its existing "not found" answer. F175: the 5-argument ensure_jobs decided "internal caller" from
-- current_user, which inside a SECURITY DEFINER body is always the owner; it now decides from the request (service role,
-- or owner-run work with no JWT claims such as pg_cron and campaign_health_check), and every other caller takes the
-- caller check plus campaign.send.

CREATE OR REPLACE FUNCTION public.claim_campaign_for_send(campaign_id uuid)
 RETURNS TABLE(success boolean, previous_status text, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_status TEXT;
  v_campaign_tenant_id uuid;
BEGIN
  v_campaign_tenant_id := (SELECT c.tenant_id FROM public.crm_campaigns c WHERE c.id = claim_campaign_for_send.campaign_id);
  -- central-login 59 (crm-r2-F153/F156): send control needs campaign.send in the campaign's tenant.
  IF v_campaign_tenant_id IS NOT NULL
     AND NOT public.has_tenant_permission(v_campaign_tenant_id, 'campaign.send', NULL) THEN
    RAISE EXCEPTION 'Campaign sending permission required' USING ERRCODE = '42501';
  END IF;
  -- Get current status with row lock
  SELECT status INTO current_status
  FROM crm_campaigns
  WHERE id = campaign_id
  FOR UPDATE;
  
  -- Check if campaign exists
  IF current_status IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'Campaign not found'::TEXT;
    RETURN;
  END IF;
  
  -- Only allow claiming from these statuses
  IF current_status NOT IN ('draft', 'scheduled') THEN
    RETURN QUERY SELECT 
      FALSE, 
      current_status, 
      CASE 
        WHEN current_status = 'sending' THEN 'Campaign is already being sent'
        WHEN current_status = 'sent' THEN 'Campaign has already been sent'
        WHEN current_status = 'failed' THEN 'Campaign previously failed - reset to draft first'
        ELSE 'Campaign cannot be sent from status: ' || current_status
      END;
    RETURN;
  END IF;
  
  -- Atomically update to sending
  UPDATE crm_campaigns
  SET 
    status = 'sending',
    send_started_at = NOW(),
    send_error = NULL
  WHERE id = campaign_id;
  
  RETURN QUERY SELECT TRUE, current_status, NULL::TEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_email_campaign_completed_with_failures(p_campaign_id uuid)
 RETURNS TABLE(success boolean, new_status text, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
  v_has_inflight BOOLEAN;
  v_total_messages INTEGER;
  v_campaign_tenant_id uuid;
BEGIN
  IF p_campaign_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'Campaign id is required'::TEXT;
    RETURN;
  END IF;

  v_campaign_tenant_id := (SELECT c.tenant_id FROM public.crm_campaigns c WHERE c.id = p_campaign_id);
  -- central-login 59 (crm-r2-F153/F156): send control needs campaign.send in the campaign's tenant.
  IF v_campaign_tenant_id IS NOT NULL
     AND NOT public.has_tenant_permission(v_campaign_tenant_id, 'campaign.send', NULL) THEN
    RAISE EXCEPTION 'Campaign sending permission required' USING ERRCODE = '42501';
  END IF;

  -- Lock campaign row to avoid races with other updates.
  SELECT status INTO v_status
  FROM public.crm_campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'Campaign not found'::TEXT;
    RETURN;
  END IF;

  -- Refuse to mark a campaign 'sent' when no recipient queue exists at all.
  -- This catches the case where send-email-campaign crashed before persisting
  -- the email_messages ledger; otherwise we silently lie about a delivery.
  SELECT COUNT(*) INTO v_total_messages
  FROM public.email_messages m
  WHERE m.campaign_id = p_campaign_id;

  IF v_total_messages = 0 THEN
    RETURN QUERY SELECT FALSE, v_status,
      'No recipient queue was ever created for this campaign. Re-send the campaign instead of marking it complete.'::TEXT;
    RETURN;
  END IF;

  -- Do not allow completion while there is still sendable work in-flight.
  SELECT EXISTS (
    SELECT 1
    FROM public.email_messages m
    WHERE m.campaign_id = p_campaign_id
      AND m.status IN ('queued', 'sending', 'paused')
      AND m.resend_id IS NULL
      AND m.dead_lettered_at IS NULL
  ) INTO v_has_inflight;

  IF v_has_inflight THEN
    RETURN QUERY SELECT FALSE, v_status, 'Campaign still has queued/sending messages'::TEXT;
    RETURN;
  END IF;

  UPDATE public.crm_campaigns
  SET
    status = 'sent',
    sent_at = COALESCE(sent_at, NOW()),
    send_error = NULL,
    send_blocked_reason = NULL,
    updated_at = NOW()
  WHERE id = p_campaign_id;

  RETURN QUERY SELECT TRUE, 'sent'::TEXT, NULL::TEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.resume_email_campaign_sending(p_campaign_id uuid)
 RETURNS TABLE(messages_resumed integer, jobs_resumed integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET lock_timeout TO '1s'
AS $function$
DECLARE
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;

  v_campaign_user_id UUID;
  v_campaign_tenant_id UUID;
  v_effective_tenant_id UUID;

  v_message_limit INT := 2000;
BEGIN
  messages_resumed := 0;
  jobs_resumed := 0;

  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT u.tenant_id
  INTO v_actor_tenant_id
  FROM public.users u
  WHERE u.id = v_actor_user_id;

  SELECT c.user_id, c.tenant_id
  INTO v_campaign_user_id, v_campaign_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL THEN
    RETURN;
  END IF;

  v_effective_tenant_id := v_campaign_tenant_id;

  IF v_effective_tenant_id IS NULL THEN
    SELECT u.tenant_id
    INTO v_effective_tenant_id
    FROM public.users u
    WHERE u.id = v_campaign_user_id;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.crm_campaigns c
    JOIN public.crm_segments s ON s.id = c.segment_id
    WHERE c.id = p_campaign_id
    LIMIT 1;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.campaign_segments cs
    JOIN public.crm_segments s ON s.id = cs.segment_id
    WHERE cs.campaign_id = p_campaign_id
    LIMIT 1;
  END IF;

  -- central-login 59 (crm-r2-F153/F156): send control needs campaign.send in the campaign's tenant.
  IF v_effective_tenant_id IS NULL
     OR NOT public.has_tenant_permission(v_effective_tenant_id, 'campaign.send', NULL) THEN
    RAISE EXCEPTION 'Campaign sending permission required' USING ERRCODE = '42501';
  END IF;

  -- Authorization: owner or same tenant.
  IF v_campaign_user_id = v_actor_user_id THEN
    -- ok
  ELSIF v_actor_tenant_id IS NOT NULL AND v_effective_tenant_id IS NOT NULL AND v_actor_tenant_id = v_effective_tenant_id THEN
    -- ok
  ELSE
    RETURN;
  END IF;

  -- Resume campaign (fast).
  -- Only clear the legacy pause marker; preserve real block reasons/errors.
  UPDATE public.crm_campaigns c
  SET
    status = 'sending',
    send_blocked_reason = CASE
      WHEN c.send_blocked_reason = 'paused_by_user' THEN NULL
      ELSE c.send_blocked_reason
    END,
    send_error = CASE
      WHEN c.send_error = 'paused_by_user' THEN NULL
      ELSE c.send_error
    END,
    send_started_at = COALESCE(c.send_started_at, now()),
    updated_at = now()
  WHERE c.id = p_campaign_id
    AND c.status = 'paused';

  -- Resume paused jobs.
  WITH to_resume AS (
    SELECT j.ctid
    FROM public.email_send_jobs j
    WHERE j.campaign_id = p_campaign_id
      AND j.status = 'paused'
    FOR UPDATE SKIP LOCKED
  ), x AS (
    UPDATE public.email_send_jobs j
    SET
      status = 'pending',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE j.ctid IN (SELECT ctid FROM to_resume)
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO jobs_resumed FROM x;

  -- Resume a bounded number of paused messages per call.
  WITH to_resume AS (
    SELECT m.ctid
    FROM public.email_messages m
    WHERE m.campaign_id = p_campaign_id
      AND m.status = 'paused'
      AND m.resend_id IS NULL
    LIMIT v_message_limit
    FOR UPDATE SKIP LOCKED
  ), u AS (
    UPDATE public.email_messages m
    SET
      status = 'queued',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE m.ctid IN (SELECT ctid FROM to_resume)
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO messages_resumed FROM u;

  RETURN QUERY SELECT messages_resumed, jobs_resumed;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pause_email_campaign_sending(p_campaign_id uuid)
 RETURNS TABLE(messages_paused integer, jobs_paused integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET lock_timeout TO '1s'
AS $function$
DECLARE
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;

  v_campaign_user_id UUID;
  v_campaign_tenant_id UUID;
  v_effective_tenant_id UUID;

  v_message_limit INT := 2000;
BEGIN
  messages_paused := 0;
  jobs_paused := 0;

  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT u.tenant_id
  INTO v_actor_tenant_id
  FROM public.users u
  WHERE u.id = v_actor_user_id;

  SELECT c.user_id, c.tenant_id
  INTO v_campaign_user_id, v_campaign_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL THEN
    RETURN;
  END IF;

  v_effective_tenant_id := v_campaign_tenant_id;

  IF v_effective_tenant_id IS NULL THEN
    SELECT u.tenant_id
    INTO v_effective_tenant_id
    FROM public.users u
    WHERE u.id = v_campaign_user_id;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.crm_campaigns c
    JOIN public.crm_segments s ON s.id = c.segment_id
    WHERE c.id = p_campaign_id
    LIMIT 1;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.campaign_segments cs
    JOIN public.crm_segments s ON s.id = cs.segment_id
    WHERE cs.campaign_id = p_campaign_id
    LIMIT 1;
  END IF;

  -- central-login 59 (crm-r2-F153/F156): send control needs campaign.send in the campaign's tenant.
  IF v_effective_tenant_id IS NULL
     OR NOT public.has_tenant_permission(v_effective_tenant_id, 'campaign.send', NULL) THEN
    RAISE EXCEPTION 'Campaign sending permission required' USING ERRCODE = '42501';
  END IF;

  -- Authorization: owner or same tenant.
  IF v_campaign_user_id = v_actor_user_id THEN
    -- ok
  ELSIF v_actor_tenant_id IS NOT NULL AND v_effective_tenant_id IS NOT NULL AND v_actor_tenant_id = v_effective_tenant_id THEN
    -- ok
  ELSE
    RETURN;
  END IF;

  -- Mark campaign paused (fast).
  UPDATE public.crm_campaigns c
  SET
    status = 'paused',
    send_blocked_reason = 'paused_by_user',
    updated_at = now()
  WHERE c.id = p_campaign_id
    AND c.status IN ('scheduled', 'queued', 'partially_queued', 'sending', 'paused');

  -- Pause jobs so the worker doesn't claim them.
  WITH to_pause AS (
    SELECT j.ctid
    FROM public.email_send_jobs j
    WHERE j.campaign_id = p_campaign_id
      AND j.status IN ('pending', 'in_progress')
    FOR UPDATE SKIP LOCKED
  ), x AS (
    UPDATE public.email_send_jobs j
    SET
      status = 'paused',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE j.ctid IN (SELECT ctid FROM to_pause)
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO jobs_paused FROM x;

  -- Pause a bounded number of messages per call; never wait on locked rows.
  WITH to_pause AS (
    SELECT m.ctid
    FROM public.email_messages m
    WHERE m.campaign_id = p_campaign_id
      AND m.resend_id IS NULL
      AND m.status IN ('queued', 'sending')
    ORDER BY (m.status = 'sending') DESC, m.claimed_at NULLS LAST
    LIMIT v_message_limit
    FOR UPDATE SKIP LOCKED
  ), u AS (
    UPDATE public.email_messages m
    SET
      status = 'paused',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE m.ctid IN (SELECT ctid FROM to_pause)
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO messages_paused FROM u;

  RETURN QUERY SELECT messages_paused, jobs_paused;
END;
$function$;

CREATE OR REPLACE FUNCTION public.stop_email_campaign_sending(p_campaign_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS TABLE(messages_stopped integer, jobs_stopped integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET lock_timeout TO '1s'
AS $function$
DECLARE
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;

  v_campaign_user_id UUID;
  v_campaign_tenant_id UUID;
  v_effective_tenant_id UUID;

  v_message_limit INT := 2000;
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'stopped_by_user');
BEGIN
  messages_stopped := 0;
  jobs_stopped := 0;

  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT u.tenant_id
  INTO v_actor_tenant_id
  FROM public.users u
  WHERE u.id = v_actor_user_id;

  SELECT c.user_id, c.tenant_id
  INTO v_campaign_user_id, v_campaign_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL THEN
    RETURN;
  END IF;

  v_effective_tenant_id := v_campaign_tenant_id;

  IF v_effective_tenant_id IS NULL THEN
    SELECT u.tenant_id
    INTO v_effective_tenant_id
    FROM public.users u
    WHERE u.id = v_campaign_user_id;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.crm_campaigns c
    JOIN public.crm_segments s ON s.id = c.segment_id
    WHERE c.id = p_campaign_id
    LIMIT 1;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.campaign_segments cs
    JOIN public.crm_segments s ON s.id = cs.segment_id
    WHERE cs.campaign_id = p_campaign_id
    LIMIT 1;
  END IF;

  -- central-login 59 (crm-r2-F153/F156): send control needs campaign.send in the campaign's tenant.
  IF v_effective_tenant_id IS NULL
     OR NOT public.has_tenant_permission(v_effective_tenant_id, 'campaign.send', NULL) THEN
    RAISE EXCEPTION 'Campaign sending permission required' USING ERRCODE = '42501';
  END IF;

  -- Authorization: owner or same tenant.
  IF v_campaign_user_id = v_actor_user_id THEN
    -- ok
  ELSIF v_actor_tenant_id IS NOT NULL AND v_effective_tenant_id IS NOT NULL AND v_actor_tenant_id = v_effective_tenant_id THEN
    -- ok
  ELSE
    RETURN;
  END IF;

  -- Mark campaign failed to indicate a terminal user stop.
  UPDATE public.crm_campaigns c
  SET
    status = 'failed',
    failure_reason = v_reason,
    send_error = v_reason,
    send_blocked_reason = v_reason,
    sending_started_at = NULL,
    send_started_at = NULL,
    claim_token = NULL,
    updated_at = now()
  WHERE c.id = p_campaign_id
    AND c.status IN (
      'draft',
      'scheduled',
      'queued',
      'partially_queued',
      'sending',
      'paused',
      'failed'
    );

  -- Fail any not-yet-completed jobs so the worker does not claim them.
  WITH to_stop AS (
    SELECT j.ctid
    FROM public.email_send_jobs j
    WHERE j.campaign_id = p_campaign_id
      AND j.status IN ('pending', 'in_progress', 'paused')
    FOR UPDATE SKIP LOCKED
  ), x AS (
    UPDATE public.email_send_jobs j
    SET
      status = 'failed',
      error_message = v_reason,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE j.ctid IN (SELECT ctid FROM to_stop)
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO jobs_stopped FROM x;

  -- Fail a bounded number of messages per call; never wait on locked rows.
  WITH to_stop AS (
    SELECT m.ctid
    FROM public.email_messages m
    WHERE m.campaign_id = p_campaign_id
      AND m.resend_id IS NULL
      AND m.status IN ('queued', 'sending', 'paused')
    ORDER BY (m.status = 'sending') DESC, m.claimed_at NULLS LAST
    LIMIT v_message_limit
    FOR UPDATE SKIP LOCKED
  ), u AS (
    UPDATE public.email_messages m
    SET
      status = 'failed',
      error_message = v_reason,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE m.ctid IN (SELECT ctid FROM to_stop)
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO messages_stopped FROM u;

  RETURN QUERY SELECT messages_stopped, jobs_stopped;
END;
$function$;

CREATE OR REPLACE FUNCTION public.retry_failed_email_messages(p_campaign_id uuid, p_batch_size integer DEFAULT 200)
 RETURNS TABLE(count_reset integer, jobs_created integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;

  v_campaign_user_id UUID;
  v_campaign_tenant_id UUID;
  v_effective_tenant_id UUID;
  v_domain_id UUID;

  v_base_batch_index INT;
BEGIN
  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT u.tenant_id
  INTO v_actor_tenant_id
  FROM public.users u
  WHERE u.id = v_actor_user_id;

  SELECT c.user_id, c.tenant_id, c.from_email_domain_id
  INTO v_campaign_user_id, v_campaign_tenant_id, v_domain_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL THEN
    RETURN;
  END IF;

  v_effective_tenant_id := v_campaign_tenant_id;

  -- Derive tenant_id from owner if missing.
  IF v_effective_tenant_id IS NULL THEN
    SELECT u.tenant_id
    INTO v_effective_tenant_id
    FROM public.users u
    WHERE u.id = v_campaign_user_id;
  END IF;

  -- Derive tenant_id from segment linkages if still missing.
  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.crm_campaigns c
    JOIN public.crm_segments s ON s.id = c.segment_id
    WHERE c.id = p_campaign_id
    LIMIT 1;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.campaign_segments cs
    JOIN public.crm_segments s ON s.id = cs.segment_id
    WHERE cs.campaign_id = p_campaign_id
    LIMIT 1;
  END IF;

  -- central-login 59 (crm-r2-F153/F156): send control needs campaign.send in the campaign's tenant.
  IF v_effective_tenant_id IS NULL
     OR NOT public.has_tenant_permission(v_effective_tenant_id, 'campaign.send', NULL) THEN
    RAISE EXCEPTION 'Campaign sending permission required' USING ERRCODE = '42501';
  END IF;

  -- Authorization: owner or same tenant.
  IF v_campaign_user_id = v_actor_user_id THEN
    -- ok
  ELSIF v_actor_tenant_id IS NOT NULL AND v_effective_tenant_id IS NOT NULL AND v_actor_tenant_id = v_effective_tenant_id THEN
    -- ok
  ELSE
    RETURN;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF p_batch_size IS NULL OR p_batch_size < 1 THEN
    p_batch_size := 200;
  END IF;

  SELECT COALESCE(MAX(j.batch_index), -1)
  INTO v_base_batch_index
  FROM public.email_send_jobs j
  WHERE j.campaign_id = p_campaign_id;

  WITH failed AS (
    SELECT m.id, m.customer_id, m.email
    FROM public.email_messages m
    WHERE m.campaign_id = p_campaign_id
      AND m.tenant_id = v_effective_tenant_id
      AND m.status = 'failed'
  ),
  updated AS (
    UPDATE public.email_messages m
    SET
      status = 'queued',
      attempts = 0,
      resend_id = NULL,
      error_message = NULL,
      last_attempt_at = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      claim_token = NULL,
      dead_lettered_at = NULL,
      updated_at = now()
    FROM failed f
    WHERE m.id = f.id
    RETURNING m.id, m.customer_id, m.email
  ),
  numbered AS (
    SELECT
      u.id,
      u.customer_id,
      u.email,
      row_number() OVER (ORDER BY u.id) AS rn
    FROM updated u
  ),
  batches AS (
    SELECT
      floor((rn - 1) / p_batch_size)::INT AS batch_group,
      jsonb_agg(
        jsonb_build_object('customerId', customer_id, 'email', email)
        ORDER BY rn
      ) AS recipient_emails,
      array_agg(id ORDER BY rn)::UUID[] AS recipient_message_ids
    FROM numbered
    GROUP BY 1
  ),
  inserted AS (
    INSERT INTO public.email_send_jobs (
      campaign_id,
      tenant_id,
      domain_id,
      status,
      recipient_emails,
      recipient_message_ids,
      batch_index,
      error_message,
      attempts,
      emails_sent,
      emails_failed,
      created_at,
      updated_at
    )
    SELECT
      p_campaign_id,
      v_effective_tenant_id,
      v_domain_id,
      'pending',
      b.recipient_emails,
      b.recipient_message_ids,
      v_base_batch_index + b.batch_group + 1,
      NULL,
      0,
      0,
      0,
      now(),
      now()
    FROM batches b
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*) FROM updated)::INT,
    (SELECT COUNT(*) FROM inserted)::INT
  INTO count_reset, jobs_created;

  IF count_reset > 0 THEN
    UPDATE public.crm_campaigns c
    SET
      status = 'sending',
      send_error = NULL,
      send_blocked_reason = NULL,
      sent_at = NULL,
      send_started_at = COALESCE(c.send_started_at, now()),
      updated_at = now()
    WHERE c.id = p_campaign_id;
  END IF;

  RETURN QUERY SELECT count_reset, jobs_created;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_jobs_for_queued_email_messages(p_campaign_id uuid, p_batch_size integer DEFAULT 200)
 RETURNS TABLE(queued_count integer, jobs_created integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;

  v_campaign_user_id UUID;
  v_campaign_tenant_id UUID;
  v_effective_tenant_id UUID;
  v_domain_id UUID;

  v_base_batch_index INT;
  v_has_active_jobs BOOLEAN;
BEGIN
  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT u.tenant_id
  INTO v_actor_tenant_id
  FROM public.users u
  WHERE u.id = v_actor_user_id;

  SELECT c.user_id, c.tenant_id, c.from_email_domain_id
  INTO v_campaign_user_id, v_campaign_tenant_id, v_domain_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL THEN
    RETURN;
  END IF;

  v_effective_tenant_id := v_campaign_tenant_id;

  -- Derive tenant_id from owner if missing.
  IF v_effective_tenant_id IS NULL THEN
    SELECT u.tenant_id
    INTO v_effective_tenant_id
    FROM public.users u
    WHERE u.id = v_campaign_user_id;
  END IF;

  -- Derive tenant_id from segment linkages if still missing.
  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.crm_campaigns c
    JOIN public.crm_segments s ON s.id = c.segment_id
    WHERE c.id = p_campaign_id
    LIMIT 1;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.campaign_segments cs
    JOIN public.crm_segments s ON s.id = cs.segment_id
    WHERE cs.campaign_id = p_campaign_id
    LIMIT 1;
  END IF;

  -- central-login 59 (crm-r2-F153/F156): send control needs campaign.send in the campaign's tenant.
  IF v_effective_tenant_id IS NULL
     OR NOT public.has_tenant_permission(v_effective_tenant_id, 'campaign.send', NULL) THEN
    RAISE EXCEPTION 'Campaign sending permission required' USING ERRCODE = '42501';
  END IF;

  -- Authorization: owner or same tenant.
  IF v_campaign_user_id = v_actor_user_id THEN
    -- ok
  ELSIF v_actor_tenant_id IS NOT NULL AND v_effective_tenant_id IS NOT NULL AND v_actor_tenant_id = v_effective_tenant_id THEN
    -- ok
  ELSE
    RETURN;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF p_batch_size IS NULL OR p_batch_size < 1 THEN
    p_batch_size := 200;
  END IF;

  SELECT COUNT(*)::INT
  INTO queued_count
  FROM public.email_messages m
  WHERE m.campaign_id = p_campaign_id
    AND m.tenant_id = v_effective_tenant_id
    AND m.status = 'queued';

  IF queued_count = 0 THEN
    jobs_created := 0;
    RETURN QUERY SELECT queued_count, jobs_created;
    RETURN;
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.email_send_jobs j
    WHERE j.campaign_id = p_campaign_id
      AND j.status IN ('pending', 'in_progress')
    LIMIT 1
  )
  INTO v_has_active_jobs;

  -- If jobs already exist, don't create duplicates.
  IF v_has_active_jobs THEN
    jobs_created := 0;
    RETURN QUERY SELECT queued_count, jobs_created;
    RETURN;
  END IF;

  SELECT COALESCE(MAX(j.batch_index), -1)
  INTO v_base_batch_index
  FROM public.email_send_jobs j
  WHERE j.campaign_id = p_campaign_id;

  WITH queued AS (
    SELECT m.id, m.customer_id, m.email
    FROM public.email_messages m
    WHERE m.campaign_id = p_campaign_id
      AND m.tenant_id = v_effective_tenant_id
      AND m.status = 'queued'
  ),
  numbered AS (
    SELECT
      q.id,
      q.customer_id,
      q.email,
      row_number() OVER (ORDER BY q.id) AS rn
    FROM queued q
  ),
  batches AS (
    SELECT
      floor((rn - 1) / p_batch_size)::INT AS batch_group,
      jsonb_agg(
        jsonb_build_object('customerId', customer_id, 'email', email)
        ORDER BY rn
      ) AS recipient_emails,
      array_agg(id ORDER BY rn)::UUID[] AS recipient_message_ids
    FROM numbered
    GROUP BY 1
  ),
  inserted AS (
    INSERT INTO public.email_send_jobs (
      campaign_id,
      tenant_id,
      domain_id,
      status,
      recipient_emails,
      recipient_message_ids,
      batch_index,
      error_message,
      attempts,
      emails_sent,
      emails_failed,
      created_at,
      updated_at
    )
    SELECT
      p_campaign_id,
      v_effective_tenant_id,
      v_domain_id,
      'pending',
      b.recipient_emails,
      b.recipient_message_ids,
      v_base_batch_index + b.batch_group + 1,
      NULL,
      0,
      0,
      0,
      now(),
      now()
    FROM batches b
    RETURNING 1
  )
  SELECT (SELECT COUNT(*) FROM inserted)::INT
  INTO jobs_created;

  -- Nudge the campaign back into a sendable status when we (re)create work.
  IF jobs_created > 0 THEN
    UPDATE public.crm_campaigns c
    SET
      status = 'sending',
      send_error = NULL,
      send_blocked_reason = NULL,
      send_started_at = COALESCE(c.send_started_at, now()),
      updated_at = now()
    WHERE c.id = p_campaign_id;
  END IF;

  RETURN QUERY SELECT queued_count, jobs_created;
END;
$function$;

CREATE OR REPLACE FUNCTION public.retry_campaign_recipient_message(p_campaign_id uuid, p_recipient_id uuid)
 RETURNS TABLE(retry_message_id uuid, jobs_created integer, blocked_reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;
  v_campaign_user_id UUID;
  v_campaign_tenant_id UUID;
  v_effective_tenant_id UUID;
  v_domain_id UUID;
  v_base_message_id UUID;
  v_customer_id UUID;
  v_email TEXT;
  v_payload JSONB;
  v_last_status TEXT;
  v_retry_count INTEGER := 0;
  v_has_bounce BOOLEAN := FALSE;
  v_batch_index INTEGER := 0;
BEGIN
  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, 0, 'unauthorized'::TEXT;
    RETURN;
  END IF;

  SELECT u.tenant_id
  INTO v_actor_tenant_id
  FROM public.users u
  WHERE u.id = v_actor_user_id;

  SELECT c.user_id, c.tenant_id, c.from_email_domain_id
  INTO v_campaign_user_id, v_campaign_tenant_id, v_domain_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL AND v_campaign_tenant_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, 0, 'not_found'::TEXT;
    RETURN;
  END IF;

  v_effective_tenant_id := v_campaign_tenant_id;

  IF v_effective_tenant_id IS NULL AND v_campaign_user_id IS NOT NULL THEN
    SELECT u.tenant_id
    INTO v_effective_tenant_id
    FROM public.users u
    WHERE u.id = v_campaign_user_id;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.crm_campaigns c
    JOIN public.crm_segments s ON s.id = c.segment_id
    WHERE c.id = p_campaign_id
    LIMIT 1;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.campaign_segments cs
    JOIN public.crm_segments s ON s.id = cs.segment_id
    WHERE cs.campaign_id = p_campaign_id
    LIMIT 1;
  END IF;

  -- central-login 59 (crm-r2-F153/F156): send control needs campaign.send in the campaign's tenant.
  IF v_effective_tenant_id IS NULL
     OR NOT public.has_tenant_permission(v_effective_tenant_id, 'campaign.send', NULL) THEN
    RAISE EXCEPTION 'Campaign sending permission required' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    v_campaign_user_id = v_actor_user_id
    OR (
      v_actor_tenant_id IS NOT NULL
      AND v_effective_tenant_id IS NOT NULL
      AND v_actor_tenant_id = v_effective_tenant_id
    )
  ) THEN
    RETURN QUERY SELECT NULL::UUID, 0, 'forbidden'::TEXT;
    RETURN;
  END IF;

  SELECT
    m.id,
    m.customer_id,
    m.email,
    m.payload
  INTO v_base_message_id, v_customer_id, v_email, v_payload
  FROM public.email_messages m
  WHERE m.id = p_recipient_id
    AND m.campaign_id = p_campaign_id
    AND m.tenant_id = v_effective_tenant_id
    AND m.retry_sequence = 0
  LIMIT 1;

  IF v_base_message_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, 0, 'not_found'::TEXT;
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_retry_count
  FROM public.email_messages m
  WHERE m.campaign_id = p_campaign_id
    AND m.tenant_id = v_effective_tenant_id
    AND m.customer_id = v_customer_id
    AND m.retry_sequence > 0;

  IF v_retry_count > 0 THEN
    RETURN QUERY SELECT NULL::UUID, 0, 'already_retried'::TEXT;
    RETURN;
  END IF;

  SELECT m.status
  INTO v_last_status
  FROM public.email_messages m
  WHERE m.campaign_id = p_campaign_id
    AND m.tenant_id = v_effective_tenant_id
    AND m.customer_id = v_customer_id
  ORDER BY m.retry_sequence DESC, m.created_at DESC, m.id DESC
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM public.email_tracking_events e
    WHERE e.campaign_id = p_campaign_id
      AND e.tenant_id = v_effective_tenant_id
      AND LOWER(e.customer_email) = LOWER(v_email)
      AND e.event_type IN ('bounce', 'bounced')
  )
  INTO v_has_bounce;

  IF COALESCE(v_last_status, '') <> 'failed' AND NOT v_has_bounce THEN
    RETURN QUERY SELECT NULL::UUID, 0, 'not_retryable'::TEXT;
    RETURN;
  END IF;

  SELECT COALESCE(MAX(j.batch_index), -1) + 1
  INTO v_batch_index
  FROM public.email_send_jobs j
  WHERE j.campaign_id = p_campaign_id;

  INSERT INTO public.email_messages (
    tenant_id,
    campaign_id,
    customer_id,
    domain_id,
    email,
    payload,
    status,
    resend_id,
    attempts,
    last_attempt_at,
    sent_at,
    error_message,
    claimed_at,
    claimed_by,
    claim_token,
    dead_lettered_at,
    retry_sequence,
    retry_of_message_id,
    retried_at
  )
  VALUES (
    v_effective_tenant_id,
    p_campaign_id,
    v_customer_id,
    v_domain_id,
    v_email,
    COALESCE(v_payload, '{}'::jsonb),
    'queued',
    NULL,
    0,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    1,
    v_base_message_id,
    NOW()
  )
  RETURNING id INTO retry_message_id;

  INSERT INTO public.email_send_jobs (
    campaign_id,
    tenant_id,
    domain_id,
    status,
    recipient_emails,
    recipient_message_ids,
    batch_index,
    error_message,
    attempts,
    emails_sent,
    emails_failed,
    created_at,
    updated_at
  )
  VALUES (
    p_campaign_id,
    v_effective_tenant_id,
    v_domain_id,
    'pending',
    jsonb_build_array(jsonb_build_object('customerId', v_customer_id, 'email', v_email)),
    ARRAY[retry_message_id],
    v_batch_index,
    NULL,
    0,
    0,
    0,
    NOW(),
    NOW()
  );

  UPDATE public.crm_campaigns c
  SET
    status = CASE WHEN c.status IN ('sent', 'failed', 'sent_with_errors') THEN 'sending' ELSE c.status END,
    send_error = NULL,
    send_blocked_reason = NULL,
    updated_at = NOW()
  WHERE c.id = p_campaign_id;

  jobs_created := 1;
  blocked_reason := NULL;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_jobs_for_queued_email_messages(p_campaign_id uuid, p_batch_size integer DEFAULT 200, p_jobs_per_minute integer DEFAULT 6, p_immediate_job_count integer DEFAULT 6, p_activate_sending boolean DEFAULT true)
 RETURNS TABLE(queued_count integer, jobs_created integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_user_id uuid;
  v_actor_tenant_id uuid;

  v_campaign_user_id uuid;
  v_campaign_tenant_id uuid;
  v_effective_tenant_id uuid;
  v_domain_id uuid;

  v_base_batch_index integer;
  v_jobs_per_minute integer := GREATEST(COALESCE(p_jobs_per_minute, 1), 1);
  v_immediate_job_count integer := GREATEST(COALESCE(p_immediate_job_count, 0), 0);
  v_now timestamptz := now();
BEGIN
  SELECT c.user_id, c.tenant_id, c.from_email_domain_id
  INTO v_campaign_user_id, v_campaign_tenant_id, v_domain_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL AND v_campaign_tenant_id IS NULL THEN
    RETURN;
  END IF;

  -- central-login 59 (crm-r2-F175): inside this SECURITY DEFINER body current_user is always the owner, so the
  -- internal callers are told apart by the request: the service role, or owner-run work with no JWT claims.
  IF coalesce(auth.role(), '') NOT IN ('service_role', '') THEN
    v_actor_user_id := auth.uid();
    IF v_actor_user_id IS NULL THEN
      RETURN;
    END IF;

    SELECT u.tenant_id
    INTO v_actor_tenant_id
    FROM public.users u
    WHERE u.id = v_actor_user_id;

    v_effective_tenant_id := v_campaign_tenant_id;

    IF v_effective_tenant_id IS NULL AND v_campaign_user_id IS NOT NULL THEN
      SELECT u.tenant_id
      INTO v_effective_tenant_id
      FROM public.users u
      WHERE u.id = v_campaign_user_id;
    END IF;

    IF v_effective_tenant_id IS NULL THEN
      SELECT s.tenant_id
      INTO v_effective_tenant_id
      FROM public.crm_campaigns c
      JOIN public.crm_segments s ON s.id = c.segment_id
      WHERE c.id = p_campaign_id
      LIMIT 1;
    END IF;

    IF v_effective_tenant_id IS NULL THEN
      SELECT s.tenant_id
      INTO v_effective_tenant_id
      FROM public.campaign_segments cs
      JOIN public.crm_segments s ON s.id = cs.segment_id
      WHERE cs.campaign_id = p_campaign_id
      LIMIT 1;
    END IF;

    IF v_effective_tenant_id IS NULL
       OR NOT public.has_tenant_permission(v_effective_tenant_id, 'campaign.send', NULL) THEN
      RAISE EXCEPTION 'Campaign sending permission required' USING ERRCODE = '42501';
    END IF;

    IF v_campaign_user_id = v_actor_user_id THEN
      NULL;
    ELSIF v_actor_tenant_id IS NOT NULL
      AND v_effective_tenant_id IS NOT NULL
      AND v_actor_tenant_id = v_effective_tenant_id THEN
      NULL;
    ELSE
      RETURN;
    END IF;
  ELSE
    v_effective_tenant_id := v_campaign_tenant_id;

    IF v_effective_tenant_id IS NULL AND v_campaign_user_id IS NOT NULL THEN
      SELECT u.tenant_id
      INTO v_effective_tenant_id
      FROM public.users u
      WHERE u.id = v_campaign_user_id;
    END IF;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF p_batch_size IS NULL OR p_batch_size < 1 THEN
    p_batch_size := 200;
  END IF;

  SELECT COUNT(*)::integer
  INTO queued_count
  FROM public.email_messages m
  WHERE m.campaign_id = p_campaign_id
    AND m.tenant_id = v_effective_tenant_id
    AND m.status = 'queued';

  IF queued_count = 0 THEN
    jobs_created := 0;
    RETURN QUERY SELECT queued_count, jobs_created;
    RETURN;
  END IF;

  SELECT COALESCE(MAX(j.batch_index), -1)
  INTO v_base_batch_index
  FROM public.email_send_jobs j
  WHERE j.campaign_id = p_campaign_id;

  WITH unjobbed AS (
    SELECT
      m.id,
      m.customer_id,
      m.email,
      row_number() OVER (ORDER BY m.id) AS rn
    FROM public.email_messages m
    WHERE m.campaign_id = p_campaign_id
      AND m.tenant_id = v_effective_tenant_id
      AND m.status = 'queued'
      AND NOT EXISTS (
        SELECT 1
        FROM public.email_send_jobs j
        WHERE j.campaign_id = p_campaign_id
          AND m.id = ANY(COALESCE(j.recipient_message_ids, ARRAY[]::uuid[]))
      )
  ),
  batches AS (
    SELECT
      floor((rn - 1)::numeric / p_batch_size)::integer AS batch_group,
      jsonb_agg(
        jsonb_build_object('customerId', customer_id, 'email', email)
        ORDER BY rn
      ) AS recipient_emails,
      array_agg(id ORDER BY rn)::uuid[] AS recipient_message_ids
    FROM unjobbed
    GROUP BY 1
  ),
  inserted AS (
    INSERT INTO public.email_send_jobs (
      campaign_id,
      tenant_id,
      domain_id,
      status,
      recipient_emails,
      recipient_message_ids,
      batch_index,
      available_at,
      error_message,
      attempts,
      emails_sent,
      emails_failed,
      created_at,
      updated_at
    )
    SELECT
      p_campaign_id,
      v_effective_tenant_id,
      v_domain_id,
      'pending',
      b.recipient_emails,
      b.recipient_message_ids,
      v_base_batch_index + b.batch_group + 1,
      CASE
        WHEN b.batch_group < v_immediate_job_count THEN v_now
        ELSE v_now + make_interval(
          secs => (
            floor((b.batch_group - v_immediate_job_count)::numeric / v_jobs_per_minute) * 60
            + floor(mod((b.batch_group - v_immediate_job_count)::numeric, v_jobs_per_minute::numeric) * (60.0 / v_jobs_per_minute))
          )::integer
        )
      END,
      NULL,
      0,
      0,
      0,
      v_now,
      v_now
    FROM batches b
    ON CONFLICT (campaign_id, batch_index) DO NOTHING
    RETURNING 1
  )
  SELECT COALESCE(COUNT(*), 0)::integer
  INTO jobs_created
  FROM inserted;

  IF jobs_created > 0 AND COALESCE(p_activate_sending, true) THEN
    UPDATE public.crm_campaigns c
    SET
      status = CASE
        WHEN c.status IN ('queued', 'partially_queued', 'paused') THEN 'sending'
        ELSE c.status
      END,
      send_error = NULL,
      send_blocked_reason = NULL,
      send_started_at = COALESCE(c.send_started_at, v_now),
      worker_heartbeat_at = v_now,
      updated_at = v_now
    WHERE c.id = p_campaign_id;
  END IF;

  RETURN QUERY SELECT queued_count, jobs_created;
END;
$function$;

-- =================================================================================================================
-- 15. crm-r2-F161: campaign-keyed definer reads answered any signed-in caller for any tenant's campaign. Every caller in
-- code is a service-role client (send-email-campaign, resend-missed-recipients, process-email-send-queue,
-- force-send-campaign) and no browser code calls them, so EXECUTE leaves the API roles (the crm-r1-F34 pattern,
-- 20261110230100). Definer callers run as the owner and keep working.
REVOKE EXECUTE ON FUNCTION public.get_campaign_reputation_policy(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_campaign_intervention_state(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_campaign_projected_recipient_count(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.evaluate_campaign_batch_safety(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_reputation_policy(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_campaign_intervention_state(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.compute_campaign_projected_recipient_count(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_campaign_batch_safety(uuid) TO service_role;

-- =================================================================================================================
-- 16. crm-r2-F160 + the direct-RPC half of crm-r2-F54: the domain-keyed warmup and deliverability definers are worker
-- internals (get-deliverability-status and listHygieneAnalyzer call them with the service role; claim_email_send_job_ids
-- runs as the owner). The three warmup functions exist only in an environment built from source (absent on hosted and
-- on the local stack), hence the guard. The Edge Function half of F54 (caller check in get-deliverability-status and
-- domain-health-check) is a code change (another pack).
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.maybe_advance_domain_warmup(uuid,timestamptz)',
    'public.get_domain_warmup_daily_cap(uuid,timestamptz)',
    'public.get_domain_warmup_reserved_today(uuid,timestamptz)'
  ] LOOP
    IF to_regprocedure(f) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', to_regprocedure(f));
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', to_regprocedure(f));
    END IF;
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_domain_remaining_limit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_deliverability_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_domain_remaining_limit(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_deliverability_status(uuid) TO service_role;

-- =================================================================================================================
-- 17. crm-r2-F166: any member (staff included) could set or clear the tenant's default sending domain. Only the
-- tenant's owner or admin, or a master admin, may now (the tenants update rule of 20261112093000:13-42).

CREATE OR REPLACE FUNCTION public.set_tenant_default_from_email_domain(p_domain_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_tenant_id UUID;
  v_user_role TEXT;
  v_domain_tenant_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT u.tenant_id, u.role
  INTO v_user_tenant_id, v_user_role
  FROM public.users u
  WHERE u.id = auth.uid();

  IF v_user_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User is not assigned to a tenant' USING ERRCODE = '23514';
  END IF;

  -- central-login 59 (crm-r2-F166): the default sending domain belongs to the tenant's owner or admin.
  IF NOT (coalesce(v_user_role IN ('owner', 'admin'), false) OR coalesce(public.is_master_admin(auth.uid()), false)) THEN
    RAISE EXCEPTION 'Only a tenant owner or admin can change the default sending domain' USING ERRCODE = '42501';
  END IF;

  -- Allow clearing the default
  IF p_domain_id IS NULL THEN
    UPDATE public.tenants
    SET default_from_email_domain_id = NULL
    WHERE id = v_user_tenant_id;
    RETURN;
  END IF;

  SELECT d.tenant_id
  INTO v_domain_tenant_id
  FROM public.email_domains d
  WHERE d.id = p_domain_id;

  IF v_domain_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Email domain not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_domain_tenant_id <> v_user_tenant_id THEN
    RAISE EXCEPTION 'Email domain does not belong to your tenant' USING ERRCODE = '42501';
  END IF;

  UPDATE public.tenants
  SET default_from_email_domain_id = p_domain_id
  WHERE id = v_user_tenant_id;
END;
$function$;

-- =================================================================================================================
-- 18. crm-r2-F190 (check_send_quota part): the send gate handed back the domain row's default_from_email even when that
-- address was on another domain (for example another tenant's verified domain). A From address is used only when it is
-- on the row's own domain; otherwise the existing 'mail@<domain>' fallback applies. The email_domains write guard and
-- senderResolver.ts are other packs' changes.

CREATE OR REPLACE FUNCTION public.check_send_quota(p_tenant_id uuid, p_domain_id uuid, p_recipient_count integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_result jsonb;
  v_domain public.email_domains%ROWTYPE;
  v_actor_id uuid := auth.uid();
  v_provider_verified boolean := false;
  v_spf_ok boolean := false;
  v_dkim_ok boolean := false;
  v_return_path_ok boolean := false;
  v_dmarc_ok boolean := false;
  v_core_authenticated boolean := false;
  v_high_volume boolean := COALESCE(p_recipient_count, 0) > 50000;
  v_compliance jsonb;
  v_warnings jsonb;
BEGIN
  IF v_actor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.users AS app_user
    WHERE app_user.id = v_actor_id
      AND app_user.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Tenant access denied' USING ERRCODE = '42501';
  END IF;

  v_result := public.check_send_quota_with_legacy_domain_policy(
    p_tenant_id,
    p_domain_id,
    p_recipient_count
  );

  IF NOT COALESCE((v_result ->> 'allowed')::boolean, false) THEN
    RETURN v_result;
  END IF;

  IF p_domain_id IS NULL THEN
    RETURN v_result || jsonb_build_object(
      'allowed', false,
      'reason', 'sender_domain_required',
      'message', 'Campaign sending requires a configured verified sending domain.'
    );
  END IF;

  SELECT * INTO v_domain
  FROM public.email_domains AS d
  WHERE d.id = p_domain_id
    AND d.tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN v_result || jsonb_build_object(
      'allowed', false,
      'reason', 'domain_not_found',
      'message', 'Sending domain not found.'
    );
  END IF;

  v_provider_verified :=
    v_domain.status IN ('active', 'warming_up')
    AND v_domain.verified_at IS NOT NULL
    AND lower(COALESCE(v_domain.resend_status ->> 'status', '')) = 'verified';
  v_spf_ok := COALESCE((v_domain.resend_status ->> 'spf_verified')::boolean, false);
  v_dkim_ok := COALESCE((v_domain.resend_status ->> 'dkim_verified')::boolean, false);
  v_return_path_ok := COALESCE((v_domain.resend_status ->> 'return_path_verified')::boolean, false);
  v_dmarc_ok := COALESCE((v_domain.resend_status ->> 'dmarc_verified')::boolean, false);
  v_core_authenticated :=
    v_provider_verified AND v_spf_ok AND v_dkim_ok AND v_return_path_ok;

  v_compliance := COALESCE(v_result -> 'compliance', '{}'::jsonb) ||
    jsonb_build_object(
      'high_volume', v_high_volume,
      'authenticated_for_scale', v_core_authenticated AND (NOT v_high_volume OR v_dmarc_ok),
      'provider_verified', v_provider_verified,
      'spf_ok', v_spf_ok,
      'dkim_ok', v_dkim_ok,
      'return_path_ok', v_return_path_ok,
      'dmarc_ok', v_dmarc_ok,
      'ownership_ok', v_provider_verified
    );

  v_result := v_result || jsonb_build_object(
    'compliance', v_compliance,
    'sender', COALESCE(v_result -> 'sender', '{}'::jsonb) || jsonb_build_object(
      'from_name', COALESCE(
        NULLIF(v_result -> 'sender' ->> 'from_name', ''),
        v_domain.default_from_name
      ),
      'from_email', COALESCE(
        CASE WHEN lower(split_part(btrim(NULLIF(v_result -> 'sender' ->> 'from_email', '')), '@', 2)) = lower(btrim(v_domain.domain))
          THEN NULLIF(v_result -> 'sender' ->> 'from_email', '') END,
        CASE WHEN lower(split_part(btrim(v_domain.default_from_email), '@', 2)) = lower(btrim(v_domain.domain))
          THEN v_domain.default_from_email END,
        'mail@' || v_domain.domain
      )
    )
  );

  IF NOT v_core_authenticated THEN
    RETURN v_result || jsonb_build_object(
      'allowed', false,
      'reason', 'domain_authentication_incomplete',
      'message', 'Campaign sending requires a provider-verified domain with verified SPF, DKIM, and return-path records.'
    );
  END IF;

  IF v_high_volume AND NOT v_dmarc_ok THEN
    RETURN v_result || jsonb_build_object(
      'allowed', false,
      'reason', 'dmarc_required_for_high_volume',
      'message', 'High-volume campaign sending requires a verified DMARC policy (p=none minimum).'
    );
  END IF;

  IF NOT v_dmarc_ok THEN
    v_warnings := COALESCE(v_result -> 'warnings', '[]'::jsonb);
    IF jsonb_typeof(v_warnings) <> 'array' THEN
      v_warnings := '[]'::jsonb;
    END IF;
    v_result := v_result || jsonb_build_object(
      'warnings', v_warnings || jsonb_build_array(
        'DMARC is not yet verified. Sending is allowed at normal volume, but adding DMARC is strongly recommended for deliverability and spoofing protection.'
      )
    );
  END IF;

  RETURN v_result || jsonb_build_object('allowed', true);
END;
$function$;

-- =================================================================================================================
-- 19. crm-r2-F184: apply_mta_inbound_sms applied STOP/START to whatever customer a stored sms_messages row named,
-- without checking that the customer owns the replying number (and the externalId row's tenant was never compared with
-- the customer's). A stored row now resolves a customer only when that customer is live, sits in the row's tenant and
-- its phone has the replying number's digits (the check_sms_send_eligibility normalisation); otherwise resolution
-- falls through to the existing phone-bound step. The digit pattern '\\D' matched a literal backslash-D and stripped
-- nothing; it becomes '[^0-9]'.

CREATE OR REPLACE FUNCTION public.apply_mta_inbound_sms(p_reply jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_reply_id text := nullif(trim(p_reply->>'providerReplyId'), '');
  v_from text := nullif(trim(p_reply->>'fromNumber'), '');
  v_to text := nullif(trim(p_reply->>'toNumber'), '');
  v_external_id text := nullif(trim(p_reply->>'externalId'), '');
  v_message text := nullif(trim(p_reply->>'message'), '');
  v_media_url text := nullif(trim(p_reply->>'mediaUrl'), '');
  v_keyword text := lower(coalesce(nullif(trim(p_reply->>'keyword'), ''), 'reply'));
  v_occurred_at timestamptz := now();
  v_customer_id uuid;
  v_tenant_id uuid;
  v_last_sent_at timestamptz;
  v_phone_customers uuid[];
  v_routed_customers uuid[];
  v_target_customers uuid[];
  v_target_customer_id uuid;
  v_inbound_id uuid;
  v_resolution text := 'unmatched';
  v_was_opted_in boolean;
  v_queued_failed integer := 0;
  v_failed_this_customer integer := 0;
  v_target_count integer := 0;
BEGIN
  IF v_reply_id IS NULL OR v_from IS NULL OR v_message IS NULL THEN
    RAISE EXCEPTION 'providerReplyId, fromNumber, and message are required';
  END IF;
  IF v_keyword NOT IN ('stop', 'start', 'help', 'reply') THEN
    RAISE EXCEPTION 'unsupported SMS keyword classification';
  END IF;
  IF nullif(p_reply->>'occurredAt', '') IS NOT NULL THEN
    BEGIN
      v_occurred_at := (p_reply->>'occurredAt')::timestamptz;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      v_occurred_at := now();
    END;
  END IF;

  -- externalId is sms_messages.id for all new BloomSuite sends.
  IF v_external_id IS NOT NULL THEN
    SELECT m.customer_id, m.tenant_id, m.sent_at
      INTO v_customer_id, v_tenant_id, v_last_sent_at
    FROM public.sms_messages m
    JOIN public.crm_customers c
      ON c.id = m.customer_id
     AND c.tenant_id = m.tenant_id
     AND c.deleted_at IS NULL
     AND c.merged_into_customer_id IS NULL
     AND right(regexp_replace(c.phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(v_from, '[^0-9]', '', 'g'), 10)
    WHERE m.provider = 'mobile_text_alerts'
      AND m.id::text = v_external_id
      AND m.customer_id IS NOT NULL
    LIMIT 1;
    IF FOUND THEN v_resolution := 'external_id'; END IF;
  END IF;

  -- If an older provider message has no externalId, require the recent
  -- outbound route to resolve to exactly one customer.
  IF v_customer_id IS NULL THEN
    SELECT array_agg(x.customer_id ORDER BY x.last_sent_at DESC)
      INTO v_routed_customers
    FROM (
      SELECT m.customer_id, max(m.sent_at) AS last_sent_at
      FROM public.sms_messages m
      JOIN public.crm_customers c
        ON c.id = m.customer_id
       AND c.deleted_at IS NULL
       AND c.merged_into_customer_id IS NULL
       AND right(regexp_replace(c.phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(v_from, '[^0-9]', '', 'g'), 10)
      WHERE m.provider = 'mobile_text_alerts'
        AND m.customer_id IS NOT NULL
        AND right(regexp_replace(m.phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(v_from, '[^0-9]', '', 'g'), 10)
        AND (
          v_to IS NULL OR m.from_phone IS NULL OR
          right(regexp_replace(m.from_phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(v_to, '[^0-9]', '', 'g'), 10)
        )
      GROUP BY m.customer_id
    ) x;

    IF coalesce(cardinality(v_routed_customers), 0) = 1 THEN
      v_customer_id := v_routed_customers[1];
      SELECT c.tenant_id INTO v_tenant_id FROM public.crm_customers c WHERE c.id = v_customer_id;
      SELECT max(m.sent_at) INTO v_last_sent_at
      FROM public.sms_messages m WHERE m.customer_id = v_customer_id;
      v_resolution := 'outbound_route';
    ELSIF coalesce(cardinality(v_routed_customers), 0) > 1 THEN
      v_resolution := 'ambiguous_outbound_route';
    END IF;
  END IF;

  SELECT array_agg(c.id ORDER BY c.created_at)
    INTO v_phone_customers
  FROM public.crm_customers c
  WHERE c.deleted_at IS NULL
    AND c.merged_into_customer_id IS NULL
    AND nullif(regexp_replace(c.phone, '[^0-9]', '', 'g'), '') IS NOT NULL
    AND right(regexp_replace(c.phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(v_from, '[^0-9]', '', 'g'), 10);

  IF v_customer_id IS NULL AND coalesce(cardinality(v_phone_customers), 0) = 1 THEN
    v_customer_id := v_phone_customers[1];
    SELECT c.tenant_id INTO v_tenant_id FROM public.crm_customers c WHERE c.id = v_customer_id;
    v_resolution := 'unique_phone';
  ELSIF v_customer_id IS NULL AND coalesce(cardinality(v_phone_customers), 0) > 1 THEN
    v_resolution := 'ambiguous_phone';
  END IF;

  INSERT INTO public.sms_inbound_messages (
    tenant_id, customer_id, provider, provider_reply_id, external_id,
    from_phone, to_phone, message_content, media_url, received_at, keyword, resolution
  ) VALUES (
    v_tenant_id, v_customer_id, 'mobile_text_alerts', v_reply_id, v_external_id,
    v_from, v_to, v_message, v_media_url, v_occurred_at, v_keyword, v_resolution
  )
  ON CONFLICT (provider, provider_reply_id) DO NOTHING
  RETURNING id INTO v_inbound_id;

  IF v_inbound_id IS NULL THEN
    RETURN jsonb_build_object('duplicate', true, 'providerReplyId', v_reply_id);
  END IF;

  IF v_customer_id IS NOT NULL THEN
    v_target_customers := ARRAY[v_customer_id];
  ELSIF v_keyword = 'stop' THEN
    -- STOP fails safe across tenants when a number is genuinely ambiguous.
    v_target_customers := coalesce(v_phone_customers, ARRAY[]::uuid[]);
  ELSE
    v_target_customers := ARRAY[]::uuid[];
  END IF;

  FOREACH v_target_customer_id IN ARRAY v_target_customers
  LOOP
    SELECT c.tenant_id,
           coalesce(c.sms_opt_in, false) OR coalesce(c.sms_consent, false) OR
           EXISTS (
             SELECT 1 FROM public.customer_consents cc
             WHERE cc.customer_id = c.id AND cc.channel = 'sms' AND cc.status = 'opted_in'
           )
      INTO v_tenant_id, v_was_opted_in
    FROM public.crm_customers c
    WHERE c.id = v_target_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN CONTINUE; END IF;
    v_target_count := v_target_count + 1;

    IF v_keyword = 'stop' THEN
      UPDATE public.crm_customers
      SET sms_opt_in = false,
          sms_consent = false,
          sms_opt_out_at = v_occurred_at,
          sms_consent_source = 'mta_webhook',
          sms_consent_method = 'keyword_stop',
          updated_at = now()
      WHERE id = v_target_customer_id;

      INSERT INTO public.customer_consents (customer_id, channel, status, consent_timestamp, created_at, updated_at)
      VALUES (v_target_customer_id, 'sms', 'opted_out', v_occurred_at, now(), now())
      ON CONFLICT (customer_id, channel) DO UPDATE
      SET status = 'opted_out', consent_timestamp = excluded.consent_timestamp, updated_at = now();

      INSERT INTO public.crm_sms_consent_events (tenant_id, customer_id, phone, event_type, source, created_at)
      VALUES (v_tenant_id, v_target_customer_id, v_from, 'opt_out', 'mta_webhook', v_occurred_at);

      INSERT INTO public.sms_compliance_events (
        tenant_id, customer_id, phone, event_type, message_content, source, twilio_sid, metadata, created_at
      ) VALUES (
        v_tenant_id, v_target_customer_id, v_from, 'STOP', v_message,
        'inbound_sms', v_reply_id, jsonb_build_object('provider', 'mobile_text_alerts', 'to', v_to), v_occurred_at
      );

      INSERT INTO public.customer_timeline (customer_id, tenant_id, activity_type, metadata, created_at, updated_at)
      VALUES (
        v_target_customer_id, v_tenant_id, 'sms_opt_out',
        jsonb_build_object('source', 'mta_webhook', 'provider_reply_id', v_reply_id),
        v_occurred_at, now()
      );

      WITH failed AS (
        UPDATE public.sms_messages
        SET status = 'failed',
            failure_type = 'compliance',
            error_code = 'SMS_OPTED_OUT',
            error_message = 'Recipient opted out by SMS keyword',
            dead_lettered_at = now(),
            updated_at = now()
        WHERE customer_id = v_target_customer_id AND status = 'queued'
        RETURNING 1
      ) SELECT count(*)::integer INTO v_failed_this_customer FROM failed;
      v_queued_failed := v_queued_failed + v_failed_this_customer;

      IF v_was_opted_in THEN
        PERFORM public.update_customer_sms_metrics(v_target_customer_id, 'opt_out');
      END IF;

    ELSIF v_keyword = 'start' THEN
      UPDATE public.crm_customers
      SET sms_opt_in = true,
          sms_consent = true,
          sms_opt_in_at = v_occurred_at,
          sms_opt_out_at = NULL,
          sms_consent_source = 'mta_webhook',
          sms_consent_method = 'keyword_start',
          sms_consent_details = coalesce(sms_consent_details, '{}'::jsonb) ||
            jsonb_build_object('captured_at', v_occurred_at, 'keyword', upper(v_message)),
          updated_at = now()
      WHERE id = v_target_customer_id;

      INSERT INTO public.customer_consents (customer_id, channel, status, consent_timestamp, created_at, updated_at)
      VALUES (v_target_customer_id, 'sms', 'opted_in', v_occurred_at, now(), now())
      ON CONFLICT (customer_id, channel) DO UPDATE
      SET status = 'opted_in', consent_timestamp = excluded.consent_timestamp, updated_at = now();

      INSERT INTO public.crm_sms_consent_events (tenant_id, customer_id, phone, event_type, source, created_at)
      VALUES (v_tenant_id, v_target_customer_id, v_from, 'opt_in', 'mta_webhook', v_occurred_at);

      INSERT INTO public.sms_compliance_events (
        tenant_id, customer_id, phone, event_type, message_content, source, twilio_sid, metadata, created_at
      ) VALUES (
        v_tenant_id, v_target_customer_id, v_from, 'START', v_message,
        'inbound_sms', v_reply_id, jsonb_build_object('provider', 'mobile_text_alerts', 'to', v_to), v_occurred_at
      );

      INSERT INTO public.customer_timeline (customer_id, tenant_id, activity_type, metadata, created_at, updated_at)
      VALUES (
        v_target_customer_id, v_tenant_id, 'sms_opt_in',
        jsonb_build_object('source', 'mta_webhook', 'provider_reply_id', v_reply_id),
        v_occurred_at, now()
      );

    ELSE
      IF v_keyword = 'help' THEN
        INSERT INTO public.sms_compliance_events (
          tenant_id, customer_id, phone, event_type, message_content, source, twilio_sid, metadata, created_at
        ) VALUES (
          v_tenant_id, v_target_customer_id, v_from, 'HELP', v_message,
          'inbound_sms', v_reply_id, jsonb_build_object('provider', 'mobile_text_alerts', 'to', v_to), v_occurred_at
        );
      END IF;

      INSERT INTO public.customer_timeline (customer_id, tenant_id, activity_type, metadata, created_at, updated_at)
      VALUES (
        v_target_customer_id, v_tenant_id, 'sms_received',
        jsonb_build_object('source', 'mta_webhook', 'provider_reply_id', v_reply_id, 'keyword', v_keyword),
        v_occurred_at, now()
      );

      PERFORM public.update_customer_sms_metrics(
        v_target_customer_id, 'replied', v_last_sent_at, v_occurred_at
      );
      PERFORM public.update_cross_channel_metrics(v_target_customer_id, 'sms', 'replied');
    END IF;
  END LOOP;

  IF v_target_count = 0 AND v_keyword IN ('stop', 'help') THEN
    INSERT INTO public.sms_compliance_events (
      tenant_id, customer_id, phone, event_type, message_content, source, twilio_sid, metadata, created_at
    ) VALUES (
      NULL, NULL, v_from, upper(v_keyword), v_message,
      'inbound_sms', v_reply_id,
      jsonb_build_object('provider', 'mobile_text_alerts', 'to', v_to, 'resolution', v_resolution),
      v_occurred_at
    );
  END IF;

  RETURN jsonb_build_object(
    'duplicate', false,
    'inboundMessageId', v_inbound_id,
    'resolution', v_resolution,
    'matchedCustomers', v_target_count,
    'queuedMessagesFailed', v_queued_failed
  );
END;
$function$;
