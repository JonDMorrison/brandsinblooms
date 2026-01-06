import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface POSAnalytics {
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  loyaltyMembers: number;
  totalPointsEarned: number;
  hasIntegration: boolean;
  integrationName: string | null;
}

export const usePOSAnalytics = (days: number = 30) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pos-analytics', user?.id, days],
    queryFn: async (): Promise<POSAnalytics> => {
      if (!user?.id) {
        return {
          totalCustomers: 0,
          totalOrders: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
          loyaltyMembers: 0,
          totalPointsEarned: 0,
          hasIntegration: false,
          integrationName: null
        };
      }

      // Get tenant_id from users table
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      const tenantId = userData?.tenant_id;
      
      if (!tenantId) {
        return {
          totalCustomers: 0,
          totalOrders: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
          loyaltyMembers: 0,
          totalPointsEarned: 0,
          hasIntegration: false,
          integrationName: null
        };
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Parallel queries for all POS data
      const [
        customersResult,
        ordersResult,
        loyaltyResult,
        squareConnectionResult,
        cloverConnectionResult
      ] = await Promise.all([
        // Total customers
        supabase
          .from('crm_customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
        
        // Orders within date range
        supabase
          .from('pos_orders')
          .select('total_amount, order_date')
          .gte('order_date', startDate.toISOString()),
        
        // Loyalty members
        supabase
          .from('customer_loyalty_metrics')
          .select('is_perks_member, total_points_earned')
          .eq('tenant_id', tenantId)
          .eq('is_perks_member', true),
        
        // Check for Square connection
        supabase
          .from('square_connections')
          .select('id, merchant_name')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .limit(1),
        
        // Check for Clover connection
        supabase
          .from('clover_connections')
          .select('id, merchant_name')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .limit(1)
      ]);

      const totalCustomers = customersResult.count || 0;
      
      const orders = ordersResult.data || [];
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      
      const loyaltyData = loyaltyResult.data || [];
      const loyaltyMembers = loyaltyData.length;
      const totalPointsEarned = loyaltyData.reduce((sum, l) => sum + (l.total_points_earned || 0), 0);

      // Determine integration name
      let integrationName: string | null = null;
      if (squareConnectionResult.data?.length) {
        integrationName = squareConnectionResult.data[0].merchant_name || 'Square';
      } else if (cloverConnectionResult.data?.length) {
        integrationName = cloverConnectionResult.data[0].merchant_name || 'Clover';
      }

      return {
        totalCustomers,
        totalOrders,
        totalRevenue,
        avgOrderValue,
        loyaltyMembers,
        totalPointsEarned,
        hasIntegration: !!integrationName,
        integrationName
      };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};
