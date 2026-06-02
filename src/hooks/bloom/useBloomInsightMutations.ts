import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { bloomSupabase, type BloomProactiveInsight } from "@/hooks/bloom/types";
import { bloomInsightNotificationsQueryKey } from "@/hooks/bloom/useBloomInsightNotifications";
import { bloomInsightsQueryKey } from "@/hooks/bloom/useBloomInsights";

interface DismissInsightMutationContext {
  previousInsights: BloomProactiveInsight[] | undefined;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function useBloomInsightMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;
  const userId = user?.id ?? null;
  const insightsQueryKey = bloomInsightsQueryKey(tenantId, userId);
  const notificationsQueryKey = bloomInsightNotificationsQueryKey(tenantId);

  const dismissInsightMutation = useMutation({
    mutationFn: async (insightId: string) => {
      if (!tenantId || !userId) {
        throw new Error(
          "Sign in and select an organization to dismiss Bloom insights.",
        );
      }

      const { data: currentInsight, error: selectError } = await bloomSupabase
        .from("bloom_proactive_insights")
        .select("id, dismissed_by")
        .eq("id", insightId)
        .eq("tenant_id", tenantId)
        .single();

      if (selectError) {
        throw selectError;
      }

      const nextDismissedBy = Array.from(
        new Set([...(currentInsight.dismissed_by ?? []), userId]),
      );

      const { error } = await bloomSupabase
        .from("bloom_proactive_insights")
        .update({ dismissed_by: nextDismissedBy })
        .eq("id", insightId)
        .eq("tenant_id", tenantId);

      if (error) {
        throw error;
      }

      return insightId;
    },
    onMutate: async (insightId): Promise<DismissInsightMutationContext> => {
      await queryClient.cancelQueries({ queryKey: insightsQueryKey });
      await queryClient.cancelQueries({ queryKey: notificationsQueryKey });
      const previousInsights =
        queryClient.getQueryData<BloomProactiveInsight[]>(insightsQueryKey);

      queryClient.setQueryData<BloomProactiveInsight[]>(
        insightsQueryKey,
        (current) =>
          current?.filter((insight) => insight.id !== insightId) ?? [],
      );

      return { previousInsights };
    },
    onError: (error, _insightId, context) => {
      queryClient.setQueryData(insightsQueryKey, context?.previousInsights);
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
      toast.error("Failed to dismiss Bloom insight", {
        description: toErrorMessage(error),
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: insightsQueryKey });
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
  });

  const dismissInsight = useCallback(
    (insightId: string) => dismissInsightMutation.mutateAsync(insightId),
    [dismissInsightMutation],
  );

  return {
    dismissInsight,
    isDismissingInsight: dismissInsightMutation.isPending,
  };
}
