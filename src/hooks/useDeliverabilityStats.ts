/**
 * Hook for fetching email deliverability statistics
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';

export interface DeliverabilityStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  skipped: number;
  skippedReasons: Record<string, number>;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

export interface CampaignDeliverabilityStats extends DeliverabilityStats {
  campaignId: string;
}

/**
 * Get 30-day deliverability summary for the current tenant
 */
export function useDeliverabilityStats() {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: ['deliverability-stats', tenantId],
    queryFn: async (): Promise<DeliverabilityStats> => {
      if (!tenantId) {
        return getEmptyStats();
      }

      const { data, error } = await supabase
        .from('deliverability_summary_30d')
        .select('sent_30d, delivered_30d, opened_30d, clicked_30d, bounced_30d, complained_30d')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error || !data) {
        return getEmptyStats();
      }

      // Map the 30d column names to our standard interface
      return calculateRates({
        sent: Number(data.sent_30d) || 0,
        delivered: Number(data.delivered_30d) || 0,
        opened: Number(data.opened_30d) || 0,
        clicked: Number(data.clicked_30d) || 0,
        bounced: Number(data.bounced_30d) || 0,
        complained: Number(data.complained_30d) || 0,
        unsubscribed: 0, // Not tracked in this table
      });
    },
    enabled: !!tenantId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get deliverability stats for a specific campaign
 */
export function useCampaignDeliverabilityStats(campaignId: string | null | undefined) {
  return useQuery({
    queryKey: ['campaign-deliverability', campaignId],
    queryFn: async (): Promise<DeliverabilityStats> => {
      if (!campaignId) {
        return getEmptyStats();
      }

      // Fetch tracking events and skipped sends in parallel
      const [eventsRes, skipsRes] = await Promise.all([
        supabase
          .from('email_tracking_events')
          .select('event_type')
          .eq('campaign_id', campaignId),
        supabase
          .from('email_send_skips')
          .select('reason')
          .eq('campaign_id', campaignId),
      ]);

      const events = eventsRes.data || [];
      const skips = skipsRes.data || [];

      // Aggregate event counts
      const counts = events.reduce((acc, event) => {
        const type = event.event_type;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Aggregate skip reasons
      const skippedReasons: Record<string, number> = {};
      for (const s of skips) {
        skippedReasons[s.reason] = (skippedReasons[s.reason] || 0) + 1;
      }

      return calculateRates({
        sent: counts.sent || 0,
        delivered: counts.delivered || 0,
        opened: counts.opened || 0,
        clicked: counts.clicked || 0,
        bounced: counts.bounced || 0,
        complained: counts.complained || 0,
        unsubscribed: counts.unsubscribed || 0,
        skipped: skips.length,
        skippedReasons,
      });
    },
    enabled: !!campaignId,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

/**
 * Get recent tracking events for a campaign
 */
export function useCampaignTrackingEvents(
  campaignId: string | null | undefined,
  limit: number = 50
) {
  return useQuery({
    queryKey: ['campaign-tracking-events', campaignId, limit],
    queryFn: async () => {
      if (!campaignId) return [];

      const { data, error } = await supabase
        .from('email_tracking_events')
        .select('id, event_type, customer_email, event_data, created_at')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    enabled: !!campaignId,
    staleTime: 30000,
  });
}

function getEmptyStats(): DeliverabilityStats {
  return {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    complained: 0,
    unsubscribed: 0,
    skipped: 0,
    skippedReasons: {},
    deliveryRate: 0,
    openRate: 0,
    clickRate: 0,
    bounceRate: 0,
  };
}

function calculateRates(data: {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  skipped?: number;
  skippedReasons?: Record<string, number>;
}): DeliverabilityStats {
  const { sent, delivered, opened, clicked, bounced, complained, unsubscribed, skipped = 0, skippedReasons = {} } = data;
  
  return {
    sent,
    delivered,
    opened,
    clicked,
    bounced,
    complained,
    unsubscribed,
    skipped,
    skippedReasons,
    deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
    openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
    clickRate: delivered > 0 ? (clicked / delivered) * 100 : 0,
    bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
  };
}
