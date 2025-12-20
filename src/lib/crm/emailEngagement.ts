/**
 * Email Engagement Metrics Helper Library
 * 
 * Provides utilities for tracking and calculating customer email engagement metrics.
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Customer email engagement metrics interface
 */
export interface CustomerEmailMetrics {
  totalEmailsSent: number;
  totalEmailsDelivered: number;
  totalEmailsOpened: number;
  totalEmailsClicked: number;
  totalEmailsBounced: number;
  totalSoftBounces: number;
  totalHardBounces: number;
  totalUnsubscribes: number;
  emailOpenRate: number;
  emailClickRate: number;
  emailCTOR: number;
  emailBounceRate: number;
  avgTimeToOpenMinutes: number | null;
  avgTimeToClickMinutes: number | null;
  lastEmailSentAt: string | null;
  lastEmailDeliveredAt: string | null;
  lastEmailClickedAt: string | null;
  lastEmailBouncedAt: string | null;
  lastOpenAt: string | null;
  emailEngagementScore: number;
}

/**
 * Email engagement tier based on score
 */
export type EngagementTier = 'highly_engaged' | 'engaged' | 'moderately_engaged' | 'low_engagement' | 'inactive';

/**
 * Get engagement tier label and color based on score
 */
export function getEngagementTier(score: number): { tier: EngagementTier; label: string; color: string } {
  if (score >= 70) {
    return { tier: 'highly_engaged', label: 'Highly Engaged', color: 'text-green-600' };
  } else if (score >= 50) {
    return { tier: 'engaged', label: 'Engaged', color: 'text-blue-600' };
  } else if (score >= 30) {
    return { tier: 'moderately_engaged', label: 'Moderate', color: 'text-yellow-600' };
  } else if (score >= 10) {
    return { tier: 'low_engagement', label: 'Low Engagement', color: 'text-orange-600' };
  } else {
    return { tier: 'inactive', label: 'Inactive', color: 'text-gray-500' };
  }
}

/**
 * Format rate as percentage string
 */
export function formatRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return '0%';
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Format time duration in human readable format
 */
export function formatTimeToEvent(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return 'N/A';
  
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  } else if (minutes < 1440) {
    const hours = Math.round(minutes / 60);
    return `${hours} hr${hours > 1 ? 's' : ''}`;
  } else {
    const days = Math.round(minutes / 1440);
    return `${days} day${days > 1 ? 's' : ''}`;
  }
}

/**
 * Get customer email metrics from database
 */
export async function getCustomerEmailMetrics(customerId: string): Promise<CustomerEmailMetrics | null> {
  const { data: customer, error } = await supabase
    .from('crm_customers')
    .select(`
      total_emails_sent,
      total_emails_delivered,
      total_emails_opened,
      total_emails_clicked,
      total_emails_bounced,
      total_soft_bounces,
      total_hard_bounces,
      total_unsubscribes,
      email_open_rate,
      email_click_rate,
      email_ctor,
      email_bounce_rate,
      avg_time_to_open_minutes,
      avg_time_to_click_minutes,
      last_email_sent_at,
      last_email_delivered_at,
      last_email_clicked_at,
      last_email_bounced_at,
      last_open_at,
      email_engagement_score
    `)
    .eq('id', customerId)
    .single();

  if (error || !customer) {
    console.error('Error fetching customer email metrics:', error);
    return null;
  }

  return {
    totalEmailsSent: customer.total_emails_sent || 0,
    totalEmailsDelivered: customer.total_emails_delivered || 0,
    totalEmailsOpened: customer.total_emails_opened || 0,
    totalEmailsClicked: customer.total_emails_clicked || 0,
    totalEmailsBounced: customer.total_emails_bounced || 0,
    totalSoftBounces: customer.total_soft_bounces || 0,
    totalHardBounces: customer.total_hard_bounces || 0,
    totalUnsubscribes: customer.total_unsubscribes || 0,
    emailOpenRate: Number(customer.email_open_rate) || 0,
    emailClickRate: Number(customer.email_click_rate) || 0,
    emailCTOR: Number(customer.email_ctor) || 0,
    emailBounceRate: Number(customer.email_bounce_rate) || 0,
    avgTimeToOpenMinutes: customer.avg_time_to_open_minutes,
    avgTimeToClickMinutes: customer.avg_time_to_click_minutes,
    lastEmailSentAt: customer.last_email_sent_at,
    lastEmailDeliveredAt: customer.last_email_delivered_at,
    lastEmailClickedAt: customer.last_email_clicked_at,
    lastEmailBouncedAt: customer.last_email_bounced_at,
    lastOpenAt: customer.last_open_at,
    emailEngagementScore: Number(customer.email_engagement_score) || 0
  };
}

/**
 * Get aggregated email metrics for a tenant
 */
export async function getTenantEmailMetrics(tenantId: string): Promise<{
  totalCustomers: number;
  avgOpenRate: number;
  avgClickRate: number;
  avgEngagementScore: number;
  engagementTierDistribution: Record<EngagementTier, number>;
}> {
  const { data: customers, error } = await supabase
    .from('crm_customers')
    .select('email_open_rate, email_click_rate, email_engagement_score, total_emails_sent')
    .eq('tenant_id', tenantId)
    .gt('total_emails_sent', 0);

  if (error || !customers) {
    return {
      totalCustomers: 0,
      avgOpenRate: 0,
      avgClickRate: 0,
      avgEngagementScore: 0,
      engagementTierDistribution: {
        highly_engaged: 0,
        engaged: 0,
        moderately_engaged: 0,
        low_engagement: 0,
        inactive: 0
      }
    };
  }

  const tierDistribution: Record<EngagementTier, number> = {
    highly_engaged: 0,
    engaged: 0,
    moderately_engaged: 0,
    low_engagement: 0,
    inactive: 0
  };

  let totalOpenRate = 0;
  let totalClickRate = 0;
  let totalScore = 0;

  customers.forEach(c => {
    const score = Number(c.email_engagement_score) || 0;
    totalOpenRate += Number(c.email_open_rate) || 0;
    totalClickRate += Number(c.email_click_rate) || 0;
    totalScore += score;
    
    const { tier } = getEngagementTier(score);
    tierDistribution[tier]++;
  });

  const count = customers.length || 1;

  return {
    totalCustomers: customers.length,
    avgOpenRate: totalOpenRate / count,
    avgClickRate: totalClickRate / count,
    avgEngagementScore: totalScore / count,
    engagementTierDistribution: tierDistribution
  };
}

/**
 * Calculate engagement score from raw metrics
 * Weighted: open_rate (30%) + click_rate (40%) + recency (30%)
 */
export function calculateEngagementScore(
  openRate: number,
  clickRate: number,
  lastOpenAt: Date | null
): number {
  const openScore = Math.min(openRate, 1) * 30;
  const clickScore = Math.min(clickRate, 1) * 40;
  
  let recencyScore = 0;
  if (lastOpenAt) {
    const daysSinceOpen = (Date.now() - lastOpenAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceOpen <= 30) {
      recencyScore = 30;
    } else if (daysSinceOpen <= 90) {
      recencyScore = 20;
    } else if (daysSinceOpen <= 180) {
      recencyScore = 10;
    }
  }
  
  return Math.round(openScore + clickScore + recencyScore);
}
