-- Drop and recreate the function with correct table references
DROP FUNCTION IF EXISTS public.get_customer_unified_timeline(UUID, INTEGER, INTEGER, TEXT[]);

CREATE OR REPLACE FUNCTION public.get_customer_unified_timeline(
  p_customer_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_event_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  event_type TEXT,
  event_category TEXT,
  title TEXT,
  description TEXT,
  impact TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH all_events AS (
    -- Purchases from pos_orders (joined with pos_customers to get customer_id mapping)
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
        'items_count', po.items_count
      ) as metadata,
      po.created_at
    FROM pos_orders po
    INNER JOIN pos_customers pc ON po.pos_customer_id = pc.id
    WHERE pc.customer_id = p_customer_id
    
    UNION ALL
    
    -- SMS Messages (with optional campaign join)
    SELECT 
      s.id,
      'sms'::TEXT as event_type,
      'sms'::TEXT as event_category,
      COALESCE(sc.name, 'SMS Message')::TEXT as title,
      LEFT(COALESCE(s.content, 'Message sent'), 100)::TEXT as description,
      'neutral'::TEXT as impact,
      jsonb_build_object(
        'status', s.status,
        'direction', s.direction
      ) as metadata,
      s.created_at
    FROM sms_messages s
    LEFT JOIN crm_sms_campaigns sc ON s.campaign_id = sc.id
    WHERE s.customer_id = p_customer_id
    
    UNION ALL
    
    -- Email Events from email_tracking_events (with campaign join for subject)
    SELECT 
      e.id,
      e.event_type::TEXT as event_type,
      'email'::TEXT as event_category,
      COALESCE(c.subject_line, 'Email ' || e.event_type)::TEXT as title,
      ('Email ' || e.event_type)::TEXT as description,
      CASE 
        WHEN e.event_type IN ('opened', 'clicked') THEN 'positive'
        WHEN e.event_type IN ('bounced', 'complained', 'unsubscribed') THEN 'negative'
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
$$;