import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HeatmapDataPoint {
  day: string;
  hour: number;
  value: number;
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const useCustomerActivityHeatmap = (
  customerId: string | undefined,
  channel: 'email' | 'sms' = 'email'
) => {
  return useQuery({
    queryKey: ['customer-activity-heatmap', customerId, channel],
    queryFn: async (): Promise<HeatmapDataPoint[]> => {
      if (!customerId) return [];

      const { data, error } = await supabase
        .rpc('get_customer_activity_heatmap', {
          p_customer_id: customerId,
          p_channel: channel,
        });

      if (error) {
        console.error('Error fetching activity heatmap:', error);
        return [];
      }

      if (!data || !Array.isArray(data)) return [];

      return data.map((row: { day_of_week: number; hour_of_day: number; event_count: number }) => ({
        day: dayNames[row.day_of_week] || 'Mon',
        hour: row.hour_of_day || 0,
        value: row.event_count || 0,
      }));
    },
    enabled: !!customerId,
  });
};
