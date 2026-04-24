import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CustomerDashboardSeriesResult } from "@/hooks/customerDashboardQueryTypes";

export const useCustomerEngagementDecay = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ["customer-engagement-decay", customerId],
    queryFn: async (): Promise<CustomerDashboardSeriesResult<number>> => {
      if (!customerId) {
        return { data: [], error: null };
      }

      const { data, error } = await supabase.rpc(
        "get_customer_engagement_decay",
        {
          p_customer_id: customerId,
        },
      );

      if (error) {
        console.error("Error fetching engagement decay:", error);
        return { data: [], error: error.message };
      }

      if (!data || !Array.isArray(data)) {
        return { data: [], error: null };
      }

      // Sort by week number and return the percentages
      return {
        data: data
          .sort(
            (a: { week_number: number }, b: { week_number: number }) =>
              a.week_number - b.week_number,
          )
          .map(
            (row: { engagement_percentage: number }) =>
              Number(row.engagement_percentage) || 0,
          ),
        error: null,
      };
    },
    enabled: !!customerId,
  });
};
