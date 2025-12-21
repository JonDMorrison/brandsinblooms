/**
 * Customer Metrics TypeScript Interfaces
 */

export interface CustomerSmsMetrics {
  id: string;
  customer_id: string;
  tenant_id: string;
  total_sent: number;
  total_delivered: number;
  total_clicked: number;
  total_failed: number;
  total_replied: number;
  total_opt_outs: number;
  delivery_rate: number;
  click_rate: number;
  reply_rate: number;
  opt_out_rate: number;
  avg_time_to_response_minutes: number | null;
  engagement_score: number;
  last_sent_at: string | null;
  last_delivered_at: string | null;
  last_clicked_at: string | null;
  last_replied_at: string | null;
  last_opt_out_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerEmailMetrics {
  id: string;
  customer_id: string;
  tenant_id: string;
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_bounced: number;
  total_unsubscribes: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
  last_sent_at: string | null;
  last_opened_at: string | null;
  last_clicked_at: string | null;
  engagement_score: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerEngagementSummary {
  id: string;
  customer_id: string;
  tenant_id: string;
  overall_engagement_score: number;
  email_score: number;
  sms_score: number;
  purchase_score: number;
  engagement_tier: 'high' | 'medium' | 'low' | 'inactive' | null;
  last_calculated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer360Enriched {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  
  // Identity metrics
  first_seen_at: string;
  last_seen_at: string;
  signup_source: string | null;
  signup_campaign: string | null;
  preferred_channel: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country_code: string | null;
  timezone: string | null;
  store_id: string | null;
  store_name: string | null;
  
  // Email metrics
  email_total_sent: number;
  email_total_delivered: number;
  email_total_opened: number;
  email_total_clicked: number;
  email_total_bounced: number;
  email_total_unsubscribes: number;
  email_open_rate: number;
  email_click_rate: number;
  email_bounce_rate: number;
  email_last_sent_at: string | null;
  email_last_opened_at: string | null;
  email_last_clicked_at: string | null;
  
  // SMS metrics
  sms_total_sent: number;
  sms_total_delivered: number;
  sms_total_clicked: number;
  sms_total_failed: number;
  sms_total_replied: number;
  sms_total_opt_outs: number;
  sms_delivery_rate: number;
  sms_click_rate: number;
  sms_reply_rate: number;
  sms_opt_out_rate: number;
  sms_avg_response_time_minutes: number;
  sms_engagement_score: number;
  sms_last_sent_at: string | null;
  sms_last_delivered_at: string | null;
  sms_last_clicked_at: string | null;
  sms_last_replied_at: string | null;
  sms_last_opt_out_at: string | null;
  
  // Engagement summary
  engagement_overall_score: number;
  engagement_email_score: number;
  engagement_sms_score: number;
  engagement_purchase_score: number;
  engagement_tier: string | null;
  engagement_last_calculated_at: string | null;
}

export interface SmsEngagementStats {
  totalSent: number;
  deliveryRate: number;
  clickRate: number;
  replyRate: number;
  optOutRate: number;
  avgResponseTimeMinutes: number | null;
}

export interface CustomerCrossChannelMetrics {
  id: string;
  customer_id: string;
  tenant_id: string;
  multi_channel_score: number;
  preferred_channel: 'email' | 'sms' | 'equal' | 'unknown';
  email_fatigue_score: number;
  sms_fatigue_score: number;
  fatigue_status: 'none' | 'low' | 'moderate' | 'high' | 'critical';
  last_engaged_channel: 'email' | 'sms' | null;
  last_engagement_at: string | null;
  days_since_last_engagement: number;
  email_interactions_7d: number;
  sms_interactions_7d: number;
  email_interactions_30d: number;
  sms_interactions_30d: number;
  email_messages_received_7d: number;
  sms_messages_received_7d: number;
  created_at: string;
  updated_at: string;
}

export interface CrossChannelStats {
  avgMultiChannelScore: number;
  preferredChannelBreakdown: {
    email: number;
    sms: number;
    equal: number;
    unknown: number;
  };
  fatigueStatusBreakdown: {
    none: number;
    low: number;
    moderate: number;
    high: number;
    critical: number;
  };
  avgDaysSinceLastEngagement: number;
}

export interface CustomerPurchaseMetrics {
  id: string;
  customer_id: string;
  tenant_id: string;
  
  // Core metrics
  total_purchases: number;
  first_purchase_date: string | null;
  last_purchase_date: string | null;
  
  // Frequency metrics
  purchase_frequency: number;
  avg_days_between_purchases: number | null;
  min_days_between_purchases: number | null;
  max_days_between_purchases: number | null;
  
  // Value metrics
  average_order_value: number;
  lifetime_value: number;
  revenue_per_month: number;
  
  // Behavior metrics
  repeat_purchase_rate: number;
  purchase_velocity: number;
  days_since_last_purchase: number | null;
  
  // Discount behavior
  total_discounted_purchases: number;
  total_full_price_purchases: number;
  discount_driven_ratio: number;
  total_discount_amount: number;
  
  // Patterns
  seasonal_patterns: Record<string, number>;
  peak_purchase_month: string | null;
  product_category_affinity: Record<string, number>;
  top_product_categories: string[];
  favorite_products: string[];
  
  // Scores
  purchase_engagement_score: number;
  customer_tier: 'new' | 'occasional' | 'regular' | 'loyal' | 'vip';
  
  created_at: string;
  updated_at: string;
}

export interface PurchaseStats {
  avgAOV: number;
  totalLTV: number;
  avgPurchaseFrequency: number;
  tierBreakdown: {
    new: number;
    occasional: number;
    regular: number;
    loyal: number;
    vip: number;
  };
}

// =============================================
// POST-PURCHASE BEHAVIOR METRICS
// =============================================

export interface CustomerPostPurchaseMetrics {
  id: string;
  customer_id: string;
  tenant_id: string;
  
  // Post-purchase email engagement
  post_purchase_emails_sent: number;
  post_purchase_emails_opened: number;
  post_purchase_emails_clicked: number;
  post_purchase_email_open_rate: number;
  post_purchase_email_ctr: number;
  
  // Post-purchase SMS engagement
  post_purchase_sms_sent: number;
  post_purchase_sms_delivered: number;
  post_purchase_sms_clicked: number;
  post_purchase_follow_up_ctr: number;
  
  // Time to next purchase
  avg_time_to_next_purchase_days: number | null;
  min_time_to_next_purchase_days: number | null;
  max_time_to_next_purchase_days: number | null;
  last_time_to_next_purchase_days: number | null;
  
  // Incentive & Coupon metrics
  total_incentives_offered: number;
  total_incentives_redeemed: number;
  incentive_redemption_rate: number;
  total_coupon_value_redeemed: number;
  unique_coupons_used: number;
  coupon_usage_frequency: number;
  
  // Incentive dependency
  purchases_with_incentive: number;
  purchases_without_incentive: number;
  incentive_dependency_score: number;
  
  // Automation attribution
  total_automation_messages: number;
  purchases_after_automation: number;
  automation_conversion_rate: number;
  last_automation_purchase_at: string | null;
  
  // Drop-off analysis
  incentives_expired_unused: number;
  drop_off_after_incentive_rate: number;
  days_since_last_incentive_redemption: number | null;
  
  // Aggregate scores
  post_purchase_engagement_score: number;
  incentive_effectiveness_score: number;
  
  created_at: string;
  updated_at: string;
}

export interface IncentiveTracking {
  id: string;
  tenant_id: string;
  customer_id: string;
  incentive_type: string;
  code: string | null;
  value: number | null;
  value_type: string | null;
  source_type: string;
  source_id: string | null;
  automation_id: string | null;
  campaign_id: string | null;
  sent_at: string;
  expires_at: string | null;
  redeemed_at: string | null;
  redemption_order_id: string | null;
  redemption_amount: number | null;
  order_total: number | null;
  status: 'sent' | 'redeemed' | 'expired' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface PostPurchaseStats {
  avgEmailOpenRate: number;
  avgFollowUpCtr: number;
  avgTimeToNextPurchase: number | null;
  avgRedemptionRate: number;
  avgCouponUsageFrequency: number;
  avgIncentiveDependencyScore: number;
  avgAutomationConversionRate: number;
  avgDropOffRate: number;
}

// =============================================
// LOYALTY & PERKS PROGRAM BEHAVIOR METRICS
// =============================================

export interface CustomerLoyaltyMetrics {
  id: string;
  customer_id: string;
  tenant_id: string;
  
  // Enrollment & Timing
  is_perks_member: boolean;
  perks_enrolled_at: string | null;
  customer_created_at: string | null;
  time_to_join_perks_days: number | null;
  
  // Points Activity
  total_points_earned: number;
  total_points_redeemed: number;
  current_points_balance: number;
  non_redeemed_points_ratio: number;
  
  // Redemption Behavior
  total_redemptions: number;
  redemption_frequency: number;
  avg_redemption_delay_days: number | null;
  min_redemption_delay_days: number | null;
  max_redemption_delay_days: number | null;
  last_redemption_at: string | null;
  
  // Revenue Attribution
  total_perks_driven_revenue: number;
  total_non_perks_revenue: number;
  perks_revenue_percentage: number;
  avg_order_value_with_perks: number | null;
  avg_order_value_without_perks: number | null;
  
  // Tier Progression
  current_loyalty_tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  previous_loyalty_tier: string | null;
  tier_upgraded_at: string | null;
  tier_progression_speed_days: number | null;
  tier_upgrade_count: number;
  
  // Engagement
  member_engagement_score: number;
  member_email_open_rate: number | null;
  member_sms_click_rate: number | null;
  member_purchase_frequency: number | null;
  
  // Aggregate Scores
  loyalty_engagement_score: number;
  loyalty_risk_score: number;
  
  created_at: string;
  updated_at: string;
}

export interface LoyaltyPointsTransaction {
  id: string;
  tenant_id: string;
  customer_id: string;
  transaction_type: 'earn' | 'redeem' | 'expire' | 'adjust';
  points_amount: number;
  points_balance_after: number | null;
  source_type: string;
  source_id: string | null;
  order_id: string | null;
  order_total: number | null;
  redemption_value: number | null;
  description: string | null;
  external_transaction_id: string | null;
  created_at: string;
}

export interface PerksEnrollmentEvent {
  id: string;
  tenant_id: string;
  customer_id: string;
  event_type: 'enrolled' | 'tier_upgraded' | 'tier_downgraded' | 'cancelled';
  previous_tier: string | null;
  new_tier: string | null;
  enrollment_source: string | null;
  created_at: string;
}

export interface TenantLoyaltyStats {
  perks_enrollment_rate: number;
  avg_time_to_join_days: number | null;
  avg_points_earned: number;
  avg_points_redeemed: number;
  avg_redemption_frequency: number;
  avg_redemption_delay_days: number | null;
  total_perks_driven_revenue: number;
  avg_non_redeemed_ratio: number;
  tier_breakdown: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
  engagement_difference: {
    member_avg_purchase_frequency: number;
    non_member_avg_purchase_frequency: number;
    member_email_open_rate: number;
    non_member_email_open_rate: number;
  };
}

// =============================================
// TIME-BASED & LIFECYCLE METRICS
// =============================================

export type LifecycleStage = 'new' | 'engaged' | 'active_buyer' | 'loyal' | 'at_risk' | 'dormant' | 'churned';

export interface CustomerLifecycleMetrics {
  id: string;
  customer_id: string;
  tenant_id: string;
  
  // Time-Based Metrics (Days Since)
  days_since_signup: number | null;
  days_since_last_purchase: number | null;
  days_since_last_engagement: number | null;
  days_since_last_automation: number | null;
  
  // Core Timestamps
  customer_created_at: string | null;
  first_purchase_at: string | null;
  last_purchase_at: string | null;
  last_email_engagement_at: string | null;
  last_sms_engagement_at: string | null;
  last_any_engagement_at: string | null;
  last_automation_received_at: string | null;
  
  // Lifecycle Stage
  lifecycle_stage: LifecycleStage;
  previous_lifecycle_stage: string | null;
  lifecycle_stage_changed_at: string | null;
  days_in_current_stage: number;
  
  // Churn Tracking
  is_churned: boolean;
  churned_at: string | null;
  time_to_churn_days: number | null;
  churn_risk_score: number;
  predicted_churn_date: string | null;
  
  // Reactivation Tracking
  is_reactivated: boolean;
  reactivated_at: string | null;
  reactivation_count: number;
  time_to_reactivation_days: number | null;
  avg_time_to_reactivation_days: number | null;
  last_reactivation_trigger: string | null;
  
  // Reactivation Success
  total_churn_events: number;
  successful_reactivations: number;
  reactivation_success_rate: number;
  
  // Activity Metrics
  purchases_last_30d: number;
  purchases_last_90d: number;
  engagements_last_30d: number;
  engagements_last_90d: number;
  automations_received_last_30d: number;
  
  // Velocity & Trends
  engagement_velocity: number;
  purchase_velocity: number;
  
  // Scores
  lifecycle_health_score: number;
  retention_probability: number;
  
  created_at: string;
  updated_at: string;
}

export interface LifecycleEvent {
  id: string;
  tenant_id: string;
  customer_id: string;
  event_type: 'stage_change' | 'churned' | 'reactivated' | 'at_risk_alert';
  from_stage: string | null;
  to_stage: string | null;
  trigger_reason: string | null;
  trigger_source: string | null;
  trigger_source_id: string | null;
  days_since_last_purchase_at_event: number | null;
  days_since_last_engagement_at_event: number | null;
  churn_risk_score_at_event: number | null;
  created_at: string;
}

export interface TenantLifecycleStats {
  lifecycle_stage_breakdown: {
    new: number;
    engaged: number;
    active_buyer: number;
    loyal: number;
    at_risk: number;
    dormant: number;
    churned: number;
  };
  avg_days_since_signup: number;
  avg_days_since_last_purchase: number;
  avg_days_since_last_engagement: number;
  avg_days_since_last_automation: number;
  overall_churn_rate: number;
  overall_reactivation_success_rate: number;
  avg_time_to_churn_days: number | null;
  avg_time_to_reactivation_days: number | null;
  at_risk_customer_count: number;
  customers_churned_last_30d: number;
  customers_reactivated_last_30d: number;
}

// =============================================
// CONTENT INTERACTION & INTENT METRICS
// =============================================

export type ContentType = 'story' | 'offer' | 'educational' | 'promotional' | 'transactional' | 'balanced';
export type IntentLevel = 'high' | 'medium' | 'low' | 'unknown';
export type IntentTrend = 'increasing' | 'stable' | 'decreasing';
export type ClickTimingPattern = 'immediate' | 'considered' | 'delayed' | 'unknown';

export interface CustomerContentIntentMetrics {
  id: string;
  customer_id: string;
  tenant_id: string;
  
  // Content Type Engagement (Story vs Offer)
  total_story_views: number;
  total_offer_views: number;
  total_story_clicks: number;
  total_offer_clicks: number;
  story_engagement_rate: number;
  offer_engagement_rate: number;
  preferred_content_type: ContentType;
  
  // Educational vs Promotional Response Ratio
  educational_messages_received: number;
  educational_messages_engaged: number;
  promotional_messages_received: number;
  promotional_messages_engaged: number;
  educational_response_rate: number;
  promotional_response_rate: number;
  edu_promo_ratio: number;
  content_preference: 'educational' | 'promotional' | 'balanced';
  
  // Brand Story Open Rate
  brand_story_emails_sent: number;
  brand_story_emails_opened: number;
  brand_story_open_rate: number;
  brand_story_avg_read_time_seconds: number | null;
  
  // CTA Interaction Frequency
  total_ctas_viewed: number;
  total_ctas_clicked: number;
  cta_click_rate: number;
  cta_clicks_last_7d: number;
  cta_clicks_last_30d: number;
  cta_interaction_frequency: number;
  most_clicked_cta_type: string | null;
  
  // Intent Score
  intent_score: number;
  intent_level: IntentLevel;
  intent_trend: IntentTrend;
  intent_score_components: {
    cta_frequency_component: number;
    engagement_depth_component: number;
    click_consistency_component: number;
    content_preference_component: number;
    quick_response_component: number;
    relevance_component: number;
  };
  last_intent_signal_at: string | null;
  
  // Engagement Depth
  total_messages_received: number;
  total_messages_opened: number;
  total_messages_read_deeply: number;
  engagement_depth_score: number;
  avg_messages_engaged_per_session: number;
  multi_content_sessions: number;
  single_content_sessions: number;
  depth_ratio: number;
  
  // Click Pattern Consistency
  total_click_sessions: number;
  clicks_on_first_cta: number;
  clicks_after_scrolling: number;
  avg_ctas_viewed_before_click: number;
  click_timing_pattern: ClickTimingPattern;
  consistent_click_position: string | null;
  click_pattern_consistency_score: number;
  
  // Message Relevance Score
  total_relevant_opens: number;
  total_delayed_opens: number;
  quick_open_rate: number;
  total_unsubscribe_requests: number;
  total_spam_reports: number;
  relevance_feedback_score: number;
  message_relevance_score: number;
  best_performing_content_category: string | null;
  worst_performing_content_category: string | null;
  
  // Block-level
  block_engagement_breakdown: Record<string, number>;
  top_performing_block_types: string[];
  avg_blocks_viewed_per_message: number;
  
  // Time patterns
  peak_engagement_hour: number | null;
  peak_engagement_day: string | null;
  
  created_at: string;
  updated_at: string;
}

export interface ContentInteractionEvent {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  session_id: string;
  campaign_id: string | null;
  block_id: string | null;
  message_id: string | null;
  channel: 'email' | 'sms' | 'hub';
  content_type: ContentType;
  content_category: string | null;
  block_type: string | null;
  interaction_type: string;
  cta_type: string | null;
  cta_position: number | null;
  time_spent_seconds: number | null;
  scroll_depth_percent: number | null;
  blocks_viewed: number | null;
  is_deep_engagement: boolean;
  time_since_send_seconds: number | null;
  is_quick_response: boolean;
  device_type: string | null;
  created_at: string;
}

export interface TenantContentIntentStats {
  total_customers: number;
  avg_intent_score: number;
  intent_level_breakdown: {
    high: number;
    medium: number;
    low: number;
    unknown: number;
  };
  avg_engagement_depth_score: number;
  avg_click_pattern_consistency: number;
  avg_message_relevance_score: number;
  content_type_performance: {
    story_avg_engagement: number;
    offer_avg_engagement: number;
  };
  edu_vs_promo_preference: {
    educational_preferred: number;
    promotional_preferred: number;
    balanced: number;
  };
  avg_cta_click_rate: number;
  avg_brand_story_open_rate: number;
}
