import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ChannelTrendPoint {
  month: string;
  preferredChannel: 'email' | 'sms';
}

export const useCustomerChannelTrend = (
  customerId: string | undefined,
  months: number = 6
) => {
  return useQuery({
    queryKey: ['customer-channel-trend', customerId, months],
    queryFn: async (): Promise<ChannelTrendPoint[]> => {
      if (!customerId) return [];

      const { data, error } = await supabase
        .rpc('get_customer_channel_trend', {
          p_customer_id: customerId,
          p_months: months,
        });

      if (error) {
        console.error('Error fetching channel trend:', error);
        return [];
      }

      if (!data || !Array.isArray(data)) return [];

      return data.map((row: { month_label: string; preferred_channel: string }) => ({
        month: row.month_label || '',
        preferredChannel: (row.preferred_channel === 'sms' ? 'sms' : 'email') as 'email' | 'sms',
      }));
    },
    enabled: !!customerId,
  });
};
