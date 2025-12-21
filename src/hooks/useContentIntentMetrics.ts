import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import type { 
  CustomerContentIntentMetrics, 
  ContentInteractionEvent,
  TenantContentIntentStats,
  IntentLevel 
} from "@/types/customerMetrics";

/**
 * Hook to fetch content intent metrics for a specific customer
 */
export const useCustomerContentIntentMetrics = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ['customer-content-intent-metrics', customerId],
    queryFn: async () => {
      if (!customerId) return null;
      
      const { data, error } = await supabase
        .from('customer_content_intent_metrics')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching content intent metrics:', error);
        throw error;
      }
      
      return data as CustomerContentIntentMetrics | null;
    },
    enabled: !!customerId,
  });
};

/**
 * Hook to fetch content interaction history for a customer
 */
export const useCustomerInteractionHistory = (customerId: string | undefined, limit: number = 50) => {
  return useQuery({
    queryKey: ['customer-interaction-history', customerId, limit],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('content_interaction_events')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching interaction history:', error);
        throw error;
      }
      
      return (data || []) as ContentInteractionEvent[];
    },
    enabled: !!customerId,
  });
};

/**
 * Hook to fetch tenant-level content intent statistics
 */
export const useTenantContentIntentStats = (tenantId: string | undefined) => {
  return useQuery({
    queryKey: ['tenant-content-intent-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data, error } = await supabase
        .rpc('get_tenant_content_intent_stats', { p_tenant_id: tenantId });
      
      if (error) {
        console.error('Error fetching tenant content intent stats:', error);
        throw error;
      }
      
      return data as unknown as TenantContentIntentStats;
    },
    enabled: !!tenantId,
  });
};

/**
 * Hook to fetch high-intent customers for a tenant
 */
export const useHighIntentCustomers = (tenantId: string | undefined, limit: number = 10) => {
  return useQuery({
    queryKey: ['high-intent-customers', tenantId, limit],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('customer_content_intent_metrics')
        .select(`
          *,
          crm_customers (
            id,
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .eq('tenant_id', tenantId)
        .eq('intent_level', 'high')
        .order('intent_score', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching high-intent customers:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!tenantId,
  });
};

/**
 * Hook to refresh content intent metrics for a customer
 */
export const useRefreshContentIntentMetrics = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (customerId: string) => {
      const { error } = await supabase
        .rpc('recalculate_content_intent_metrics', { p_customer_id: customerId });
      
      if (error) {
        console.error('Error refreshing content intent metrics:', error);
        throw error;
      }
      
      return customerId;
    },
    onSuccess: (customerId) => {
      queryClient.invalidateQueries({ queryKey: ['customer-content-intent-metrics', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer-interaction-history', customerId] });
    },
  });
};

/**
 * Hook to refresh all content intent metrics for a tenant
 */
export const useRefreshAllContentIntentMetrics = () => {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('No tenant found');
      
      const { data, error } = await supabase
        .rpc('refresh_all_content_intent_metrics', { p_tenant_id: tenant.id });
      
      if (error) {
        console.error('Error refreshing all content intent metrics:', error);
        throw error;
      }
      
      return data as number;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-content-intent-stats'] });
      queryClient.invalidateQueries({ queryKey: ['high-intent-customers'] });
    },
  });
};

/**
 * Helper function to get intent level configuration for UI display
 */
export const getIntentLevelConfig = (level: IntentLevel) => {
  const configs: Record<IntentLevel, { label: string; color: string; bgColor: string; description: string }> = {
    high: {
      label: 'High Intent',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: 'Highly engaged, frequent CTA clicks, quick responses'
    },
    medium: {
      label: 'Medium Intent',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'Regular engagement, some CTA interactions'
    },
    low: {
      label: 'Low Intent',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      description: 'Occasional engagement, rare CTA clicks'
    },
    unknown: {
      label: 'Unknown',
      color: 'text-gray-500',
      bgColor: 'bg-gray-50',
      description: 'Insufficient data to determine intent'
    }
  };
  
  return configs[level] || configs.unknown;
};

/**
 * Helper function to get content preference configuration
 */
export const getContentPreferenceConfig = (preference: 'educational' | 'promotional' | 'balanced') => {
  const configs = {
    educational: {
      label: 'Educational',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      icon: '📚',
      description: 'Prefers how-to guides, tips, and informative content'
    },
    promotional: {
      label: 'Promotional',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      icon: '🏷️',
      description: 'Responds well to sales, discounts, and offers'
    },
    balanced: {
      label: 'Balanced',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      icon: '⚖️',
      description: 'Engages equally with both content types'
    }
  };
  
  return configs[preference] || configs.balanced;
};

/**
 * Helper to get click timing pattern configuration
 */
export const getClickTimingConfig = (pattern: 'immediate' | 'considered' | 'delayed' | 'unknown') => {
  const configs = {
    immediate: {
      label: 'Immediate',
      color: 'text-green-600',
      description: 'Clicks within 5 minutes of viewing'
    },
    considered: {
      label: 'Considered',
      color: 'text-blue-600',
      description: 'Takes time to review before clicking (5min - 2hr)'
    },
    delayed: {
      label: 'Delayed',
      color: 'text-amber-600',
      description: 'Returns later to click (>2 hours)'
    },
    unknown: {
      label: 'Unknown',
      color: 'text-gray-500',
      description: 'Insufficient data'
    }
  };
  
  return configs[pattern] || configs.unknown;
};
