import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import type { 
  CustomerRiskSignals, 
  NegativeBehaviorEvent,
  TenantRiskStats,
  RiskLevel 
} from "@/types/customerMetrics";

/**
 * Hook to fetch risk signals for a specific customer
 */
export const useCustomerRiskSignals = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ['customer-risk-signals', customerId],
    queryFn: async () => {
      if (!customerId) return null;
      
      const { data, error } = await supabase
        .from('customer_risk_signals')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching risk signals:', error);
        throw error;
      }
      
      return data as CustomerRiskSignals | null;
    },
    enabled: !!customerId,
  });
};

/**
 * Hook to fetch negative behavior events for a customer
 */
export const useCustomerNegativeEvents = (customerId: string | undefined, limit: number = 20) => {
  return useQuery({
    queryKey: ['customer-negative-events', customerId, limit],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('negative_behavior_events')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching negative events:', error);
        throw error;
      }
      
      return (data || []) as NegativeBehaviorEvent[];
    },
    enabled: !!customerId,
  });
};

/**
 * Hook to fetch tenant-level risk statistics
 */
export const useTenantRiskStats = (tenantId: string | undefined) => {
  return useQuery({
    queryKey: ['tenant-risk-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data, error } = await supabase
        .rpc('get_tenant_risk_stats', { p_tenant_id: tenantId });
      
      if (error) {
        console.error('Error fetching tenant risk stats:', error);
        throw error;
      }
      
      return data as unknown as TenantRiskStats;
    },
    enabled: !!tenantId,
  });
};

/**
 * Hook to fetch high-risk customers for a tenant
 */
export const useHighRiskCustomers = (tenantId: string | undefined, limit: number = 10) => {
  return useQuery({
    queryKey: ['high-risk-customers', tenantId, limit],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('customer_risk_signals')
        .select(`
          *,
          crm_customers (
            id,
            email,
            first_name,
            last_name,
            phone
          )
        `)
        .eq('tenant_id', tenantId)
        .in('risk_level', ['high', 'critical'])
        .order('overall_risk_score', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching high-risk customers:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!tenantId,
  });
};

/**
 * Hook to refresh risk signals for a customer
 */
export const useRefreshRiskSignals = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (customerId: string) => {
      const { error } = await supabase
        .rpc('recalculate_risk_signals', { p_customer_id: customerId });
      
      if (error) {
        console.error('Error refreshing risk signals:', error);
        throw error;
      }
      
      return true;
    },
    onSuccess: (_, customerId) => {
      queryClient.invalidateQueries({ queryKey: ['customer-risk-signals', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer-negative-events', customerId] });
    },
  });
};

/**
 * Hook to refresh all risk signals for a tenant
 */
export const useRefreshAllRiskSignals = () => {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('Tenant ID required');
      
      const { data, error } = await supabase
        .rpc('refresh_all_risk_signals', { p_tenant_id: tenant.id });
      
      if (error) {
        console.error('Error refreshing all risk signals:', error);
        throw error;
      }
      
      return data as number;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-risk-stats'] });
      queryClient.invalidateQueries({ queryKey: ['high-risk-customers'] });
    },
  });
};

// =============================================
// UI Helper Functions
// =============================================

export interface RiskLevelConfig {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  description: string;
}

export const getRiskLevelConfig = (level: RiskLevel | undefined): RiskLevelConfig => {
  switch (level) {
    case 'critical':
      return {
        label: 'Critical',
        color: 'text-red-700 dark:text-red-300',
        bgColor: 'bg-red-100 dark:bg-red-950/50',
        icon: '🚨',
        description: 'Immediate action required - suppress messaging'
      };
    case 'high':
      return {
        label: 'High',
        color: 'text-orange-700 dark:text-orange-300',
        bgColor: 'bg-orange-100 dark:bg-orange-950/50',
        icon: '⚠️',
        description: 'Consider reducing message frequency'
      };
    case 'moderate':
      return {
        label: 'Moderate',
        color: 'text-yellow-700 dark:text-yellow-300',
        bgColor: 'bg-yellow-100 dark:bg-yellow-950/50',
        icon: '⚡',
        description: 'Monitor patterns closely'
      };
    case 'low':
      return {
        label: 'Low',
        color: 'text-blue-700 dark:text-blue-300',
        bgColor: 'bg-blue-100 dark:bg-blue-950/50',
        icon: '📊',
        description: 'Normal messaging acceptable'
      };
    case 'minimal':
      return {
        label: 'Minimal',
        color: 'text-emerald-700 dark:text-emerald-300',
        bgColor: 'bg-emerald-100 dark:bg-emerald-950/50',
        icon: '✅',
        description: 'Healthy engagement patterns'
      };
    default:
      return {
        label: 'Unknown',
        color: 'text-gray-700 dark:text-gray-300',
        bgColor: 'bg-gray-100 dark:bg-gray-950/50',
        icon: '❓',
        description: 'No risk data available'
      };
  }
};

export interface RiskTrendConfig {
  label: string;
  color: string;
  icon: string;
}

export const getRiskTrendConfig = (trend: string | undefined): RiskTrendConfig => {
  switch (trend) {
    case 'improving':
      return {
        label: 'Improving',
        color: 'text-emerald-600',
        icon: '↗️'
      };
    case 'worsening':
      return {
        label: 'Worsening',
        color: 'text-red-600',
        icon: '↘️'
      };
    case 'stable':
    default:
      return {
        label: 'Stable',
        color: 'text-gray-600',
        icon: '→'
      };
  }
};

export const getRiskFactorLabel = (factor: string): string => {
  const labels: Record<string, string> = {
    'rapid_opt_out': 'Rapid Opt-Out',
    'multiple_opt_outs': 'Multiple Opt-Outs',
    'ignoring_messages': 'Ignoring Messages',
    'no_engagement': 'No Engagement',
    'incentive_stacking': 'Incentive Stacking',
    'incentive_sharing': 'Incentive Sharing',
    'suspected_abuser': 'Suspected Abuser',
    'coupon_dependent': 'Coupon Dependent',
    'long_term_dormant': 'Long-Term Dormant',
    'multiple_hard_bounces': 'Multiple Hard Bounces',
    'invalid_email': 'Invalid Email'
  };
  return labels[factor] || factor.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export const getEventTypeConfig = (eventType: string): { label: string; color: string; icon: string } => {
  switch (eventType) {
    case 'opt_out':
      return { label: 'Opt-Out', color: 'text-red-600', icon: '🚫' };
    case 'bounce':
      return { label: 'Bounce', color: 'text-orange-600', icon: '📭' };
    case 'complaint':
      return { label: 'Complaint', color: 'text-red-700', icon: '⚠️' };
    case 'ignore':
      return { label: 'Ignored', color: 'text-yellow-600', icon: '🔕' };
    case 'abuse':
      return { label: 'Abuse', color: 'text-purple-600', icon: '🎭' };
    case 'undeliverable':
      return { label: 'Undeliverable', color: 'text-gray-600', icon: '❌' };
    default:
      return { label: eventType, color: 'text-gray-600', icon: '📌' };
  }
};
