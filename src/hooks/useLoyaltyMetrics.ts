import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CustomerLoyaltyMetrics, LoyaltyPointsTransaction, TenantLoyaltyStats } from '@/types/customerMetrics';

/**
 * Fetch loyalty metrics for a specific customer
 */
export const useCustomerLoyaltyMetrics = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ['customer-loyalty-metrics', customerId],
    queryFn: async () => {
      if (!customerId) return null;
      
      const { data, error } = await supabase
        .from('customer_loyalty_metrics')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching loyalty metrics:', error);
        throw error;
      }
      
      return data as CustomerLoyaltyMetrics | null;
    },
    enabled: !!customerId,
  });
};

/**
 * Fetch points transaction history for a customer
 */
export const useCustomerPointsHistory = (customerId: string | undefined, limit: number = 20) => {
  return useQuery({
    queryKey: ['customer-points-history', customerId, limit],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('loyalty_points_transactions')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching points history:', error);
        throw error;
      }
      
      return data as LoyaltyPointsTransaction[];
    },
    enabled: !!customerId,
  });
};

/**
 * Fetch perks enrollment events for a customer
 */
export const useCustomerEnrollmentHistory = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ['customer-enrollment-history', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('perks_enrollment_events')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching enrollment history:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!customerId,
  });
};

/**
 * Fetch aggregated loyalty stats for a tenant
 */
export const useTenantLoyaltyStats = (tenantId: string | undefined) => {
  return useQuery({
    queryKey: ['tenant-loyalty-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      // Fetch all loyalty metrics for the tenant
      const { data: metrics, error: metricsError } = await supabase
        .from('customer_loyalty_metrics')
        .select('*')
        .eq('tenant_id', tenantId);
      
      if (metricsError) throw metricsError;
      
      if (!metrics || metrics.length === 0) {
        return null;
      }
      
      // Calculate aggregated stats
      const members = metrics.filter(m => m.is_perks_member);
      const tierCounts = {
        bronze: members.filter(m => m.current_loyalty_tier === 'bronze').length,
        silver: members.filter(m => m.current_loyalty_tier === 'silver').length,
        gold: members.filter(m => m.current_loyalty_tier === 'gold').length,
        platinum: members.filter(m => m.current_loyalty_tier === 'platinum').length,
      };
      
      const stats: TenantLoyaltyStats = {
        perks_enrollment_rate: 0, // Will be calculated via RPC
        avg_time_to_join_days: members.length > 0 
          ? members.reduce((sum, m) => sum + (m.time_to_join_perks_days || 0), 0) / members.length 
          : null,
        avg_points_earned: members.length > 0 
          ? members.reduce((sum, m) => sum + m.total_points_earned, 0) / members.length 
          : 0,
        avg_points_redeemed: members.length > 0 
          ? members.reduce((sum, m) => sum + m.total_points_redeemed, 0) / members.length 
          : 0,
        avg_redemption_frequency: members.length > 0 
          ? members.reduce((sum, m) => sum + m.redemption_frequency, 0) / members.length 
          : 0,
        avg_redemption_delay_days: members.filter(m => m.avg_redemption_delay_days).length > 0 
          ? members.filter(m => m.avg_redemption_delay_days).reduce((sum, m) => sum + (m.avg_redemption_delay_days || 0), 0) / members.filter(m => m.avg_redemption_delay_days).length 
          : null,
        total_perks_driven_revenue: members.reduce((sum, m) => sum + m.total_perks_driven_revenue, 0),
        avg_non_redeemed_ratio: members.length > 0 
          ? members.reduce((sum, m) => sum + m.non_redeemed_points_ratio, 0) / members.length 
          : 0,
        tier_breakdown: tierCounts,
        engagement_difference: {
          member_avg_purchase_frequency: members.length > 0 
            ? members.reduce((sum, m) => sum + (m.member_purchase_frequency || 0), 0) / members.length 
            : 0,
          non_member_avg_purchase_frequency: 0, // Would need separate query
          member_email_open_rate: members.filter(m => m.member_email_open_rate).length > 0 
            ? members.filter(m => m.member_email_open_rate).reduce((sum, m) => sum + (m.member_email_open_rate || 0), 0) / members.filter(m => m.member_email_open_rate).length 
            : 0,
          non_member_email_open_rate: 0, // Would need separate query
        },
      };
      
      // Fetch enrollment rate via RPC
      try {
        const { data: enrollmentRate } = await supabase
          .rpc('calculate_tenant_perks_enrollment_rate', { p_tenant_id: tenantId });
        stats.perks_enrollment_rate = enrollmentRate || 0;
      } catch (e) {
        console.warn('Could not fetch enrollment rate:', e);
      }
      
      return stats;
    },
    enabled: !!tenantId,
  });
};

/**
 * Recalculate loyalty metrics for a customer
 */
export const useRefreshLoyaltyMetrics = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (customerId: string) => {
      const { error } = await supabase.rpc('recalculate_loyalty_metrics', {
        p_customer_id: customerId
      });
      
      if (error) throw error;
      return customerId;
    },
    onSuccess: (customerId) => {
      queryClient.invalidateQueries({ queryKey: ['customer-loyalty-metrics', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer-points-history', customerId] });
    },
  });
};

/**
 * Refresh all loyalty metrics for a tenant
 */
export const refreshAllLoyaltyMetrics = async (tenantId: string): Promise<number> => {
  const { data, error } = await supabase.rpc('refresh_all_loyalty_metrics', {
    p_tenant_id: tenantId
  });
  
  if (error) throw error;
  return data as number;
};
