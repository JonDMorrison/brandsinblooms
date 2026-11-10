import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerAutomationRun {
  id: string;
  automation_id: string;
  status: string;
  current_step_index: number;
  total_steps: number;
  started_at: string;
  next_step_scheduled_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  automation: {
    name: string;
    trigger_type: string;
  } | null;
}

export const useCustomerAutomationRuns = (
  customerId: string | undefined,
  limit = 8,
) =>
  useQuery({
    queryKey: ["customer-automation-runs", customerId, limit],
    queryFn: async () => {
      if (!customerId) return [];

      const { data, error } = await supabase
        .from("automation_runs")
        .select(
          "id, automation_id, status, current_step_index, total_steps, started_at, next_step_scheduled_at, completed_at, error_message, automation:crm_automations(name, trigger_type)",
        )
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Error fetching customer automation runs:", error);
        throw error;
      }

      return (data ?? []) as unknown as CustomerAutomationRun[];
    },
    enabled: !!customerId,
  });
