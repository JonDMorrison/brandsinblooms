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
  // Sync status metadata
  customersSynced: boolean;
  ordersSynced: boolean;
  loyaltySynced: boolean;
  lastSyncedAt: string | null;
  needsOrderSync: boolean;
  needsLoyaltySync: boolean;
}

export const usePOSAnalytics = (days: number = 30) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pos-analytics', user?.id, days],
    queryFn: async (): Promise<POSAnalytics> => {
      const emptyResult: POSAnalytics = {
        totalCustomers: 0,
        totalOrders: 0,
        totalRevenue: 0,
        avgOrderValue: 0,
        loyaltyMembers: 0,
        totalPointsEarned: 0,
        hasIntegration: false,
        integrationName: null,
        customersSynced: false,
        ordersSynced: false,
        loyaltySynced: false,
        lastSyncedAt: null,
        needsOrderSync: false,
        needsLoyaltySync: false
      };

      if (!user?.id) {
        return emptyResult;
      }

      // Get tenant_id from users table
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      const tenantId = userData?.tenant_id;
      
      if (!tenantId) {
        return emptyResult;
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Parallel queries for all POS data
      // First get connections to find IDs for orders query
      const [squareConnectionResult, cloverConnectionResult] = await Promise.all([
        supabase
          .from('square_connections')
          .select('id, merchant_name, last_synced_at')
          .eq('tenant_id', tenantId)
          .in('status', ['active', 'connected'])
          .limit(1),
        supabase
          .from('clover_connections')
          .select('id, merchant_name, last_synced_at')
          .eq('tenant_id', tenantId)
          .in('status', ['active', 'connected'])
          .limit(1)
      ]);

      // Get connection IDs for orders query
      const connectionIds: string[] = [];
      if (squareConnectionResult.data?.[0]?.id) {
        connectionIds.push(squareConnectionResult.data[0].id);
      }
      if (cloverConnectionResult.data?.[0]?.id) {
        connectionIds.push(cloverConnectionResult.data[0].id);
      }

      // Now query customers, orders, and loyalty in parallel
      const [customersResult, ordersResult, loyaltyResult] = await Promise.all([
        // Total customers
        supabase
          .from('crm_customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
        
        // Orders within date range - filter by connection IDs
        connectionIds.length > 0
          ? supabase
              .from('pos_orders')
              .select('total_amount, order_date')
              .in('pos_connection_id', connectionIds)
              .gte('order_date', startDate.toISOString())
          : Promise.resolve({ data: [], error: null }),
        
        // Loyalty members
        supabase
          .from('customer_loyalty_metrics')
          .select('is_perks_member, total_points_earned')
          .eq('tenant_id', tenantId)
          .eq('is_perks_member', true)
      ]);

      const totalCustomers = customersResult.count || 0;
      
      const orders = ordersResult.data || [];
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      
      const loyaltyData = loyaltyResult.data || [];
      const loyaltyMembers = loyaltyData.length;
      const totalPointsEarned = loyaltyData.reduce((sum, l) => sum + (l.total_points_earned || 0), 0);

      // Determine integration info
      let integrationName: string | null = null;
      let lastSyncedAt: string | null = null;
      const hasSquare = squareConnectionResult.data?.length > 0;
      const hasClover = cloverConnectionResult.data?.length > 0;
      
      if (hasSquare) {
        integrationName = squareConnectionResult.data[0].merchant_name || 'Square';
        lastSyncedAt = squareConnectionResult.data[0].last_synced_at || null;
      } else if (hasClover) {
        integrationName = cloverConnectionResult.data[0].merchant_name || 'Clover';
        lastSyncedAt = cloverConnectionResult.data[0].last_synced_at || null;
      }

      const hasIntegration = !!integrationName;
      const customersSynced = totalCustomers > 0;
      const ordersSynced = totalOrders > 0;
      const loyaltySynced = loyaltyMembers > 0;

      return {
        totalCustomers,
        totalOrders,
        totalRevenue,
        avgOrderValue,
        loyaltyMembers,
        totalPointsEarned,
        hasIntegration,
        integrationName,
        customersSynced,
        ordersSynced,
        loyaltySynced,
        lastSyncedAt,
        needsOrderSync: hasIntegration && !ordersSynced,
        needsLoyaltySync: hasIntegration && !loyaltySynced
      };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};
