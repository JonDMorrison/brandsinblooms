import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  type CustomerDashboardSeriesResult,
  type CustomerDashboardTimeRange,
  getDashboardRangeMonths,
} from "@/hooks/customerDashboardQueryTypes";

export interface ChannelTrendPoint {
  month: string;
  preferredChannel: "email" | "sms";
}

export const useCustomerChannelTrend = (
  customerId: string | undefined,
  timeRange: CustomerDashboardTimeRange = "90d",
) => {
  return useQuery({
    queryKey: ["customer-channel-trend", customerId, timeRange],
    queryFn: async (): Promise<
      CustomerDashboardSeriesResult<ChannelTrendPoint>
    > => {
      if (!customerId) {
        return { data: [], error: null };
      }

      const months = getDashboardRangeMonths(timeRange, 6);

      const { data, error } = await supabase.rpc("get_customer_channel_trend", {
        p_customer_id: customerId,
        p_months: months,
      });

      if (error) {
        console.error("Error fetching channel trend:", error);
        return { data: [], error: error.message };
      }

      if (!data || !Array.isArray(data)) {
        return { data: [], error: null };
      }

      return {
        data: data.map(
          (row: { month_label: string; preferred_channel: string }) => ({
            month: row.month_label || "",
            preferredChannel: (row.preferred_channel === "sms"
              ? "sms"
              : "email") as "email" | "sms",
          }),
        ),
        error: null,
      };
    },
    enabled: !!customerId,
  });
};
