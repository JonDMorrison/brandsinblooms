import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CustomerSmsMetrics, Customer360Enriched, SmsEngagementStats } from '@/types/customerMetrics';

/**
 * Fetch SMS metrics for a specific customer
 */
export function useCustomerSmsMetrics(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-sms-metrics', customerId],
    queryFn: async (): Promise<CustomerSmsMetrics | null> => {
      if (!customerId) return null;
      
      const { data, error } = await supabase
        .from('customer_sms_metrics')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching SMS metrics:', error);
        throw error;
      }
      
      return data as CustomerSmsMetrics | null;
    },
    enabled: !!customerId,
  });
}

/**
 * Fetch enriched customer data from the 360 view
 */
export function useCustomer360(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-360', customerId],
    queryFn: async (): Promise<Customer360Enriched | null> => {
      if (!customerId) return null;
      
      const { data, error } = await supabase
        .from('customer_360_enriched')
        .select('*')
        .eq('id', customerId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching customer 360 data:', error);
        throw error;
      }
      
      return data as Customer360Enriched | null;
    },
    enabled: !!customerId,
  });
}

/**
 * Fetch aggregated SMS engagement stats for a tenant
 */
export function useTenantSmsStats(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['tenant-sms-stats', tenantId],
    queryFn: async (): Promise<SmsEngagementStats> => {
      if (!tenantId) {
        return {
          totalSent: 0,
          deliveryRate: 0,
          clickRate: 0,
          replyRate: 0,
          optOutRate: 0,
          avgResponseTimeMinutes: null,
        };
      }
      
      const { data, error } = await supabase
        .from('customer_sms_metrics')
        .select('total_sent, total_delivered, total_clicked, total_replied, total_opt_outs, avg_time_to_response_minutes')
        .eq('tenant_id', tenantId);
      
      if (error) {
        console.error('Error fetching tenant SMS stats:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        return {
          totalSent: 0,
          deliveryRate: 0,
          clickRate: 0,
          replyRate: 0,
          optOutRate: 0,
          avgResponseTimeMinutes: null,
        };
      }
      
      // Aggregate stats across all customers
      const totals = data.reduce((acc, row) => ({
        sent: acc.sent + (row.total_sent || 0),
        delivered: acc.delivered + (row.total_delivered || 0),
        clicked: acc.clicked + (row.total_clicked || 0),
        replied: acc.replied + (row.total_replied || 0),
        optOuts: acc.optOuts + (row.total_opt_outs || 0),
        responseTimeSum: acc.responseTimeSum + (row.avg_time_to_response_minutes || 0),
        responseTimeCount: acc.responseTimeCount + (row.avg_time_to_response_minutes ? 1 : 0),
      }), { sent: 0, delivered: 0, clicked: 0, replied: 0, optOuts: 0, responseTimeSum: 0, responseTimeCount: 0 });
      
      return {
        totalSent: totals.sent,
        deliveryRate: totals.sent > 0 ? (totals.delivered / totals.sent) * 100 : 0,
        clickRate: totals.delivered > 0 ? (totals.clicked / totals.delivered) * 100 : 0,
        replyRate: totals.sent > 0 ? (totals.replied / totals.sent) * 100 : 0,
        optOutRate: totals.sent > 0 ? (totals.optOuts / totals.sent) * 100 : 0,
        avgResponseTimeMinutes: totals.responseTimeCount > 0 
          ? totals.responseTimeSum / totals.responseTimeCount 
          : null,
      };
    },
    enabled: !!tenantId,
  });
}

/**
 * Fetch SMS metrics for a campaign
 */
export function useCampaignSmsStats(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['campaign-sms-stats', campaignId],
    queryFn: async () => {
      if (!campaignId) return null;
      
      const { data, error } = await supabase
        .from('sms_messages')
        .select('status')
        .eq('campaign_id', campaignId);
      
      if (error) {
        console.error('Error fetching campaign SMS stats:', error);
        throw error;
      }
      
      const messages = data || [];
      const totalSent = messages.length;
      const delivered = messages.filter(m => m.status === 'delivered').length;
      const failed = messages.filter(m => m.status === 'failed').length;
      
      return {
        totalSent,
        delivered,
        failed,
        deliveryRate: totalSent > 0 ? (delivered / totalSent) * 100 : 0,
      };
    },
    enabled: !!campaignId,
  });
}
