import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import type {
  AskBloomInsight,
  AskBloomInsightType,
  AskBloomResourceType,
} from "@/types/askBloom";

const ASK_BLOOM_INSIGHTS_STALE_TIME_MS = 5 * 60 * 1000;

interface UseAskBloomInsightsParams {
  resourceType: AskBloomResourceType | null;
  resourceId: string | null;
  enabled: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toInsightType(value: unknown): AskBloomInsightType {
  switch (readString(value)) {
    case "warning":
      return "warning";
    case "positive":
      return "positive";
    case "action":
      return "action";
    case "info":
    default:
      return "info";
  }
}

function normalizeInsights(value: unknown): AskBloomInsight[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item, index): AskBloomInsight | null => {
      const title = readString(item.title);
      const body = readString(item.body);
      if (!title || !body) {
        return null;
      }

      return {
        id: readString(item.id) ?? `ask-bloom-insight-${index}`,
        type: toInsightType(item.type),
        title,
        body,
        suggestedPrompt: readString(item.suggestedPrompt ?? item.suggested_prompt),
      };
    })
    .filter((item): item is AskBloomInsight => item !== null);
}

export function useAskBloomInsights({
  resourceType,
  resourceId,
  enabled,
}: UseAskBloomInsightsParams) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;

  const query = useQuery({
    queryKey: ["ask-bloom-insights", resourceType, resourceId],
    enabled: Boolean(enabled && tenantId && resourceType && resourceId),
    staleTime: ASK_BLOOM_INSIGHTS_STALE_TIME_MS,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<AskBloomInsight[]> => {
      if (!tenantId || !resourceType || !resourceId) {
        return [];
      }

      const { data, error } = await supabase.rpc("get_resource_insights", {
        p_tenant_id: tenantId,
        p_resource_type: resourceType,
        p_resource_id: resourceId,
      });

      if (error) {
        throw error;
      }

      return normalizeInsights(data);
    },
  });

  return {
    insights: query.data ?? [],
    isLoading: query.isLoading,
  };
}
