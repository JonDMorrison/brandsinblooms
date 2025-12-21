import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EngagementTimelinePoint {
  date: string;
  engagement: number;
  emailEvents: number;
  smsEvents: number;
}

export const useCustomerEngagementTimeline = (
  customerId: string | undefined,
  months: number = 6
) => {
  return useQuery({
    queryKey: ['customer-engagement-timeline', customerId, months],
    queryFn: async (): Promise<EngagementTimelinePoint[]> => {
      if (!customerId) return [];

      const { data, error } = await supabase
        .rpc('get_customer_engagement_timeline', {
          p_customer_id: customerId,
          p_months: months,
        });

      if (error) {
        console.error('Error fetching engagement timeline:', error);
        return [];
      }

      if (!data || !Array.isArray(data)) return [];

      return data.map((row: { period_date: string; email_events: number; sms_events: number; engagement_score: number }) => ({
        date: new Date(row.period_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        engagement: Number(row.engagement_score) || 0,
        emailEvents: row.email_events || 0,
        smsEvents: row.sms_events || 0,
      }));
    },
    enabled: !!customerId,
  });
};
