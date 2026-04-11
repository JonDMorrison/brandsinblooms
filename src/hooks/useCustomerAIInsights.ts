import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

export interface AIAction {
  title: string;
  description: string;
  confidence: number;
  actionType: "sms" | "email" | "schedule" | "monitor" | "suppress";
  priority: "high" | "medium" | "low";
}

export interface AIInsightsData {
  keyInsight: string;
  patterns: string[];
  actions: AIAction[];
  hasSufficientData: boolean;
  generatedAt: string;
  expiresAt: string;
  cached: boolean;
  modelUsed: string;
}

interface UseCustomerAIInsightsOptions {
  enabled?: boolean;
}

export const useCustomerAIInsights = (
  customerId: string | undefined,
  options: UseCustomerAIInsightsOptions = {},
) => {
  const { enabled = true } = options;
  const queryClient = useQueryClient();
  const [isRegenerating, setIsRegenerating] = useState(false);

  const query = useQuery({
    queryKey: ["customer-ai-insights", customerId],
    queryFn: async (): Promise<AIInsightsData | null> => {
      if (!customerId) return null;
      const { data, error } = await supabase.functions.invoke(
        "generate-customer-insights",
        {
          body: { customer_id: customerId, force_regenerate: false },
        },
      );

      if (error) {
        console.error("Error fetching AI insights:", error);
        throw error;
      }

      if (data?.error) {
        console.error("AI insights error:", data.error);
        throw new Error(data.error);
      }
      return data as AIInsightsData;
    },
    enabled: !!customerId && enabled,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - don't refetch if data is less than 24h old
    gcTime: 25 * 60 * 60 * 1000, // Keep in cache for 25 hours
    refetchOnMount: false, // Don't refetch every time component mounts
    refetchOnWindowFocus: false, // Don't refetch on tab focus
    retry: 1, // Only retry once on failure
  });

  const regenerate = async (): Promise<void> => {
    if (!customerId) return;

    setIsRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-customer-insights",
        {
          body: { customer_id: customerId, force_regenerate: true },
        },
      );

      if (error) {
        console.error("Error regenerating AI insights:", error);
        throw error;
      }

      if (data?.error) {
        console.error("AI regeneration error:", data.error);
        throw new Error(data.error);
      }

      // Update the cache with the new data
      queryClient.setQueryData(["customer-ai-insights", customerId], data);
    } finally {
      setIsRegenerating(false);
    }
  };

  return {
    insights: query.data ?? null,
    isLoading: query.isLoading,
    isRegenerating,
    error: query.error,
    regenerate,
    lastGeneratedAt: query.data?.generatedAt
      ? new Date(query.data.generatedAt)
      : null,
    hasSufficientData: query.data?.hasSufficientData ?? true,
  };
};
