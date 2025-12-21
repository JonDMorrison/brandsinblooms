/**
 * Data transformation functions for Customer Dashboard
 * Pure functions that transform raw hook data into component-ready props
 */

import type { CustomerData } from '@/hooks/useCustomerDashboard';
import type {
  CustomerCrossChannelMetrics,
  CustomerPurchaseMetrics,
  CustomerPostPurchaseMetrics,
  CustomerLoyaltyMetrics,
  CustomerLifecycleMetrics,
  CustomerContentIntentMetrics,
  CustomerRiskSignals,
  NegativeBehaviorEvent,
} from '@/types/customerMetrics';
import type { TimelineEvent } from '@/hooks/useCustomerUnifiedTimeline';

// =============================================
// CUSTOMER SNAPSHOT TRANSFORMERS
// =============================================

export interface SnapshotMetrics {
  engagementHealthScore: number;
  engagementTrend: number[];
  intentScore: number;
  intentLevel: string;
  preferredChannel: string;
  accountAgeDays: number;
}

export const transformToSnapshotMetrics = (
  customer360: CustomerData | null,
  lifecycle: CustomerLifecycleMetrics | null,
  contentIntent: CustomerContentIntentMetrics | null,
  crossChannel: CustomerCrossChannelMetrics | null
): SnapshotMetrics => {
  const engagementScore = customer360?.engagement_overall_score ?? 0;
  
  return {
    engagementHealthScore: Math.round(engagementScore),
    engagementTrend: [], // Would need historical data
    intentScore: contentIntent?.intent_score ?? 0,
    intentLevel: contentIntent?.intent_level ?? 'unknown',
    preferredChannel: crossChannel?.preferred_channel ?? customer360?.preferred_channel ?? 'unknown',
    accountAgeDays: lifecycle?.days_since_signup ?? 0,
  };
};

export interface CustomerBasicInfo {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  lifecycle_stage: string;
  created_at: string;
}

export const transformToCustomerBasicInfo = (
  customer360: CustomerData | null,
  lifecycle: CustomerLifecycleMetrics | null
): CustomerBasicInfo | null => {
  if (!customer360) return null;

  const firstName = customer360.first_name || '';
  const lastName = customer360.last_name || '';
  const name = `${firstName} ${lastName}`.trim() || customer360.email.split('@')[0];

  return {
    id: customer360.id,
    name,
    email: customer360.email,
    phone: customer360.phone,
    lifecycle_stage: lifecycle?.lifecycle_stage ?? 'new',
    created_at: customer360.created_at,
  };
};

// =============================================
// ENGAGEMENT HEALTH TRANSFORMERS
// =============================================

export interface EngagementMetrics {
  engagementScore: number;
  engagementTrend: number[];
  daysSinceLastEngagement: number;
  engagementVelocity: number;
  emailInteractions7d: number;
  smsInteractions7d: number;
}

export const transformToEngagementMetrics = (
  customer360: CustomerData | null,
  crossChannel: CustomerCrossChannelMetrics | null,
  lifecycle: CustomerLifecycleMetrics | null
): EngagementMetrics => {
  return {
    engagementScore: Math.round(customer360?.engagement_overall_score ?? 0),
    engagementTrend: [], // Would need historical data
    daysSinceLastEngagement: crossChannel?.days_since_last_engagement ?? lifecycle?.days_since_last_engagement ?? 0,
    engagementVelocity: lifecycle?.engagement_velocity ?? 0,
    emailInteractions7d: crossChannel?.email_interactions_7d ?? 0,
    smsInteractions7d: crossChannel?.sms_interactions_7d ?? 0,
  };
};

// =============================================
// CHANNEL DEEP DIVE TRANSFORMERS
// =============================================

export interface EmailChannelMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  openRate: number;
  clickRate: number;
  avgTimeToOpen: number;
  isQuickOpener: boolean;
}

export interface SmsChannelMetrics {
  sent: number;
  delivered: number;
  clicked: number;
  replied: number;
  deliveryRate: number;
  clickRate: number;
  replyRate: number;
  avgTimeToResponse: number;
}

