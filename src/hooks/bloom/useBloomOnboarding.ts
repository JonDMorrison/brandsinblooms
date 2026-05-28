import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { bloomSupabase, type BloomOnboardingTipId } from "@/hooks/bloom/types";
import { useBloomProfile } from "@/hooks/bloom/useBloomProfile";
import { useBloomProfileMutations } from "@/hooks/bloom/useBloomProfileMutations";
import { useTenant } from "@/hooks/useTenant";

const stageOneTipThreshold = 3;
const mutationExecutionFilter = [
  "tool_name.like.create_%",
  "tool_name.like.update_%",
  "tool_name.like.delete_%",
  "tool_name.eq.clone_campaign",
  "tool_name.eq.schedule_campaign",
  "tool_name.eq.send_campaign",
  "tool_name.like.assign_%",
  "tool_name.like.bulk_tag_%",
  "tool_name.like.manage_%",
  "tool_name.like.pause_resume_%",
  "tool_name.like.toggle_%",
].join(",");

const bloomMutationExecutionQueryKey = (
  tenantId: string | null,
  userId: string | null,
) => ["bloom-onboarding", "mutation-execution", tenantId, userId] as const;

export function useBloomOnboarding() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const profileQuery = useBloomProfile();
  const { markTipSeen: persistTipSeen } = useBloomProfileMutations();
  const tenantId = tenant?.id ?? null;
  const userId = user?.id ?? null;
  const stage = profileQuery.data?.onboardingStage ?? 0;
  const interactionCount = profileQuery.data?.interactionCount ?? 0;
  const seenTips = profileQuery.data?.seenTips ?? [];

  const mutationExecutionQuery = useQuery({
    queryKey: bloomMutationExecutionQueryKey(tenantId, userId),
    enabled: Boolean(tenantId && userId && stage === 1),
    staleTime: 30_000,
    queryFn: async () => {
      if (!tenantId || !userId) {
        return false;
      }

      const { count, error } = await bloomSupabase
        .from("bloom_tool_executions")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .or(mutationExecutionFilter);

      if (error) {
        throw error;
      }

      return (count ?? 0) > 0;
    },
  });

  const pendingTip = React.useMemo<BloomOnboardingTipId | null>(() => {
    const seenTipSet = new Set(seenTips);

    if (stage === 0) {
      return interactionCount >= stageOneTipThreshold &&
        !seenTipSet.has("slash_commands")
        ? "slash_commands"
        : null;
    }

    if (stage === 1) {
      return mutationExecutionQuery.data && !seenTipSet.has("task_plans")
        ? "task_plans"
        : null;
    }

    if (stage === 2) {
      return !seenTipSet.has("reasoning_mode") ? "reasoning_mode" : null;
    }

    if (stage >= 3) {
      return !seenTipSet.has("cmd_k_shortcut") ? "cmd_k_shortcut" : null;
    }

    return null;
  }, [interactionCount, mutationExecutionQuery.data, seenTips, stage]);

  const markTipSeen = React.useCallback(
    (tipId: BloomOnboardingTipId) => {
      void persistTipSeen(tipId).catch(() => undefined);
    },
    [persistTipSeen],
  );

  return {
    stage,
    interactionCount,
    pendingTip,
    markTipSeen,
  };
}
