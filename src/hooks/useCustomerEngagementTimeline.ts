import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  type CustomerDashboardSeriesResult,
  type CustomerDashboardTimeRange,
  getDashboardRangeMonths,
  getDashboardRangeStartDate,
  isOnOrAfterRangeStart,
} from "@/hooks/customerDashboardQueryTypes";

export interface EngagementTimelinePoint {
  date: string;
  engagement: number;
  emailEvents: number;
  smsEvents: number;
}

export const useCustomerEngagementTimeline = (
  customerId: string | undefined,
  timeRange: CustomerDashboardTimeRange = "90d",
) => {
  return useQuery({
    queryKey: ["customer-engagement-timeline", customerId, timeRange],
    queryFn: async (): Promise<
      CustomerDashboardSeriesResult<EngagementTimelinePoint>
    > => {
      if (!customerId) {
        return { data: [], error: null };
      }

      const startDate = getDashboardRangeStartDate(timeRange);
      const months = getDashboardRangeMonths(timeRange, 6);

      const { data, error } = await supabase.rpc(
        "get_customer_engagement_timeline",
        {
          p_customer_id: customerId,
          p_months: months,
        },
      );

      if (error) {
        console.error("Error fetching engagement timeline:", error);
        return { data: [], error: error.message };
      }

      if (!data || !Array.isArray(data)) {
        return { data: [], error: null };
      }

      const filtered = data.filter((row: { period_date: string }) =>
        isOnOrAfterRangeStart(row.period_date, startDate),
      );

      return {
        data: filtered.map(
          (row: {
            period_date: string;
            email_events: number;
            sms_events: number;
            engagement_score: number;
          }) => ({
            date: new Date(row.period_date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            engagement: Number(row.engagement_score) || 0,
            emailEvents: row.email_events || 0,
            smsEvents: row.sms_events || 0,
          }),
        ),
        error: null,
      };
    },
    enabled: !!customerId,
  });
};
