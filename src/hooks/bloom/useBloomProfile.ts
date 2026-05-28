import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import {
  bloomSupabase,
  isBloomMissingRelationError,
  toBloomUserProfile,
  type BloomUserProfile,
} from "@/hooks/bloom/types";
import { bloomProfileQueryKey } from "@/hooks/bloom/useBloomProfileMutations";

const BLOOM_PROFILE_STALE_TIME_MS = 300_000;
const BLOOM_PROFILE_COLUMNS =
  "id, tenant_id, user_id, interaction_count, onboarding_stage, seen_tips, workspace_memory, preferences, created_at, updated_at";

export function useBloomProfile() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const userId = user?.id ?? null;
  const tenantId = tenant?.id ?? null;

  return useQuery({
    queryKey: bloomProfileQueryKey(tenantId, userId),
    enabled: Boolean(userId && tenantId),
    retry: 1,
    staleTime: BLOOM_PROFILE_STALE_TIME_MS,
    queryFn: async (): Promise<BloomUserProfile | null> => {
      if (!userId || !tenantId) {
        return null;
      }

      const { data, error } = await bloomSupabase
        .from("bloom_user_profiles")
        .select(BLOOM_PROFILE_COLUMNS)
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        if (isBloomMissingRelationError(error)) {
          return null;
        }

        throw error;
      }

      return data ? toBloomUserProfile(data) : null;
    },
  });
}
