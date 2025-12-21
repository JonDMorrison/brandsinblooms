import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import type { CustomerLifecycleMetrics, LifecycleEvent, TenantLifecycleStats } from '@/types/customerMetrics';

/**
 * Hook to fetch lifecycle metrics for a specific customer
 */
export const useCustomerLifecycleMetrics = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ['customer-lifecycle-metrics', customerId],
    queryFn: async () => {
      if (!customerId) return null;
      
      const { data, error } = await supabase
        .from('customer_lifecycle_metrics')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (error) throw error;
      return data as CustomerLifecycleMetrics | null;
    },
    enabled: !!customerId,
  });
};

/**
 * Hook to fetch lifecycle event history for a customer
 */
export const useCustomerLifecycleHistory = (customerId: string | undefined, limit = 20) => {
  return useQuery({
    queryKey: ['customer-lifecycle-history', customerId, limit],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('customer_lifecycle_events')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as LifecycleEvent[];
    },
    enabled: !!customerId,
  });
};

/**
 * Hook to fetch tenant-wide lifecycle statistics
 */
export const useTenantLifecycleStats = () => {
  const { tenant } = useTenant();
  
  return useQuery({
    queryKey: ['tenant-lifecycle-stats', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;
      
      const { data, error } = await supabase
        .rpc('get_tenant_lifecycle_stats', { p_tenant_id: tenant.id });

      if (error) throw error;
      return data as unknown as TenantLifecycleStats;
    },
    enabled: !!tenant?.id,
  });
};

/**
 * Hook to get at-risk customers for a tenant
 */
export const useAtRiskCustomers = (limit = 10) => {
  const { tenant } = useTenant();
  
  return useQuery({
    queryKey: ['at-risk-customers', tenant?.id, limit],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      const { data, error } = await supabase
        .from('customer_lifecycle_metrics')
        .select(`
          *,
          crm_customers!inner (
            id,
            email,
            first_name,
            last_name,
            phone
          )
        `)
        .eq('tenant_id', tenant.id)
        .eq('lifecycle_stage', 'at_risk')
        .order('churn_risk_score', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });
};

/**
 * Hook to refresh lifecycle metrics for a specific customer
 */
export const useRefreshLifecycleMetrics = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (customerId: string) => {
      const { error } = await supabase
        .rpc('recalculate_lifecycle_metrics', { p_customer_id: customerId });

      if (error) throw error;
    },
    onSuccess: (_, customerId) => {
      queryClient.invalidateQueries({ queryKey: ['customer-lifecycle-metrics', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer-lifecycle-history', customerId] });
    },
  });
};

/**
 * Hook to refresh all lifecycle metrics for a tenant
 */
export const useRefreshAllLifecycleMetrics = () => {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('No tenant ID');
      
      const { data, error } = await supabase
        .rpc('refresh_all_lifecycle_metrics', { p_tenant_id: tenant.id });

      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-lifecycle-stats'] });
      queryClient.invalidateQueries({ queryKey: ['at-risk-customers'] });
    },
  });
};

/**
 * Helper function to get lifecycle stage configuration
 */
export const getLifecycleStageConfig = (stage: string) => {
  const configs: Record<string, { label: string; icon: string; color: string; bgColor: string; borderColor: string }> = {
    new: {
      label: 'New',
      icon: '🌱',
      color: 'text-slate-600',
      bgColor: 'bg-slate-100',
      borderColor: 'border-slate-300',
    },
    engaged: {
      label: 'Engaged',
      icon: '💬',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-300',
    },
    active_buyer: {
      label: 'Active Buyer',
      icon: '🛒',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
      borderColor: 'border-emerald-300',
    },
    loyal: {
      label: 'Loyal',
      icon: '👑',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
      borderColor: 'border-amber-300',
    },
    at_risk: {
      label: 'At Risk',
      icon: '⚠️',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      borderColor: 'border-orange-300',
    },
    dormant: {
      label: 'Dormant',
      icon: '😴',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-300',
    },
    churned: {
      label: 'Churned',
      icon: '💔',
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      borderColor: 'border-red-300',
    },
  };
  
  return configs[stage] || configs.new;
};