export const transformToEmailMetrics = (
  customer360: CustomerData | null
): EmailChannelMetrics => {
  return {
    sent: customer360?.email_total_sent ?? 0,
    delivered: customer360?.email_total_delivered ?? 0,
    opened: customer360?.email_total_opened ?? 0,
    clicked: customer360?.email_total_clicked ?? 0,
    converted: 0, // Would need conversion tracking
    openRate: Math.round((customer360?.email_open_rate ?? 0) * 100),
    clickRate: Math.round((customer360?.email_click_rate ?? 0) * 100),
    avgTimeToOpen: 0, // Would need timing data
    isQuickOpener: false, // Would need timing data
  };
};

export const transformToSmsMetrics = (
  customer360: CustomerData | null
): SmsChannelMetrics => {
  return {
    sent: customer360?.sms_total_sent ?? 0,
    delivered: customer360?.sms_total_delivered ?? 0,
    clicked: customer360?.sms_total_clicked ?? 0,
    replied: customer360?.sms_total_replied ?? 0,
    deliveryRate: Math.round((customer360?.sms_delivery_rate ?? 0) * 100),
    clickRate: Math.round((customer360?.sms_click_rate ?? 0) * 100),
    replyRate: Math.round((customer360?.sms_reply_rate ?? 0) * 100),
    avgTimeToResponse: customer360?.sms_avg_response_time_minutes ?? 0,
  };
};

// =============================================
// CROSS-CHANNEL INTELLIGENCE TRANSFORMERS
// =============================================

export interface CrossChannelDisplayMetrics {
  multiChannelScore: number;
  emailEngagement: number;
  smsEngagement: number;
  loyaltyEngagement: number;
  preferredChannel: string;
  channelFatigueEmail: number;
  channelFatigueSms: number;
  daysSinceLastEmail: number;
  daysSinceLastSms: number;
  daysSinceLastLoyalty: number;
}

export const transformToCrossChannelMetrics = (
  crossChannel: CustomerCrossChannelMetrics | null,
  customer360: CustomerData | null,
  loyalty: CustomerLoyaltyMetrics | null
): CrossChannelDisplayMetrics => {
  return {
    multiChannelScore: Math.round(crossChannel?.multi_channel_score ?? 0),
    emailEngagement: Math.round(customer360?.engagement_email_score ?? 0),
    smsEngagement: Math.round(customer360?.engagement_sms_score ?? 0),
    loyaltyEngagement: Math.round(loyalty?.loyalty_engagement_score ?? 0),
    preferredChannel: crossChannel?.preferred_channel ?? 'unknown',
    channelFatigueEmail: Math.round(crossChannel?.email_fatigue_score ?? 0),
    channelFatigueSms: Math.round(crossChannel?.sms_fatigue_score ?? 0),
    daysSinceLastEmail: 0, // Would calculate from last_sent timestamps
    daysSinceLastSms: 0,
    daysSinceLastLoyalty: 0,
  };
};

// =============================================
// PURCHASE VALUE BEHAVIOR TRANSFORMERS
// =============================================

export interface PurchaseDisplayMetrics {
  totalPurchases: number;
  totalRevenue: number;
  ltv: number;
  aov: number;
  purchaseFrequency: number;
  avgDaysBetweenPurchases: number;
  repeatPurchaseRate: number;
  fullPricePercentage: number;
  discountedPercentage: number;
  consecutiveDiscountPurchases: number;
  firstPurchaseDate: string | null;
  lastPurchaseDate: string | null;
}

export const transformToPurchaseMetrics = (
  purchase: CustomerPurchaseMetrics | null,
  postPurchase: CustomerPostPurchaseMetrics | null
): PurchaseDisplayMetrics => {
  const totalPurchases = purchase?.total_purchases ?? 0;
  const discountedPurchases = purchase?.total_discounted_purchases ?? 0;
  const fullPricePurchases = purchase?.total_full_price_purchases ?? 0;

  return {
    totalPurchases,
    totalRevenue: purchase?.lifetime_value ?? 0,
    ltv: purchase?.lifetime_value ?? 0,
    aov: purchase?.average_order_value ?? 0,
    purchaseFrequency: purchase?.purchase_frequency ?? 0,
    avgDaysBetweenPurchases: purchase?.avg_days_between_purchases ?? 0,
    repeatPurchaseRate: Math.round((purchase?.repeat_purchase_rate ?? 0) * 100),
    fullPricePercentage: totalPurchases > 0 ? Math.round((fullPricePurchases / totalPurchases) * 100) : 0,
    discountedPercentage: totalPurchases > 0 ? Math.round((discountedPurchases / totalPurchases) * 100) : 0,
    consecutiveDiscountPurchases: 0, // Would need order history
    firstPurchaseDate: purchase?.first_purchase_date ?? null,
    lastPurchaseDate: purchase?.last_purchase_date ?? null,
  };
};

