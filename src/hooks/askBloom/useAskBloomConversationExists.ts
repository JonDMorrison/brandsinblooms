import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import type { AskBloomResourceType } from "@/types/askBloom";

const toUniqueSortedIds = (resourceIds: string[]) =>
  Array.from(
    new Set(
      resourceIds
        .map((resourceId) => resourceId.trim())
        .filter((resourceId) => resourceId.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));

export function useAskBloomConversationExists(
  resourceType: AskBloomResourceType,
  resourceIds: string[],
) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;
  const normalizedResourceIds = toUniqueSortedIds(resourceIds);

  return useQuery({
    queryKey: [
      "ask-bloom-conversations-exist",
      resourceType,
      ...normalizedResourceIds,
    ],
    enabled: Boolean(tenantId && normalizedResourceIds.length > 0),
    staleTime: 30_000,
    queryFn: async () => {
      if (!tenantId || normalizedResourceIds.length === 0) {
        return {} as Record<string, boolean>;
      }

      const { data, error } = await supabase
        .from("bloom_conversations")
        .select("resource_id")
        .eq("tenant_id", tenantId)
        .eq("session_type", "resource_focused")
        .eq("resource_type", resourceType)
        .in("resource_id", normalizedResourceIds);

      if (error) {
        throw error;
      }

      const existingIds = new Set(
        (data ?? [])
          .map((row) => row.resource_id)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      );

      return normalizedResourceIds.reduce<Record<string, boolean>>((result, resourceId) => {
        result[resourceId] = existingIds.has(resourceId);
        return result;
      }, {});
    },
  });
}
