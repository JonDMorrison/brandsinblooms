-- Create unified timeline function for customer dashboard
-- This function unions events from multiple tables into a single timeline

CREATE OR REPLACE FUNCTION public.get_customer_unified_timeline(
  p_customer_id UUID,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_event_types TEXT[] DEFAULT NULL
)
RETURNS TABLE(
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
  WITH unified_events AS (
    -- Purchase events from pos_orders
    SELECT 
      o.id,
      'purchase'::TEXT as event_type,
      'purchase'::TEXT as event_category,
      ('Purchase: $' || ROUND(o.total::numeric, 2)::TEXT)::TEXT as title,
      COALESCE(o.item_names, 'Order placed')::TEXT as description,
      'positive'::TEXT as impact,
      jsonb_build_object(
        'order_id', o.id,
        'total', o.total,
        'items', o.item_names,
        'payment_type', o.payment_type
      ) as metadata,
      COALESCE(o.order_date, o.created_at) as created_at
    FROM pos_orders o
    WHERE o.customer_id = p_customer_id
      AND (p_event_types IS NULL OR 'purchase' = ANY(p_event_types))
    
    UNION ALL
    
    -- SMS message events
    SELECT 
      s.id,
      CASE 
        WHEN s.status = 'delivered' THEN 'sms_delivered'
        WHEN s.status = 'clicked' THEN 'sms_click'
        WHEN s.status = 'failed' THEN 'sms_failed'
        ELSE 'sms_sent'
      END::TEXT as event_type,
      'sms'::TEXT as event_category,
      CASE 
        WHEN s.status = 'clicked' THEN 'Clicked SMS link'
        WHEN s.status = 'delivered' THEN 'SMS delivered'
        WHEN s.status = 'failed' THEN 'SMS delivery failed'
        ELSE 'SMS sent'
      END::TEXT as title,
      LEFT(COALESCE(s.body, 'SMS message'), 80)::TEXT as description,
      CASE 
        WHEN s.status = 'clicked' THEN 'positive'
        WHEN s.status = 'failed' THEN 'negative'
        ELSE 'neutral'
      END::TEXT as impact,
      jsonb_build_object(
        'message_id', s.id,
        'status', s.status,
        'campaign_id', s.campaign_id
      ) as metadata,
      COALESCE(s.sent_at, s.created_at) as created_at
    FROM sms_messages s
    WHERE s.customer_id = p_customer_id
      AND (p_event_types IS NULL OR 'sms' = ANY(p_event_types) OR s.status = ANY(p_event_types))
    
    UNION ALL
    
    -- Negative behavior events (opt-outs, bounces, etc)
    SELECT 
      n.id,
      n.event_type::TEXT,
      'risk'::TEXT as event_category,
      CASE 
        WHEN n.event_type = 'opt_out' THEN 'Opted out of ' || COALESCE(n.channel, 'messages')
        WHEN n.event_type = 'bounce' THEN 'Email bounced'
        WHEN n.event_type = 'ignore' THEN 'Message ignored'
        WHEN n.event_type = 'complaint' THEN 'Spam complaint'
        ELSE INITCAP(REPLACE(n.event_type, '_', ' '))
      END::TEXT as title,
      COALESCE(n.opt_out_source, n.bounce_reason, 'Negative signal recorded')::TEXT as description,
      'negative'::TEXT as impact,
      jsonb_build_object(
        'event_id', n.id,
        'channel', n.channel,
        'bounce_type', n.bounce_type,
        'ignore_streak', n.ignore_streak_length
      ) as metadata,
      n.created_at
    FROM negative_behavior_events n
    WHERE n.customer_id = p_customer_id
      AND (p_event_types IS NULL OR n.event_type = ANY(p_event_types) OR 'risk' = ANY(p_event_types))
    
    UNION ALL
    
    -- Loyalty points transactions
    SELECT 
      l.id,
      l.transaction_type::TEXT as event_type,
      'loyalty'::TEXT as event_category,
      CASE 
        WHEN l.transaction_type = 'earn' THEN 'Earned ' || l.points_amount || ' points'
        WHEN l.transaction_type = 'redeem' THEN 'Redeemed ' || l.points_amount || ' points'
        WHEN l.transaction_type = 'expire' THEN l.points_amount || ' points expired'
        ELSE 'Points adjustment: ' || l.points_amount
      END::TEXT as title,
      COALESCE(l.description, 'Loyalty activity')::TEXT as description,
      CASE 
        WHEN l.transaction_type = 'earn' THEN 'positive'
        WHEN l.transaction_type = 'redeem' THEN 'positive'
        WHEN l.transaction_type = 'expire' THEN 'negative'
        ELSE 'neutral'
      END::TEXT as impact,
      jsonb_build_object(
        'transaction_id', l.id,
        'points', l.points_amount,
        'balance_after', l.points_balance_after,
        'order_id', l.order_id
      ) as metadata,
      l.created_at
    FROM loyalty_points_transactions l
    WHERE l.customer_id = p_customer_id
      AND (p_event_types IS NULL OR l.transaction_type = ANY(p_event_types) OR 'loyalty' = ANY(p_event_types))
    
    UNION ALL
    
    -- Lifecycle stage changes
    SELECT 
      le.id,
      le.event_type::TEXT,
      'lifecycle'::TEXT as event_category,
      CASE 
        WHEN le.event_type = 'stage_change' THEN 'Stage: ' || COALESCE(le.from_stage, 'new') || ' → ' || COALESCE(le.to_stage, 'unknown')
        WHEN le.event_type = 'churned' THEN 'Customer churned'
        WHEN le.event_type = 'reactivated' THEN 'Customer reactivated'
        WHEN le.event_type = 'at_risk_alert' THEN 'At-risk alert triggered'
        ELSE INITCAP(REPLACE(le.event_type, '_', ' '))
      END::TEXT as title,
      COALESCE(le.trigger_reason, 'Lifecycle event')::TEXT as description,
      CASE 
        WHEN le.event_type = 'reactivated' THEN 'positive'
        WHEN le.event_type = 'churned' THEN 'negative'
        WHEN le.event_type = 'at_risk_alert' THEN 'negative'
        ELSE 'neutral'
      END::TEXT as impact,
      jsonb_build_object(
        'event_id', le.id,
        'from_stage', le.from_stage,
        'to_stage', le.to_stage,
        'trigger_source', le.trigger_source
      ) as metadata,
      le.created_at
    FROM customer_lifecycle_events le
    WHERE le.customer_id = p_customer_id
      AND (p_event_types IS NULL OR le.event_type = ANY(p_event_types) OR 'lifecycle' = ANY(p_event_types))
    
    UNION ALL
    
    -- Incentive/coupon events
    SELECT 
      i.id,
      CASE 
        WHEN i.status = 'redeemed' THEN 'incentive_redeemed'
        WHEN i.status = 'expired' THEN 'incentive_expired'
        ELSE 'incentive_sent'
      END::TEXT as event_type,
      'incentive'::TEXT as event_category,
      CASE 
        WHEN i.status = 'redeemed' THEN 'Redeemed: ' || COALESCE(i.code, 'incentive')
        WHEN i.status = 'expired' THEN 'Incentive expired unused'
        ELSE 'Received ' || COALESCE(i.incentive_type, 'incentive')
      END::TEXT as title,
      CASE 
        WHEN i.value IS NOT NULL THEN 
          CASE i.value_type 
            WHEN 'percent' THEN i.value || '% off'
            ELSE '$' || i.value || ' off'
          END
        ELSE 'Special offer'
      END::TEXT as description,
      CASE 
        WHEN i.status = 'redeemed' THEN 'positive'
        WHEN i.status = 'expired' THEN 'neutral'
        ELSE 'neutral'
      END::TEXT as impact,
      jsonb_build_object(
        'incentive_id', i.id,
        'code', i.code,
        'value', i.value,
        'status', i.status,
        'redemption_amount', i.redemption_amount
      ) as metadata,
      CASE 
        WHEN i.status = 'redeemed' THEN i.redeemed_at
        ELSE i.sent_at
      END as created_at
    FROM incentive_tracking i
    WHERE i.customer_id = p_customer_id
      AND (p_event_types IS NULL OR 'incentive' = ANY(p_event_types))
    
    UNION ALL
    
    -- Perks enrollment events
    SELECT 
      p.id,
      p.event_type::TEXT,
      'perks'::TEXT as event_category,
      CASE 
        WHEN p.event_type = 'enrolled' THEN 'Enrolled in Perks program'
        WHEN p.event_type = 'tier_upgraded' THEN 'Tier upgraded to ' || COALESCE(p.new_tier, 'unknown')
        WHEN p.event_type = 'tier_downgraded' THEN 'Tier downgraded'
        WHEN p.event_type = 'cancelled' THEN 'Perks membership cancelled'
        ELSE INITCAP(REPLACE(p.event_type, '_', ' '))
      END::TEXT as title,
      CASE 
        WHEN p.event_type = 'tier_upgraded' THEN COALESCE(p.previous_tier, 'none') || ' → ' || COALESCE(p.new_tier, 'unknown')
        ELSE 'Perks activity'
      END::TEXT as description,
      CASE 
        WHEN p.event_type IN ('enrolled', 'tier_upgraded') THEN 'positive'
        WHEN p.event_type IN ('cancelled', 'tier_downgraded') THEN 'negative'
        ELSE 'neutral'
      END::TEXT as impact,
      jsonb_build_object(
        'event_id', p.id,
        'previous_tier', p.previous_tier,
        'new_tier', p.new_tier,
        'enrollment_source', p.enrollment_source
      ) as metadata,
      p.created_at
    FROM perks_enrollment_events p
    WHERE p.customer_id = p_customer_id
      AND (p_event_types IS NULL OR p.event_type = ANY(p_event_types) OR 'perks' = ANY(p_event_types))
    
    UNION ALL
    
    -- Content interaction events (email opens, clicks, etc)
    SELECT 
      c.id,
      c.interaction_type::TEXT as event_type,
      c.channel::TEXT as event_category,
      CASE 
        WHEN c.interaction_type = 'open' THEN 'Opened email'
        WHEN c.interaction_type = 'click' THEN 'Clicked ' || COALESCE(c.cta_type, 'link')
        WHEN c.interaction_type = 'read' THEN 'Read content deeply'
        ELSE INITCAP(REPLACE(c.interaction_type, '_', ' '))
      END::TEXT as title,
      CASE 
        WHEN c.content_category IS NOT NULL THEN 'Content: ' || c.content_category
        WHEN c.block_type IS NOT NULL THEN 'Block: ' || c.block_type
        ELSE 'Content interaction'
      END::TEXT as description,
      CASE 
        WHEN c.is_deep_engagement THEN 'positive'
        WHEN c.interaction_type = 'click' THEN 'positive'
        ELSE 'neutral'
      END::TEXT as impact,
      jsonb_build_object(
        'event_id', c.id,
        'channel', c.channel,
        'content_type', c.content_type,
        'cta_type', c.cta_type,
        'time_spent', c.time_spent_seconds,
        'scroll_depth', c.scroll_depth_percent
      ) as metadata,
      c.created_at
    FROM content_interaction_events c
    WHERE c.customer_id = p_customer_id
      AND (p_event_types IS NULL OR c.interaction_type = ANY(p_event_types) OR c.channel = ANY(p_event_types))
  )
  SELECT 
    ue.id,
    ue.event_type,
    ue.event_category,
    ue.title,
    ue.description,
    ue.impact,
    ue.metadata,
    ue.created_at
  FROM unified_events ue
  ORDER BY ue.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_customer_unified_timeline(UUID, INT, INT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_unified_timeline(UUID, INT, INT, TEXT[]) TO anon;