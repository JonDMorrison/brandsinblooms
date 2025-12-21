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
