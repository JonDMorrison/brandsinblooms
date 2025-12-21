import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CustomerCrossChannelMetrics, CrossChannelStats } from '@/types/customerMetrics';

/**
 * Fetch cross-channel metrics for a specific customer
 */
export function useCustomerCrossChannelMetrics(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-cross-channel-metrics', customerId],
    queryFn: async () => {
      if (!customerId) throw new Error('Customer ID required');

      const { data, error } = await supabase
        .from('customer_cross_channel_metrics')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (error) throw error;
      return data as CustomerCrossChannelMetrics | null;
    },
    enabled: !!customerId,
  });
}

/**
 * Fetch aggregated cross-channel stats for a tenant
 */
export function useTenantCrossChannelStats(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['tenant-cross-channel-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('customer_cross_channel_metrics')
        .select('*')
        .eq('tenant_id', tenantId);

      if (error) throw error;
      if (!data || data.length === 0) {
        return {
          avgMultiChannelScore: 0,
          preferredChannelBreakdown: { email: 0, sms: 0, equal: 0, unknown: 0 },
          fatigueStatusBreakdown: { none: 0, low: 0, moderate: 0, high: 0, critical: 0 },
          avgDaysSinceLastEngagement: 0,
        } as CrossChannelStats;
      }

      // Calculate aggregated stats
      const totalCustomers = data.length;
      const avgMultiChannelScore =
        data.reduce((sum, c) => sum + Number(c.multi_channel_score || 0), 0) / totalCustomers;

      const preferredChannelBreakdown = {
        email: data.filter((c) => c.preferred_channel === 'email').length,
        sms: data.filter((c) => c.preferred_channel === 'sms').length,
        equal: data.filter((c) => c.preferred_channel === 'equal').length,
        unknown: data.filter((c) => c.preferred_channel === 'unknown').length,
      };

      const fatigueStatusBreakdown = {
        none: data.filter((c) => c.fatigue_status === 'none').length,
        low: data.filter((c) => c.fatigue_status === 'low').length,
        moderate: data.filter((c) => c.fatigue_status === 'moderate').length,
        high: data.filter((c) => c.fatigue_status === 'high').length,
        critical: data.filter((c) => c.fatigue_status === 'critical').length,
      };

      const avgDaysSinceLastEngagement =
        data.reduce((sum, c) => sum + (c.days_since_last_engagement || 0), 0) / totalCustomers;

      return {
        avgMultiChannelScore,
        preferredChannelBreakdown,
        fatigueStatusBreakdown,
        avgDaysSinceLastEngagement,
      } as CrossChannelStats;
    },
    enabled: !!tenantId,
  });
}

/**
 * Trigger a refresh of cross-channel metrics for all customers in a tenant
 */
export async function refreshAllCrossChannelMetrics(tenantId?: string) {
  const { data, error } = await supabase.rpc('refresh_all_cross_channel_metrics', {
    p_tenant_id: tenantId || null,
  });

  if (error) throw error;
  return data as number;
}
