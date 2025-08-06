import { supabase } from '@/integrations/supabase/client';

export interface AnalyticsEvent {
  event_type: 'link_click' | 'coupon_redeem' | 'share_click' | 'sms_sent' | 'sms_delivered';
  campaign_id?: string;
  automation_id?: string;
  contact_id?: string;
  sms_id?: string;
  message_type?: 'blast' | 'automation_step' | 'manual';
  payload?: Record<string, any>;
}

export class AnalyticsTracker {
  static async trackEvent(event: AnalyticsEvent): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data: userRecord } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!userRecord?.tenant_id) return false;

      const { error } = await supabase
        .from('analytics_events')
        .insert({
          tenant_id: userRecord.tenant_id,
          user_id: user.id,
          ...event
        });

      if (error) {
        console.error('Failed to track event:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Analytics tracking error:', error);
      return false;
    }
  }

  static async trackLinkClick(
    url: string,
    campaignId?: string,
    contactId?: string,
    smsId?: string
  ): Promise<boolean> {
    return this.trackEvent({
      event_type: 'link_click',
      campaign_id: campaignId,
      contact_id: contactId,
      sms_id: smsId,
      payload: { url, timestamp: new Date().toISOString() }
    });
  }

  static async trackCouponRedeem(
    couponCode: string,
    posTxnId: string,
    netSales: number,
    campaignId?: string,
    contactId?: string
  ): Promise<boolean> {
    return this.trackEvent({
      event_type: 'coupon_redeem',
      campaign_id: campaignId,
      contact_id: contactId,
      payload: {
        coupon_code: couponCode,
        pos_txn_id: posTxnId,
        net_sales: netSales,
        timestamp: new Date().toISOString()
      }
    });
  }

  static async trackShareClick(
    shareToken: string,
    recipientPhone: string,
    campaignId?: string
  ): Promise<boolean> {
    return this.trackEvent({
      event_type: 'share_click',
      campaign_id: campaignId,
      payload: {
        share_token: shareToken,
        recipient_msisdn: recipientPhone,
        timestamp: new Date().toISOString()
      }
    });
  }

  static async trackSMSSent(
    campaignId: string,
    contactId: string,
    smsId: string,
    messageType: 'blast' | 'automation_step' | 'manual' = 'blast'
  ): Promise<boolean> {
    return this.trackEvent({
      event_type: 'sms_sent',
      campaign_id: campaignId,
      contact_id: contactId,
      sms_id: smsId,
      message_type: messageType,
      payload: { timestamp: new Date().toISOString() }
    });
  }

  static async getCampaignMetrics(campaignId: string, days: number = 30) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: events, error } = await supabase
        .from('analytics_events')
        .select('*')
        .eq('campaign_id', campaignId)
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      const metrics = {
        total_sent: events?.filter(e => e.event_type === 'sms_sent').length || 0,
        total_delivered: events?.filter(e => e.event_type === 'sms_delivered').length || 0,
        total_clicks: events?.filter(e => e.event_type === 'link_click').length || 0,
        total_redemptions: events?.filter(e => e.event_type === 'coupon_redeem').length || 0,
        total_revenue: events
          ?.filter(e => e.event_type === 'coupon_redeem')
          .reduce((sum, e) => sum + ((e.payload as any)?.net_sales || 0), 0) || 0,
        unique_clicks: new Set(events?.filter(e => e.event_type === 'link_click').map(e => e.contact_id)).size,
        ctr: 0,
        revenue_per_send: 0
      };

      metrics.ctr = metrics.total_sent > 0 ? (metrics.unique_clicks / metrics.total_sent) * 100 : 0;
      metrics.revenue_per_send = metrics.total_sent > 0 ? metrics.total_revenue / metrics.total_sent : 0;

      return metrics;
    } catch (error) {
      console.error('Failed to get campaign metrics:', error);
      return null;
    }
  }
}