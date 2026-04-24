import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  type CustomerDashboardSeriesResult,
  type CustomerDashboardTimeRange,
  getDashboardRangeMonths,
  getDashboardRangeStartDate,
  isOnOrAfterRangeStart,
} from "@/hooks/customerDashboardQueryTypes";

export interface PurchaseTimelinePoint {
  date: string;
  orders: number;
  revenue: number;
}

export const useCustomerPurchaseTimeline = (
  customerId: string | undefined,
  timeRange: CustomerDashboardTimeRange = "all",
) => {
  return useQuery({
    queryKey: ["customer-purchase-timeline", customerId, timeRange],
    queryFn: async (): Promise<
      CustomerDashboardSeriesResult<PurchaseTimelinePoint>
    > => {
      if (!customerId) {
        return { data: [], error: null };
      }

      const startDate = getDashboardRangeStartDate(timeRange);
      const months = getDashboardRangeMonths(timeRange, 12);

      const { data, error } = await supabase.rpc(
        "get_customer_purchase_timeline",
        {
          p_customer_id: customerId,
          p_months: months,
        },
      );

      if (error) {
        console.error("Error fetching purchase timeline:", error);
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
            order_count: number;
            total_revenue: number;
          }) => ({
            date: new Date(row.period_date).toLocaleDateString("en-US", {
              month: "short",
              day: timeRange === "all" ? undefined : "numeric",
            }),
            orders: row.order_count || 0,
            revenue: Number(row.total_revenue) || 0,
          }),
        ),
        error: null,
      };
    },
    enabled: !!customerId,
  });
};