// =============================================
// LOYALTY & INCENTIVES TRANSFORMERS
// =============================================

export interface LoyaltyDisplayMetrics {
  isPerksEnrolled: boolean;
  currentTier: string;
  pointsEarned: number;
  pointsRedeemed: number;
  pointsBalance: number;
  avgRedemptionDelay: number;
  perksRevenue: number;
  totalRevenue: number;
  nextTier: string | null;
  pointsToNextTier: number;
}

export const transformToLoyaltyMetrics = (
  loyalty: CustomerLoyaltyMetrics | null,
  purchase: CustomerPurchaseMetrics | null
): LoyaltyDisplayMetrics => {
  const tierProgression: Record<string, string> = {
    bronze: 'Silver',
    silver: 'Gold',
    gold: 'Platinum',
    platinum: null as unknown as string,
  };

  const currentTier = loyalty?.current_loyalty_tier ?? 'bronze';

  return {
    isPerksEnrolled: loyalty?.is_perks_member ?? false,
    currentTier: currentTier.charAt(0).toUpperCase() + currentTier.slice(1),
    pointsEarned: loyalty?.total_points_earned ?? 0,
    pointsRedeemed: loyalty?.total_points_redeemed ?? 0,
    pointsBalance: loyalty?.current_points_balance ?? 0,
    avgRedemptionDelay: loyalty?.avg_redemption_delay_days ?? 0,
    perksRevenue: loyalty?.total_perks_driven_revenue ?? 0,
    totalRevenue: purchase?.lifetime_value ?? 0,
    nextTier: tierProgression[currentTier] ?? null,
    pointsToNextTier: 0, // Would need tier thresholds
  };
};

// =============================================
// RISK & NEGATIVE SIGNALS TRANSFORMERS
// =============================================

export interface RiskDisplayMetrics {
  overallRiskScore: number;
  riskLevel: 'minimal' | 'low' | 'moderate' | 'high' | 'critical';
  riskTrend: 'improving' | 'stable' | 'worsening';
  optOutRiskScore: number;
  ignoreStreakRiskScore: number;
  couponDependencyRiskScore: number;
  bounceRiskScore: number;
  riskFactors: string[];
}

export interface RecentRiskEvent {
  id: string;
  type: string;
  timestamp: string;
  description: string;
}

export const transformToRiskMetrics = (
  risk: CustomerRiskSignals | null
): RiskDisplayMetrics => {
  return {
    overallRiskScore: Math.round(risk?.overall_risk_score ?? 0),
    riskLevel: (risk?.risk_level as RiskDisplayMetrics['riskLevel']) ?? 'minimal',
    riskTrend: (risk?.risk_trend as RiskDisplayMetrics['riskTrend']) ?? 'stable',
    optOutRiskScore: Math.round(risk?.opt_out_risk_score ?? 0),
    ignoreStreakRiskScore: Math.round(risk?.ignore_streak_risk_score ?? 0),
    couponDependencyRiskScore: Math.round(risk?.coupon_dependency_risk_score ?? 0),
    bounceRiskScore: Math.round(risk?.bounce_risk_score ?? 0),
    riskFactors: risk?.risk_factors ?? [],
  };
};

export const transformToRecentRiskEvents = (
  negativeEvents: NegativeBehaviorEvent[]
): RecentRiskEvent[] => {
  return negativeEvents.slice(0, 5).map((event) => ({
    id: event.id,
    type: event.event_type,
    timestamp: event.created_at,
    description: getEventDescription(event),
  }));
};

const getEventDescription = (event: NegativeBehaviorEvent): string => {
  switch (event.event_type) {
    case 'opt_out':
      return `${event.channel?.toUpperCase()} Opt-Out${event.opt_out_source ? ` (${event.opt_out_source})` : ''}`;
    case 'bounce':
      return `Email bounce: ${event.bounce_reason || 'Unknown reason'}`;
    case 'ignore':
      return `Ignored message${event.ignore_streak_length ? ` (streak: ${event.ignore_streak_length})` : ''}`;
    case 'complaint':
      return 'Spam complaint received';
    default:
      return event.event_type.replace(/_/g, ' ');
  }
};

