-- workspace-qa3 #3: the customer record's activity timeline.
-- * Adds customer_timeline rows (imported/seeded activity) so the record is
--   not empty while the Activity Center shows purchases.
-- * Purchases come from pos_orders linked by crm_customer_id (the POS detail
--   behind the crm_customers rollups), with the legacy pos_customers
--   email/phone match kept for unlinked orders, scoped to the customer's
--   tenant (the old join could match another tenant's orders by email).
-- * Adds the tenant guard this SECURITY DEFINER function was missing.
CREATE OR REPLACE FUNCTION public.get_customer_unified_timeline(
  p_customer_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_event_types text[] DEFAULT NULL::text[]
)
RETURNS TABLE(id uuid, event_type text, event_category text, title text, description text, impact text, metadata jsonb, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_email text;
  v_phone text;
BEGIN
  SELECT c.tenant_id, nullif(btrim(c.email), ''), nullif(btrim(c.phone), '')
  INTO v_tenant_id, v_email, v_phone
  FROM crm_customers c
  WHERE c.id = p_customer_id;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.assert_tenant_access(v_tenant_id);

  RETURN QUERY
  WITH all_events AS (
    -- Purchases from POS orders
    SELECT
      po.id,
      'purchase'::TEXT AS event_type,
      'purchase'::TEXT AS event_category,
      COALESCE('Order #' || po.external_id, 'Purchase')::TEXT AS title,
      (to_char(COALESCE(po.total_amount, 0), 'FM$999,999,990.00') || ' purchase')::TEXT AS description,
      'positive'::TEXT AS impact,
      jsonb_build_object(
        'total_amount', po.total_amount,
        'order_number', po.external_id,
        'items_count', COALESCE(jsonb_array_length(po.items), 0),
        'source', 'pos_orders'
      ) AS metadata,
      COALESCE(po.order_date::timestamptz, po.created_at) AS created_at
    FROM pos_orders po
    WHERE po.tenant_id = v_tenant_id
      AND (
        po.crm_customer_id = p_customer_id
        OR (
          po.crm_customer_id IS NULL
          AND EXISTS (
            SELECT 1 FROM pos_customers pc
            WHERE pc.id = po.pos_customer_id
              AND ((v_email IS NOT NULL AND pc.email = v_email)
                OR (v_phone IS NOT NULL AND pc.phone = v_phone))
          )
        )
      )

    UNION ALL

    -- Customer timeline activity (imported history and seeded activity)
    SELECT
      ct.id,
      COALESCE(NULLIF(ct.activity_type, ''), 'activity')::TEXT AS event_type,
      (CASE WHEN ct.activity_type = 'purchase' THEN 'purchase' ELSE 'activity' END)::TEXT AS event_category,
      (CASE
        WHEN ct.activity_type = 'purchase' THEN COALESCE('Purchase: ' || NULLIF(ct.product_name, ''), 'Purchase')
        ELSE COALESCE(NULLIF(ct.campaign_name, ''), initcap(replace(COALESCE(ct.activity_type, 'activity'), '_', ' ')))
      END)::TEXT AS title,
      (CASE
        WHEN ct.purchase_amount IS NOT NULL THEN to_char(ct.purchase_amount, 'FM$999,999,990.00') || ' purchase'
        ELSE initcap(replace(COALESCE(ct.activity_type, 'activity'), '_', ' '))
      END)::TEXT AS description,
      (CASE WHEN ct.activity_type = 'purchase' THEN 'positive' ELSE 'neutral' END)::TEXT AS impact,
      COALESCE(ct.metadata, '{}'::jsonb) || jsonb_build_object(
        'total_amount', ct.purchase_amount,
        'product_name', ct.product_name,
        'campaign_id', ct.campaign_id,
        'source', 'customer_timeline'
      ) AS metadata,
      ct.created_at
    FROM customer_timeline ct
    WHERE ct.customer_id = p_customer_id
      AND (ct.tenant_id IS NULL OR ct.tenant_id = v_tenant_id)

    UNION ALL

    -- SMS Messages
    SELECT
      s.id,
      'sms'::TEXT AS event_type,
      'sms'::TEXT AS event_category,
      COALESCE(sc.name, 'SMS Message')::TEXT AS title,
      LEFT(COALESCE(s.content, 'Message sent'), 100)::TEXT AS description,
      'neutral'::TEXT AS impact,
      jsonb_build_object('status', s.status) AS metadata,
      s.created_at
    FROM sms_messages s
    LEFT JOIN crm_sms_campaigns sc ON s.campaign_id = sc.id
    WHERE s.customer_id = p_customer_id

    UNION ALL

    -- Email Events from email_tracking_events
    SELECT
      e.id,
      e.event_type::TEXT AS event_type,
      'email'::TEXT AS event_category,
      COALESCE(c.subject_line, 'Email ' || e.event_type)::TEXT AS title,
      ('Email ' || e.event_type)::TEXT AS description,
      CASE
        WHEN e.event_type IN ('open', 'opened', 'click', 'clicked') THEN 'positive'
        WHEN e.event_type IN ('bounce', 'complaint', 'unsubscribe') THEN 'negative'
        ELSE 'neutral'
      END::TEXT AS impact,
      jsonb_build_object('event_type', e.event_type, 'campaign_id', e.campaign_id) AS metadata,
      e.created_at
    FROM email_tracking_events e
    LEFT JOIN crm_campaigns c ON e.campaign_id = c.id
    WHERE e.customer_id = p_customer_id

    UNION ALL

    -- Loyalty Points Transactions
    SELECT
      l.id,
      l.transaction_type::TEXT AS event_type,
      'loyalty'::TEXT AS event_category,
      (CASE
        WHEN l.points_amount > 0 THEN 'Earned ' || l.points_amount || ' points'
        ELSE 'Redeemed ' || ABS(l.points_amount) || ' points'
      END)::TEXT AS title,
      COALESCE(l.description, l.source_type || ' transaction')::TEXT AS description,
      CASE WHEN l.points_amount > 0 THEN 'positive' ELSE 'neutral' END::TEXT AS impact,
      jsonb_build_object(
        'points_amount', l.points_amount,
        'points_balance_after', l.points_balance_after,
        'source_type', l.source_type,
        'redemption_value', l.redemption_value
      ) AS metadata,
      l.created_at
    FROM loyalty_points_transactions l
    WHERE l.customer_id = p_customer_id

    UNION ALL

    -- Negative Behavior Events (risk signals)
    SELECT
      n.id,
      n.event_type::TEXT AS event_type,
      'risk'::TEXT AS event_category,
      (n.event_type || ' detected')::TEXT AS title,
      COALESCE(n.bounce_reason, n.event_subtype, 'Risk event recorded')::TEXT AS description,
      'negative'::TEXT AS impact,
      jsonb_build_object(
        'event_subtype', n.event_subtype,
        'risk_score_impact', n.risk_score_impact,
        'channel', n.channel
      ) AS metadata,
      n.created_at
    FROM negative_behavior_events n
    WHERE n.customer_id = p_customer_id
  )
  SELECT ae.id, ae.event_type, ae.event_category, ae.title, ae.description, ae.impact, ae.metadata, ae.created_at
  FROM all_events ae
  WHERE (p_event_types IS NULL OR ae.event_category = ANY(p_event_types))
  ORDER BY ae.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;
