CREATE OR REPLACE FUNCTION get_customer_unified_timeline(
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
      'Purchase Made'::TEXT as title,
      format('Order #%s - %s %s', o.external_id, o.currency, o.total_amount::TEXT) as description,
      'positive'::TEXT as impact,
      jsonb_build_object(
        'order_id', o.external_id,
        'amount', o.total_amount,
        'currency', o.currency,
        'status', o.status,
        'items', o.items
      ) as metadata,
      o.order_date as created_at
    FROM pos_orders o
    JOIN crm_customers c ON c.clover_customer_id = o.pos_customer_id::TEXT
    WHERE c.id = p_customer_id

    UNION ALL

    -- SMS messages
    SELECT 
      s.id,
      'sms_sent'::TEXT as event_type,
      'sms'::TEXT as event_category,
      'SMS Sent'::TEXT as title,
      LEFT(s.content, 100) as description,
      'neutral'::TEXT as impact,
      jsonb_build_object(
        'status', s.status,
        'body_preview', LEFT(s.content, 200),
        'sent_at', s.sent_at
      ) as metadata,
      s.created_at
    FROM sms_messages s
    WHERE s.customer_id = p_customer_id

    UNION ALL

    -- Negative behavior events
    SELECT 
      n.id,
      n.event_type,
      'risk'::TEXT as event_category,
      CASE n.event_type
        WHEN 'hard_bounce' THEN 'Email Bounced'
        WHEN 'soft_bounce' THEN 'Email Soft Bounce'
        WHEN 'spam_complaint' THEN 'Spam Complaint'
        WHEN 'unsubscribe' THEN 'Unsubscribed'
        WHEN 'sms_opt_out' THEN 'SMS Opt-Out'
        WHEN 'email_ignored' THEN 'Email Ignored'
        ELSE initcap(replace(n.event_type, '_', ' '))
      END as title,
      n.event_details::TEXT as description,
      'negative'::TEXT as impact,
      jsonb_build_object(
        'channel', n.channel,
        'details', n.event_details,
        'severity', n.severity_score
      ) as metadata,
      n.created_at
    FROM negative_behavior_events n
    WHERE n.customer_id = p_customer_id

    UNION ALL

    -- Loyalty points transactions
    SELECT 
      l.id,
      CASE 
        WHEN l.points_change > 0 THEN 'points_earned'
        ELSE 'points_redeemed'
      END as event_type,
      'loyalty'::TEXT as event_category,
      CASE 
        WHEN l.points_change > 0 THEN 'Points Earned'
        ELSE 'Points Redeemed'
      END as title,
      format('%s points - %s', ABS(l.points_change), COALESCE(l.reason, l.transaction_type)) as description,
      CASE 
        WHEN l.points_change > 0 THEN 'positive'
        ELSE 'neutral'
      END as impact,
      jsonb_build_object(
        'points_change', l.points_change,
        'balance_after', l.balance_after,
        'transaction_type', l.transaction_type,
        'reason', l.reason
      ) as metadata,
      l.created_at
    FROM loyalty_points_transactions l
    WHERE l.customer_id = p_customer_id

    UNION ALL

    -- Customer lifecycle events
    SELECT 
      lc.id,
      lc.event_type,
      'lifecycle'::TEXT as event_category,
      CASE lc.event_type
        WHEN 'stage_change' THEN 'Lifecycle Stage Changed'
        WHEN 'first_purchase' THEN 'First Purchase'
        WHEN 'repeat_purchase' THEN 'Repeat Purchase'
        WHEN 'reactivation' THEN 'Customer Reactivated'
        WHEN 'churn_risk' THEN 'Churn Risk Detected'
        ELSE initcap(replace(lc.event_type, '_', ' '))
      END as title,
      COALESCE(
        format('%s → %s', lc.previous_stage, lc.new_stage),
        lc.event_type
      ) as description,
      CASE 
        WHEN lc.event_type IN ('churn_risk', 'churned') THEN 'negative'
        WHEN lc.event_type IN ('reactivation', 'first_purchase', 'repeat_purchase') THEN 'positive'
        ELSE 'neutral'
      END as impact,
      jsonb_build_object(
        'previous_stage', lc.previous_stage,
        'new_stage', lc.new_stage,
        'metadata', lc.metadata
      ) as metadata,
      lc.created_at
    FROM customer_lifecycle_events lc
    WHERE lc.customer_id = p_customer_id

    UNION ALL

    -- Incentive tracking (coupon usage)
    SELECT 
      i.id,
      CASE 
        WHEN i.redeemed_at IS NOT NULL THEN 'incentive_redeemed'
        ELSE 'incentive_sent'
      END as event_type,
      'incentive'::TEXT as event_category,
      CASE 
        WHEN i.redeemed_at IS NOT NULL THEN 'Incentive Redeemed'
        ELSE 'Incentive Sent'
      END as title,
      format('%s - %s%s off', 
        COALESCE(i.coupon_code, 'Incentive'),
        i.discount_value,
        CASE WHEN i.discount_type = 'percentage' THEN '%' ELSE '' END
      ) as description,
      'positive'::TEXT as impact,
      jsonb_build_object(
        'coupon_code', i.coupon_code,
        'discount_type', i.discount_type,
        'discount_value', i.discount_value,
        'redeemed', i.redeemed_at IS NOT NULL
      ) as metadata,
      COALESCE(i.redeemed_at, i.sent_at, i.created_at) as created_at
    FROM incentive_tracking i
    WHERE i.customer_id = p_customer_id

    UNION ALL

    -- Perks enrollment events
    SELECT 
      p.id,
      p.event_type,
      'loyalty'::TEXT as event_category,
      CASE p.event_type
        WHEN 'enrolled' THEN 'Joined Perks Program'
        WHEN 'tier_upgrade' THEN 'Tier Upgraded'
        WHEN 'tier_downgrade' THEN 'Tier Downgraded'
        ELSE initcap(replace(p.event_type, '_', ' '))
      END as title,
      COALESCE(p.details::TEXT, p.event_type) as description,
      CASE 
        WHEN p.event_type IN ('enrolled', 'tier_upgrade') THEN 'positive'
        WHEN p.event_type = 'tier_downgrade' THEN 'negative'
        ELSE 'neutral'
      END as impact,
      jsonb_build_object(
        'details', p.details
      ) as metadata,
      p.created_at
    FROM perks_enrollment_events p
    WHERE p.customer_id = p_customer_id

    UNION ALL

    -- Content interaction events
    SELECT 
      ci.id,
      ci.interaction_type as event_type,
      ci.channel as event_category,
      CASE ci.interaction_type
        WHEN 'open' THEN 'Email Opened'
        WHEN 'click' THEN 'Link Clicked'
        WHEN 'view' THEN 'Content Viewed'
        ELSE initcap(ci.interaction_type)
      END as title,
      format('%s - %s', ci.content_type, ci.interaction_type) as description,
      'positive'::TEXT as impact,
      jsonb_build_object(
        'content_type', ci.content_type,
        'channel', ci.channel,
        'time_spent_seconds', ci.time_spent_seconds,
        'scroll_depth', ci.scroll_depth_percent
      ) as metadata,
      ci.created_at
    FROM content_interaction_events ci
    WHERE ci.customer_id = p_customer_id
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
  WHERE (p_event_types IS NULL OR ue.event_category = ANY(p_event_types))
  ORDER BY ue.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;