// =============================================
// TIMELINE EVENT TRANSFORMERS
// =============================================

export interface TimelineDisplayEvent {
  id: string;
  type: 'purchase' | 'email_open' | 'email_click' | 'email_sent' | 'sms_click' | 'sms_sent' | 'opt_out' | 'signup' | 'loyalty' | 'redemption' | 'risk' | 'stage_change';
  timestamp: string;
  title: string;
  description: string;
  impact: 'positive' | 'neutral' | 'negative';
}

export const transformToTimelineEvents = (
  events: TimelineEvent[]
): TimelineDisplayEvent[] => {
  return events.map((event) => ({
    id: event.id,
    type: mapEventType(event.event_type, event.event_category) as TimelineDisplayEvent['type'],
    timestamp: event.created_at,
    title: event.title,
    description: event.description,
    impact: event.impact,
  }));
};

const mapEventType = (eventType: string, category: string): string => {
  // Map to component-expected types
  const typeMap: Record<string, string> = {
    purchase: 'purchase',
    open: 'email_open',
    click: 'email_click',
    sms_click: 'sms_click',
    sms_delivered: 'sms_sent',
    opt_out: 'opt_out',
    enrolled: 'signup',
    earn: 'loyalty',
    redeem: 'loyalty',
    stage_change: 'lifecycle',
  };

  return typeMap[eventType] || eventType;
};

// =============================================
// AI INSIGHTS TRANSFORMERS
// =============================================

export interface AIInsightData {
  keyInsight: string;
  patterns: string[];
}

export const transformToAIInsights = (
  customer360: CustomerData | null,
  crossChannel: CustomerCrossChannelMetrics | null,
  purchase: CustomerPurchaseMetrics | null,
  risk: CustomerRiskSignals | null,
  contentIntent: CustomerContentIntentMetrics | null
): AIInsightData => {
  const patterns: string[] = [];

  // Add intent pattern
  if (contentIntent?.intent_score) {
    patterns.push(`${contentIntent.intent_level === 'high' ? 'High' : contentIntent.intent_level === 'medium' ? 'Medium' : 'Low'} intent score (${Math.round(contentIntent.intent_score)})`);
  }

  // Add channel preference pattern
  if (crossChannel?.preferred_channel && crossChannel.preferred_channel !== 'unknown') {
    const pref = crossChannel.preferred_channel;
    patterns.push(`Responds better to ${pref === 'sms' ? 'SMS' : 'Email'} than ${pref === 'sms' ? 'email' : 'SMS'}`);
  }

  // Add purchase patterns
  if (purchase?.discount_driven_ratio && purchase.discount_driven_ratio > 0.5) {
    patterns.push(`Discount-driven buyer (${Math.round(purchase.discount_driven_ratio * 100)}% of purchases with discount)`);
  }

  // Add content preference
  if (contentIntent?.content_preference) {
    patterns.push(`Prefers ${contentIntent.content_preference} content`);
  }

  // Add seasonal pattern if available
  if (purchase?.peak_purchase_month) {
    patterns.push(`Peak purchasing in ${purchase.peak_purchase_month}`);
  }

  // Generate key insight based on most important signals
  let keyInsight = 'No significant patterns detected yet. More engagement data needed.';

  if (risk?.risk_level && ['high', 'critical'].includes(risk.risk_level)) {
    keyInsight = `⚠️ This customer shows ${risk.risk_level} risk signals. ${risk.risk_factors?.[0] || 'Monitor engagement closely.'}`;
  } else if (crossChannel?.fatigue_status && ['high', 'critical'].includes(crossChannel.fatigue_status)) {
    keyInsight = `This customer may be experiencing message fatigue. Consider reducing frequency or varying content types.`;
  } else if (contentIntent?.intent_level === 'high' && purchase?.days_since_last_purchase && purchase.days_since_last_purchase > 30) {
    keyInsight = `High intent customer who hasn't purchased in ${purchase.days_since_last_purchase} days. Good candidate for a targeted offer.`;
  } else if (patterns.length > 0) {
    keyInsight = `Key insight: ${patterns[0]}`;
  }

  return {
    keyInsight,
    patterns: patterns.slice(0, 4),
  };
};
