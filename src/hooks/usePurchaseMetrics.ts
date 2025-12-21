import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CustomerPurchaseMetrics, PurchaseStats } from '@/types/customerMetrics';

/**
 * Hook to fetch purchase metrics for a specific customer
 */
export function useCustomerPurchaseMetrics(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-purchase-metrics', customerId],
    queryFn: async () => {
      if (!customerId) return null;
      
      const { data, error } = await supabase
        .from('customer_purchase_metrics')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (error) throw error;
      return data as CustomerPurchaseMetrics | null;
    },
    enabled: !!customerId,
  });
}

/**
 * Hook to fetch aggregated purchase stats for a tenant
 */
export function useTenantPurchaseStats(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['tenant-purchase-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data, error } = await supabase
        .from('customer_purchase_metrics')
        .select('average_order_value, lifetime_value, purchase_frequency, customer_tier')
        .eq('tenant_id', tenantId);

      if (error) throw error;
      if (!data || data.length === 0) return null;

      const stats: PurchaseStats = {
        avgAOV: data.reduce((sum, m) => sum + Number(m.average_order_value || 0), 0) / data.length,
        totalLTV: data.reduce((sum, m) => sum + Number(m.lifetime_value || 0), 0),
        avgPurchaseFrequency: data.reduce((sum, m) => sum + Number(m.purchase_frequency || 0), 0) / data.length,
        tierBreakdown: {
          new: data.filter(m => m.customer_tier === 'new').length,
          occasional: data.filter(m => m.customer_tier === 'occasional').length,
          regular: data.filter(m => m.customer_tier === 'regular').length,
          loyal: data.filter(m => m.customer_tier === 'loyal').length,
          vip: data.filter(m => m.customer_tier === 'vip').length,
        },
      };

      return stats;
    },
    enabled: !!tenantId,
  });
}

/**
 * Hook to refresh purchase metrics for a specific customer
 */
export function useRefreshPurchaseMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customerId: string) => {
      const { error } = await supabase.rpc('recalculate_purchase_metrics', {
        p_customer_id: customerId,
      });

      if (error) throw error;
    },
    onSuccess: (_, customerId) => {
      queryClient.invalidateQueries({ queryKey: ['customer-purchase-metrics', customerId] });
    },
  });
}

/**
 * Utility to refresh all purchase metrics for a tenant
 */
export async function refreshAllPurchaseMetrics(tenantId?: string) {
  const { data, error } = await supabase.rpc('refresh_all_purchase_metrics', {
    p_tenant_id: tenantId || null,
  });

  if (error) throw error;
  return data as number;
}
