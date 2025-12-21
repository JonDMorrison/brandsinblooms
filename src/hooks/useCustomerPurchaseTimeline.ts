import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PurchaseTimelinePoint {
  date: string;
  orders: number;
  revenue: number;
}

export const useCustomerPurchaseTimeline = (
  customerId: string | undefined,
  months: number = 12
) => {
  return useQuery({
    queryKey: ['customer-purchase-timeline', customerId, months],
    queryFn: async (): Promise<PurchaseTimelinePoint[]> => {
      if (!customerId) return [];

      const { data, error } = await supabase
        .rpc('get_customer_purchase_timeline', {
          p_customer_id: customerId,
          p_months: months,
        });

      if (error) {
        console.error('Error fetching purchase timeline:', error);
        return [];
      }

      if (!data || !Array.isArray(data)) return [];

      return data.map((row: { period_date: string; order_count: number; total_revenue: number }) => ({
        date: new Date(row.period_date).toLocaleDateString('en-US', { month: 'short' }),
        orders: row.order_count || 0,
        revenue: Number(row.total_revenue) || 0,
      }));
    },
    enabled: !!customerId,
  });
};
