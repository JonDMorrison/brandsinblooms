import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CustomerPostPurchaseMetrics, IncentiveTracking, PostPurchaseStats } from '@/types/customerMetrics';

/**
 * Fetch post-purchase metrics for a specific customer
 */
export function useCustomerPostPurchaseMetrics(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-post-purchase-metrics', customerId],
    queryFn: async () => {
      if (!customerId) throw new Error('Customer ID required');
      
      const { data, error } = await supabase
        .from('customer_post_purchase_metrics')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (error) throw error;
      return data as CustomerPostPurchaseMetrics | null;
    },
    enabled: !!customerId,
  });
}

/**
 * Fetch incentive history for a specific customer
 */
export function useCustomerIncentiveHistory(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-incentive-history', customerId],
    queryFn: async () => {
      if (!customerId) throw new Error('Customer ID required');
      
      const { data, error } = await supabase
        .from('incentive_tracking')
        .select('*')
        .eq('customer_id', customerId)
        .order('sent_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as IncentiveTracking[];
    },
    enabled: !!customerId,
  });
}

/**
 * Fetch aggregated post-purchase stats for a tenant
 */
export function useTenantPostPurchaseStats(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['tenant-post-purchase-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant ID required');
      
      const { data, error } = await supabase
        .from('customer_post_purchase_metrics')
        .select('*')
        .eq('tenant_id', tenantId);

      if (error) throw error;

      if (!data || data.length === 0) {
        return null;
      }

      // Calculate aggregates
      const stats: PostPurchaseStats = {
        avgEmailOpenRate: data.reduce((sum, m) => sum + Number(m.post_purchase_email_open_rate || 0), 0) / data.length,
        avgFollowUpCtr: data.reduce((sum, m) => sum + Number(m.post_purchase_follow_up_ctr || 0), 0) / data.length,
        avgTimeToNextPurchase: data.filter(m => m.avg_time_to_next_purchase_days != null).length > 0
          ? data.reduce((sum, m) => sum + Number(m.avg_time_to_next_purchase_days || 0), 0) / 
            data.filter(m => m.avg_time_to_next_purchase_days != null).length
          : null,
        avgRedemptionRate: data.reduce((sum, m) => sum + Number(m.incentive_redemption_rate || 0), 0) / data.length,
        avgCouponUsageFrequency: data.reduce((sum, m) => sum + Number(m.coupon_usage_frequency || 0), 0) / data.length,
        avgIncentiveDependencyScore: data.reduce((sum, m) => sum + Number(m.incentive_dependency_score || 0), 0) / data.length,
        avgAutomationConversionRate: data.reduce((sum, m) => sum + Number(m.automation_conversion_rate || 0), 0) / data.length,
        avgDropOffRate: data.reduce((sum, m) => sum + Number(m.drop_off_after_incentive_rate || 0), 0) / data.length,
      };

      return stats;
    },
    enabled: !!tenantId,
  });
}

/**
 * Mutation to recalculate post-purchase metrics for a customer
 */
export function useRefreshPostPurchaseMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customerId: string) => {
      const { data, error } = await supabase.rpc('recalculate_post_purchase_metrics', {
        p_customer_id: customerId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, customerId) => {
      queryClient.invalidateQueries({ queryKey: ['customer-post-purchase-metrics', customerId] });
    },
  });
}

/**
 * Utility function to refresh all post-purchase metrics for a tenant
 */
export async function refreshAllPostPurchaseMetrics(tenantId?: string) {
  const { data, error } = await supabase.rpc('refresh_all_post_purchase_metrics', {
    p_tenant_id: tenantId || null,
  });

  if (error) throw error;
  return data;
}
