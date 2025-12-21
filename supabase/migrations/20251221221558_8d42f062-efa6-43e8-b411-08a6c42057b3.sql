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
    -- Purchases
    SELECT 
      p.id,
      'purchase'::TEXT as event_type,
      'purchase'::TEXT as event_category,
      COALESCE('Order #' || p.order_number, 'Purchase')::TEXT as title,
      ('$' || COALESCE(p.total_amount, 0)::TEXT || ' purchase')::TEXT as description,
      'positive'::TEXT as impact,
      jsonb_build_object(
        'total_amount', p.total_amount,
        'order_number', p.order_number,
        'source', p.source
      ) as metadata,
      p.created_at
    FROM purchases p
    WHERE p.customer_id = p_customer_id
    
    UNION ALL
    
    -- SMS Messages
    SELECT 
      s.id,
      'sms'::TEXT as event_type,
      'sms'::TEXT as event_category,
      COALESCE(s.campaign_name, 'SMS Message')::TEXT as title,
      LEFT(COALESCE(s.content, 'Message sent'), 100)::TEXT as description,
      'neutral'::TEXT as impact,
      jsonb_build_object(
        'status', s.status,
        'campaign_name', s.campaign_name
      ) as metadata,
      s.created_at
    FROM sms_messages s
    WHERE s.customer_id = p_customer_id
    
    UNION ALL
    
    -- Email Events
    SELECT 
      e.id,
      e.event_type::TEXT as event_type,
      'email'::TEXT as event_category,
      COALESCE(e.subject_line, 'Email ' || e.event_type)::TEXT as title,
      ('Email ' || e.event_type)::TEXT as description,
      CASE 
        WHEN e.event_type IN ('open', 'click') THEN 'positive'
        WHEN e.event_type IN ('bounce', 'spam_complaint') THEN 'negative'
        ELSE 'neutral'
      END::TEXT as impact,
      jsonb_build_object(
        'event_type', e.event_type,
        'campaign_id', e.campaign_id,
        'subject_line', e.subject_line
      ) as metadata,
      e.created_at
    FROM email_events e
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
        'metadata', n.metadata
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