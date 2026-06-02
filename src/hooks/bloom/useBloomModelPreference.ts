import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import type { Json } from "@/integrations/supabase/types";
import {
  bloomSupabase,
  isBloomMissingRelationError,
  isBloomModelPreference,
  type BloomModelPreference,
} from "@/hooks/bloom/types";

const DEFAULT_MODEL_PREFERENCE: BloomModelPreference = "auto";

const bloomModelPreferenceQueryKey = (
  tenantId: string | null,
  userId: string | null,
) => ["bloom-model-preference", tenantId, userId] as const;

function isJsonObject(value: Json | null | undefined): value is {
  [key: string]: Json;
} {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readModelPreference(value: Json | null | undefined) {
  if (!isJsonObject(value)) {
    return DEFAULT_MODEL_PREFERENCE;
  }

  return isBloomModelPreference(value.default_model)
    ? value.default_model
    : DEFAULT_MODEL_PREFERENCE;
}

function mergeDefaultModelPreference(
  preferences: Json | null | undefined,
  modelPreference: BloomModelPreference,
): Json {
  const current = isJsonObject(preferences) ? preferences : {};
  return { ...current, default_model: modelPreference };
}

export function useBloomModelPreference() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;
  const userId = user?.id ?? null;
  const queryKey = bloomModelPreferenceQueryKey(tenantId, userId);

  const preferenceQuery = useQuery({
    queryKey,
    enabled: Boolean(tenantId && userId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!tenantId || !userId) {
        return DEFAULT_MODEL_PREFERENCE;
      }

      const { data, error } = await bloomSupabase
        .from("bloom_user_profiles")
        .select("preferences")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        if (isBloomMissingRelationError(error)) {
          return DEFAULT_MODEL_PREFERENCE;
        }

        throw error;
      }

      return readModelPreference(data?.preferences);
    },
  });

  const preferenceMutation = useMutation({
    mutationFn: async (modelPreference: BloomModelPreference) => {
      if (!tenantId || !userId) {
        throw new Error(
          "Sign in and select an organization to update Bloom preferences.",
        );
      }

      const { data, error } = await bloomSupabase
        .from("bloom_user_profiles")
        .select("preferences")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const preferences = mergeDefaultModelPreference(
        data?.preferences,
        modelPreference,
      );
      const { error: upsertError } = await bloomSupabase
        .from("bloom_user_profiles")
        .upsert(
          {
            tenant_id: tenantId,
            user_id: userId,
            preferences,
          },
          { onConflict: "tenant_id,user_id" },
        );

      if (upsertError) {
        throw upsertError;
      }
    },
    onMutate: async (modelPreference) => {
      await queryClient.cancelQueries({ queryKey });
      const previousPreference =
        queryClient.getQueryData<BloomModelPreference>(queryKey);
      queryClient.setQueryData(queryKey, modelPreference);

      return { previousPreference };
    },
    onError: (error, _modelPreference, context) => {
      queryClient.setQueryData(
        queryKey,
        context?.previousPreference ?? DEFAULT_MODEL_PREFERENCE,
      );
      console.error("Failed to save Bloom model preference", error);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const setModelPreference = useCallback(
    (modelPreference: BloomModelPreference) => {
      preferenceMutation.mutate(modelPreference);
    },
    [preferenceMutation],
  );

  return {
    modelPreference: preferenceQuery.data ?? DEFAULT_MODEL_PREFERENCE,
    modelPreferenceLoading: preferenceQuery.isLoading,
    setModelPreference,
  };
}
