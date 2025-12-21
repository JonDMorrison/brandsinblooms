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
