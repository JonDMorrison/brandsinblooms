import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useCustomerEngagementDecay = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ['customer-engagement-decay', customerId],
    queryFn: async (): Promise<number[]> => {
      if (!customerId) return [];

      const { data, error } = await supabase
        .rpc('get_customer_engagement_decay', {
          p_customer_id: customerId,
        });

      if (error) {
        console.error('Error fetching engagement decay:', error);
        return [];
      }

      if (!data || !Array.isArray(data)) return [];

      // Sort by week number and return the percentages
      return data
        .sort((a: { week_number: number }, b: { week_number: number }) => a.week_number - b.week_number)
        .map((row: { engagement_percentage: number }) => Number(row.engagement_percentage) || 0);
    },
    enabled: !!customerId,
  });
};
