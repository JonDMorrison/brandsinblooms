import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import type { Json } from "@/integrations/supabase/types";
import {
  bloomSupabase,
  DEFAULT_BLOOM_PREFERENCES,
  isBloomDefaultModePreference,
  type BloomOnboardingTipId,
  type BloomPageEntityType,
  isBloomModelPreference,
  isBloomResponseDensityPreference,
  toBloomPreferences,
  toBloomUserProfile,
  type BloomPreferences,
  type BloomUserProfile,
} from "@/hooks/bloom/types";
import {
  bloomConversationsCountQueryBaseKey,
  bloomConversationsQueryBaseKey,
} from "@/hooks/bloom/useBloomConversations";

const BLOOM_PROFILE_COLUMNS =
  "id, tenant_id, user_id, interaction_count, onboarding_stage, seen_tips, workspace_memory, preferences, created_at, updated_at";
const MAX_BLOOM_PREFERENCE_TEXT_LENGTH = 500;

type PreferenceJsonRecord = Record<string, Json>;

type WorkspaceMemoryJsonRecord = Record<string, Json>;

type PinnedContextEntry = {
  entityType: BloomPageEntityType;
  entityId: string;
  displayName: string;
  pinnedAt: string;
};

interface PreferencesMutationContext {
  previousProfile: BloomUserProfile | undefined;
  previousModelPreference: unknown;
}

interface WorkspaceMemoryMutationContext {
  previousProfile: BloomUserProfile | null | undefined;
}

const MAX_PINNED_CONTEXT = 3;
const MAX_ENTITY_FIELD_LENGTH = 256;
const MAX_ENTITY_NAME_LENGTH = 160;
const MAX_PINNED_CONTEXT_ERROR = "Maximum 3 pins reached. Unpin an item first.";
const ONBOARDING_TIP_IDS = new Set<BloomOnboardingTipId>([
  "slash_commands",
  "task_plans",
  "reasoning_mode",
  "cmd_k_shortcut",
]);

export const bloomProfileQueryBaseKey = (tenantId: string | null) =>
  ["bloom-profile", tenantId] as const;

export const bloomProfileQueryKey = (
  tenantId: string | null,
  userId: string | null,
) => [...bloomProfileQueryBaseKey(tenantId), userId] as const;

const bloomModelPreferenceQueryKey = (
  tenantId: string | null,
  userId: string | null,
) => ["bloom-model-preference", tenantId, userId] as const;

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function readPreferenceRecord(value: Json | null | undefined) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {} satisfies PreferenceJsonRecord;
  }

  return Object.entries(value).reduce<PreferenceJsonRecord>(
    (record, [key, item]) => {
      if (item !== undefined) {
        record[key] = item;
      }
      return record;
    },
    {},
  );
}

function normalizePreferenceText(value: unknown, fieldLabel: string) {
  if (typeof value !== "string") {
    throw new Error(`${fieldLabel} must be text.`);
  }

  return value.trim().slice(0, MAX_BLOOM_PREFERENCE_TEXT_LENGTH);
}

function normalizePreferencesPatch(
  partial: Partial<BloomPreferences>,
): PreferenceJsonRecord {
  const patch: PreferenceJsonRecord = {};

  if (partial.density !== undefined) {
    if (!isBloomResponseDensityPreference(partial.density)) {
      throw new Error("Choose a valid response density.");
    }
    patch.density = partial.density;
  }

  if (partial.default_mode !== undefined) {
    if (!isBloomDefaultModePreference(partial.default_mode)) {
      throw new Error("Choose a valid default Bloom mode.");
    }
    patch.default_mode = partial.default_mode;
  }

  if (partial.default_model !== undefined) {
    if (!isBloomModelPreference(partial.default_model)) {
      throw new Error("Choose a valid model preference.");
    }
    patch.default_model = partial.default_model;
  }

  if (partial.about_me !== undefined) {
    patch.about_me = normalizePreferenceText(partial.about_me, "About me");
  }

  if (partial.response_style !== undefined) {
    patch.response_style = normalizePreferenceText(
      partial.response_style,
      "Response style",
    );
  }

  if (partial.response_density !== undefined) {
    if (!isBloomResponseDensityPreference(partial.response_density)) {
      throw new Error("Choose a valid detected response density.");
    }
    patch.response_density = partial.response_density;
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("No preference changes were provided.");
  }

  return patch;
}

function mergePreferences(
  currentPreferences: Json | null | undefined,
  patch: PreferenceJsonRecord,
) {
  return {
    ...readPreferenceRecord(currentPreferences),
    ...patch,
  } satisfies PreferenceJsonRecord;
}

function readWorkspaceMemoryRecord(value: Json | null | undefined) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {} satisfies WorkspaceMemoryJsonRecord;
  }

  return Object.entries(value).reduce<WorkspaceMemoryJsonRecord>(
    (record, [key, item]) => {
      if (item !== undefined) {
        record[key] = item;
      }
      return record;
    },
    {},
  );
}

function readNonEmptyTrimmedString(
  value: unknown,
  fieldLabel: string,
  maxLength: number,
) {
  if (typeof value !== "string") {
    throw new Error(`${fieldLabel} must be text.`);
  }

  const trimmed = value.trim().slice(0, maxLength);
  if (!trimmed) {
    throw new Error(`${fieldLabel} is required.`);
  }

  return trimmed;
}

function normalizeOnboardingTipId(value: unknown): BloomOnboardingTipId {
  if (typeof value !== "string") {
    throw new Error("Tip ID must be text.");
  }

  const trimmed = value.trim();
  if (!ONBOARDING_TIP_IDS.has(trimmed as BloomOnboardingTipId)) {
    throw new Error("Choose a valid Bloom tip.");
  }

  return trimmed as BloomOnboardingTipId;
}

function isPinnedContextEntry(value: unknown): value is PinnedContextEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.entityType === "string" &&
    typeof record.entityId === "string" &&
    typeof record.displayName === "string" &&
    typeof record.pinnedAt === "string"
  );
}

function isBloomPageEntityType(value: unknown): value is BloomPageEntityType {
  return (
    value === "customer" ||
    value === "product" ||
    value === "campaign" ||
    value === "segment"
  );
}

function parsePinnedContextEntry(value: unknown): PinnedContextEntry | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const entityType = record.entity_type;
  const entityId = record.entity_id;
  const displayName = record.display_name;
  const pinnedAt = record.pinned_at;

  return isBloomPageEntityType(entityType) &&
    typeof entityId === "string" &&
    entityId.trim() &&
    typeof displayName === "string" &&
    displayName.trim() &&
    typeof pinnedAt === "string" &&
    pinnedAt.trim()
    ? {
        entityType,
        entityId: entityId.trim(),
        displayName: displayName.trim(),
        pinnedAt: pinnedAt.trim(),
      }
    : null;
}

function readPinnedContextEntries(
  workspaceMemory: Json | null | undefined,
): PinnedContextEntry[] {
  const record = readWorkspaceMemoryRecord(workspaceMemory);
  const source = record.pinned_context;
  if (!Array.isArray(source)) {
    return [];
  }

  return source.map(parsePinnedContextEntry).filter(Boolean);
}

function pinnedContextEntryToJson(entry: PinnedContextEntry): Json {
  return {
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    display_name: entry.displayName,
    pinned_at: entry.pinnedAt,
  } satisfies WorkspaceMemoryJsonRecord;
}

function buildOptimisticProfile(args: {
  currentProfile: BloomUserProfile | null | undefined;
  tenantId: string;
  userId: string;
  patch?: Partial<
    Pick<
      BloomUserProfile,
      | "interactionCount"
      | "onboardingStage"
      | "seenTips"
      | "workspaceMemory"
      | "preferences"
    >
  >;
}) {
  const { currentProfile, patch, tenantId, userId } = args;
  const timestamp = new Date().toISOString();

  if (currentProfile) {
    return {
      ...currentProfile,
      ...patch,
      updatedAt: timestamp,
    } satisfies BloomUserProfile;
  }

  return {
    id: `optimistic-${tenantId}-${userId}`,
    tenantId,
    userId,
    interactionCount: 0,
    onboardingStage: 0,
    seenTips: [],
    workspaceMemory: {},
    preferences: DEFAULT_BLOOM_PREFERENCES,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...patch,
  } satisfies BloomUserProfile;
}

function appendSeenTip(
  seenTips: readonly string[],
  tipId: BloomOnboardingTipId,
) {
  const validSeenTips = seenTips.filter(
    (entry): entry is BloomOnboardingTipId =>
      ONBOARDING_TIP_IDS.has(entry as BloomOnboardingTipId),
  );

  return validSeenTips.includes(tipId)
    ? [...validSeenTips]
    : [...validSeenTips, tipId];
}

function buildPinnedContextKey(entry: {
  entityType: BloomPageEntityType;
  entityId: string;
}) {
  return `${entry.entityType}:${entry.entityId}`;
}

function pinPinnedContextEntry(args: {
  currentEntries: PinnedContextEntry[];
  entityType: BloomPageEntityType;
  entityId: string;
  displayName: string;
}): PinnedContextEntry[] {
  const { currentEntries, entityType, entityId, displayName } = args;
  const entryKey = buildPinnedContextKey({ entityType, entityId });
  const existingIndex = currentEntries.findIndex(
    (entry) => buildPinnedContextKey(entry) === entryKey,
  );

  if (existingIndex >= 0) {
    return currentEntries.map((entry, index) =>
      index === existingIndex ? { ...entry, displayName } : entry,
    );
  }

  if (currentEntries.length >= MAX_PINNED_CONTEXT) {
    throw new Error(MAX_PINNED_CONTEXT_ERROR);
  }

  return [
    ...currentEntries,
    {
      entityType,
      entityId,
      displayName,
      pinnedAt: new Date().toISOString(),
    },
  ];
}

function unpinPinnedContextEntry(args: {
  currentEntries: PinnedContextEntry[];
  entityType: BloomPageEntityType;
  entityId: string;
}): PinnedContextEntry[] {
  const entryKey = buildPinnedContextKey(args);
  return args.currentEntries.filter(
    (entry) => buildPinnedContextKey(entry) !== entryKey,
  );
}

function mergeWorkspaceMemory(
  currentWorkspaceMemory: Json | null | undefined,
  pinnedContext: PinnedContextEntry[],
) {
  return {
    ...readWorkspaceMemoryRecord(currentWorkspaceMemory),
    pinned_context: pinnedContext.map(pinnedContextEntryToJson),
  } satisfies WorkspaceMemoryJsonRecord;
}

async function clearAllConversationsForScope({
  tenantId,
  userId,
}: {
  tenantId: string;
  userId: string;
}) {
  const { count, error: countError } = await bloomSupabase
    .from("bloom_conversations")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .neq("status", "deleted");

  if (countError) {
    throw countError;
  }

  const clearedCount = count ?? 0;

  if (clearedCount > 0) {
    const { error: clearError } = await bloomSupabase
      .from("bloom_conversations")
      .update({ status: "deleted" })
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .neq("status", "deleted");

    if (clearError) {
      throw clearError;
    }
  }

  const { error: memoryError } = await bloomSupabase
    .from("bloom_user_profiles")
    .update({ workspace_memory: {} })
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);

  if (memoryError) {
    throw memoryError;
  }

  return clearedCount;
}

export function useBloomProfileMutations() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;
  const userId = user?.id ?? null;
  const profileQueryKey = bloomProfileQueryKey(tenantId, userId);
  const profileQueryBaseKey = bloomProfileQueryBaseKey(tenantId);
  const modelPreferenceQueryKey = bloomModelPreferenceQueryKey(
    tenantId,
    userId,
  );
  const conversationsQueryBaseKey = bloomConversationsQueryBaseKey(tenantId);
  const conversationsCountQueryBaseKey =
    bloomConversationsCountQueryBaseKey(tenantId);

  const invalidateBloomCaches = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: profileQueryBaseKey });
    void queryClient.invalidateQueries({ queryKey: modelPreferenceQueryKey });
    void queryClient.invalidateQueries({ queryKey: conversationsQueryBaseKey });
    void queryClient.invalidateQueries({
      queryKey: conversationsCountQueryBaseKey,
    });
    void queryClient.invalidateQueries({ queryKey: ["bloom-messages"] });
    void queryClient.invalidateQueries({
      queryKey: ["bloom-message-search", tenantId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["bloom-bookmarks", tenantId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["bloom-knowledge", tenantId],
    });
  }, [
    conversationsCountQueryBaseKey,
    conversationsQueryBaseKey,
    modelPreferenceQueryKey,
    profileQueryBaseKey,
    queryClient,
    tenantId,
  ]);

  const patchCachedProfilePreferences = useCallback(
    (patch: PreferenceJsonRecord) => {
      queryClient.setQueryData<BloomUserProfile>(
        profileQueryKey,
        (currentProfile) => {
          if (!currentProfile) {
            return currentProfile;
          }

          return {
            ...currentProfile,
            preferences: toBloomPreferences({
              ...currentProfile.preferences,
              ...patch,
            }),
            updatedAt: new Date().toISOString(),
          };
        },
      );

      if (isBloomModelPreference(patch.default_model)) {
        queryClient.setQueryData(modelPreferenceQueryKey, patch.default_model);
      }
    },
    [modelPreferenceQueryKey, profileQueryKey, queryClient],
  );

  const patchCachedProfileWorkspaceMemory = useCallback(
    (
      transform: (
        currentPinnedContext: PinnedContextEntry[],
      ) => PinnedContextEntry[],
    ) => {
      queryClient.setQueryData<BloomUserProfile | null>(
        profileQueryKey,
        (currentProfile) => {
          const nextPinnedContext = transform(
            readPinnedContextEntries(currentProfile?.workspaceMemory),
          );
          const nextWorkspaceMemory = mergeWorkspaceMemory(
            currentProfile?.workspaceMemory,
            nextPinnedContext,
          );

          return buildOptimisticProfile({
            currentProfile,
            tenantId: tenantId ?? "unknown-tenant",
            userId: userId ?? "unknown-user",
            patch: { workspaceMemory: nextWorkspaceMemory },
          });
        },
      );
    },
    [profileQueryKey, queryClient, tenantId, userId],
  );

  const updatePreferencesMutation = useMutation({
    mutationFn: async (partial: Partial<BloomPreferences>) => {
      if (!tenantId || !userId) {
        throw new Error(
          "Sign in and select an organization to update Bloom preferences.",
        );
      }

      const patch = normalizePreferencesPatch(partial);
      const { data: currentProfile, error: selectError } = await bloomSupabase
        .from("bloom_user_profiles")
        .select("preferences")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .maybeSingle();

      if (selectError) {
        throw selectError;
      }

      const preferences = mergePreferences(currentProfile?.preferences, patch);
      const { data, error } = await bloomSupabase
        .from("bloom_user_profiles")
        .upsert(
          {
            tenant_id: tenantId,
            user_id: userId,
            preferences,
          },
          { onConflict: "tenant_id,user_id" },
        )
        .select(BLOOM_PROFILE_COLUMNS)
        .single();

      if (error) {
        throw error;
      }

      return toBloomUserProfile(data);
    },
    onMutate: async (partial): Promise<PreferencesMutationContext> => {
      const patch = normalizePreferencesPatch(partial);
      await queryClient.cancelQueries({ queryKey: profileQueryKey });
      const previousProfile =
        queryClient.getQueryData<BloomUserProfile>(profileQueryKey);
      const previousModelPreference = queryClient.getQueryData(
        modelPreferenceQueryKey,
      );

      patchCachedProfilePreferences(patch);

      return { previousProfile, previousModelPreference };
    },
    onError: (error, _partial, context) => {
      queryClient.setQueryData(profileQueryKey, context?.previousProfile);
      queryClient.setQueryData(
        modelPreferenceQueryKey,
        context?.previousModelPreference,
      );
      toast.error("Failed to update Bloom preferences", {
        description: toErrorMessage(error),
      });
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKey, profile);
      queryClient.setQueryData(
        modelPreferenceQueryKey,
        profile.preferences.default_model,
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });

  const clearAllConversationsMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !userId) {
        throw new Error(
          "Sign in and select an organization to clear Bloom conversations.",
        );
      }

      return clearAllConversationsForScope({ tenantId, userId });
    },
    onSuccess: (clearedCount) => {
      queryClient.setQueryData<BloomUserProfile>(
        profileQueryKey,
        (currentProfile) =>
          currentProfile
            ? {
                ...currentProfile,
                workspaceMemory: {},
                updatedAt: new Date().toISOString(),
              }
            : currentProfile,
      );
      invalidateBloomCaches();
      navigate("/bloom");
      toast.success(
        `${clearedCount} ${
          clearedCount === 1 ? "conversation" : "conversations"
        } cleared`,
      );
    },
    onError: (error) => {
      toast.error("Failed to clear Bloom conversations", {
        description: toErrorMessage(error),
      });
    },
  });

  const deleteBloomProfileMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !userId) {
        throw new Error(
          "Sign in and select an organization to delete your Bloom profile.",
        );
      }

      await clearAllConversationsForScope({ tenantId, userId });

      const { error } = await bloomSupabase
        .from("bloom_user_profiles")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("user_id", userId);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: profileQueryKey });
      queryClient.removeQueries({ queryKey: modelPreferenceQueryKey });
      invalidateBloomCaches();
      navigate("/bloom");
      toast.success(
        "Bloom profile deleted. A fresh profile will be created on your next message.",
      );
    },
    onError: (error) => {
      toast.error("Failed to delete Bloom profile", {
        description: toErrorMessage(error),
      });
    },
  });

  const updatePreferences = useCallback(
    (partial: Partial<BloomPreferences>) =>
      updatePreferencesMutation.mutateAsync(partial),
    [updatePreferencesMutation],
  );

  const markTipSeenMutation = useMutation({
    mutationFn: async (tipId: BloomOnboardingTipId) => {
      if (!tenantId || !userId) {
        throw new Error(
          "Sign in and select an organization to update Bloom tips.",
        );
      }

      const normalizedTipId = normalizeOnboardingTipId(tipId);
      const { data: currentProfile, error: selectError } = await bloomSupabase
        .from("bloom_user_profiles")
        .select("seen_tips")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .maybeSingle();

      if (selectError) {
        throw selectError;
      }

      const nextSeenTips = appendSeenTip(
        (currentProfile?.seen_tips ?? []).filter(
          (entry): entry is BloomOnboardingTipId =>
            typeof entry === "string" &&
            ONBOARDING_TIP_IDS.has(entry as BloomOnboardingTipId),
        ),
        normalizedTipId,
      );

      const { data, error } = await bloomSupabase
        .from("bloom_user_profiles")
        .upsert(
          {
            tenant_id: tenantId,
            user_id: userId,
            seen_tips: nextSeenTips,
          },
          { onConflict: "tenant_id,user_id" },
        )
        .select(BLOOM_PROFILE_COLUMNS)
        .single();

      if (error) {
        throw error;
      }

      return toBloomUserProfile(data);
    },
    onMutate: async (tipId) => {
      const normalizedTipId = normalizeOnboardingTipId(tipId);
      await queryClient.cancelQueries({ queryKey: profileQueryKey });
      const previousProfile = queryClient.getQueryData<BloomUserProfile | null>(
        profileQueryKey,
      );

      queryClient.setQueryData<BloomUserProfile | null>(
        profileQueryKey,
        (currentProfile) =>
          buildOptimisticProfile({
            currentProfile,
            tenantId: tenantId ?? "unknown-tenant",
            userId: userId ?? "unknown-user",
            patch: {
              seenTips: appendSeenTip(
                currentProfile?.seenTips ?? [],
                normalizedTipId,
              ),
            },
          }),
      );

      return { previousProfile } satisfies WorkspaceMemoryMutationContext;
    },
    onError: (error, _tipId, context) => {
      queryClient.setQueryData(profileQueryKey, context?.previousProfile);
      toast.error("Failed to update Bloom tips", {
        description: toErrorMessage(error),
      });
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKey, profile);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });

  const unlockAllFeaturesMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !userId) {
        throw new Error(
          "Sign in and select an organization to unlock Bloom features.",
        );
      }

      const { data, error } = await bloomSupabase
        .from("bloom_user_profiles")
        .upsert(
          {
            tenant_id: tenantId,
            user_id: userId,
            onboarding_stage: 3,
          },
          { onConflict: "tenant_id,user_id" },
        )
        .select(BLOOM_PROFILE_COLUMNS)
        .single();

      if (error) {
        throw error;
      }

      return toBloomUserProfile(data);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: profileQueryKey });
      const previousProfile = queryClient.getQueryData<BloomUserProfile | null>(
        profileQueryKey,
      );

      queryClient.setQueryData<BloomUserProfile | null>(
        profileQueryKey,
        (currentProfile) =>
          buildOptimisticProfile({
            currentProfile,
            tenantId: tenantId ?? "unknown-tenant",
            userId: userId ?? "unknown-user",
            patch: { onboardingStage: 3 },
          }),
      );

      return { previousProfile } satisfies WorkspaceMemoryMutationContext;
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(profileQueryKey, context?.previousProfile);
      toast.error("Failed to unlock Bloom features", {
        description: toErrorMessage(error),
      });
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKey, profile);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });

  const pinEntityMutation = useMutation({
    mutationFn: async ({
      entityType,
      entityId,
      entityName,
    }: {
      entityType: BloomPageEntityType;
      entityId: string;
      entityName: string;
    }) => {
      if (!tenantId || !userId) {
        throw new Error(
          "Sign in and select an organization to pin Bloom context.",
        );
      }

      const normalizedEntityId = readNonEmptyTrimmedString(
        entityId,
        "Entity ID",
        MAX_ENTITY_FIELD_LENGTH,
      );
      const normalizedEntityName = readNonEmptyTrimmedString(
        entityName,
        "Entity name",
        MAX_ENTITY_NAME_LENGTH,
      );
      const { data: currentProfile, error: selectError } = await bloomSupabase
        .from("bloom_user_profiles")
        .select("workspace_memory")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .maybeSingle();

      if (selectError) {
        throw selectError;
      }

      const nextWorkspaceMemory = mergeWorkspaceMemory(
        currentProfile?.workspace_memory,
        pinPinnedContextEntry({
          currentEntries: readPinnedContextEntries(
            currentProfile?.workspace_memory,
          ),
          entityType,
          entityId: normalizedEntityId,
          displayName: normalizedEntityName,
        }),
      );

      const { data, error } = await bloomSupabase
        .from("bloom_user_profiles")
        .upsert(
          {
            tenant_id: tenantId,
            user_id: userId,
            workspace_memory: nextWorkspaceMemory,
          },
          { onConflict: "tenant_id,user_id" },
        )
        .select(BLOOM_PROFILE_COLUMNS)
        .single();

      if (error) {
        throw error;
      }

      return toBloomUserProfile(data);
    },
    onMutate: async ({ entityType, entityId, entityName }) => {
      const normalizedEntityId = readNonEmptyTrimmedString(
        entityId,
        "Entity ID",
        MAX_ENTITY_FIELD_LENGTH,
      );
      const normalizedEntityName = readNonEmptyTrimmedString(
        entityName,
        "Entity name",
        MAX_ENTITY_NAME_LENGTH,
      );
      await queryClient.cancelQueries({ queryKey: profileQueryKey });
      const previousProfile = queryClient.getQueryData<BloomUserProfile | null>(
        profileQueryKey,
      );

      patchCachedProfileWorkspaceMemory((currentPinnedContext) =>
        pinPinnedContextEntry({
          currentEntries: currentPinnedContext,
          entityType,
          entityId: normalizedEntityId,
          displayName: normalizedEntityName,
        }),
      );

      return { previousProfile } satisfies WorkspaceMemoryMutationContext;
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(profileQueryKey, context?.previousProfile);
      toast.error("Failed to pin Bloom context", {
        description: toErrorMessage(error),
      });
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKey, profile);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });

  const unpinEntityMutation = useMutation({
    mutationFn: async ({
      entityType,
      entityId,
    }: {
      entityType: BloomPageEntityType;
      entityId: string;
    }) => {
      if (!tenantId || !userId) {
        throw new Error(
          "Sign in and select an organization to unpin Bloom context.",
        );
      }

      const normalizedEntityId = readNonEmptyTrimmedString(
        entityId,
        "Entity ID",
        MAX_ENTITY_FIELD_LENGTH,
      );
      const { data: currentProfile, error: selectError } = await bloomSupabase
        .from("bloom_user_profiles")
        .select("workspace_memory")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .maybeSingle();

      if (selectError) {
        throw selectError;
      }

      const nextWorkspaceMemory = mergeWorkspaceMemory(
        currentProfile?.workspace_memory,
        unpinPinnedContextEntry({
          currentEntries: readPinnedContextEntries(
            currentProfile?.workspace_memory,
          ),
          entityType,
          entityId: normalizedEntityId,
        }),
      );

      const { data, error } = await bloomSupabase
        .from("bloom_user_profiles")
        .upsert(
          {
            tenant_id: tenantId,
            user_id: userId,
            workspace_memory: nextWorkspaceMemory,
          },
          { onConflict: "tenant_id,user_id" },
        )
        .select(BLOOM_PROFILE_COLUMNS)
        .single();

      if (error) {
        throw error;
      }

      return toBloomUserProfile(data);
    },
    onMutate: async ({ entityType, entityId }) => {
      const normalizedEntityId = readNonEmptyTrimmedString(
        entityId,
        "Entity ID",
        MAX_ENTITY_FIELD_LENGTH,
      );
      await queryClient.cancelQueries({ queryKey: profileQueryKey });
      const previousProfile = queryClient.getQueryData<BloomUserProfile | null>(
        profileQueryKey,
      );

      patchCachedProfileWorkspaceMemory((currentPinnedContext) =>
        unpinPinnedContextEntry({
          currentEntries: currentPinnedContext,
          entityType,
          entityId: normalizedEntityId,
        }),
      );

      return { previousProfile } satisfies WorkspaceMemoryMutationContext;
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(profileQueryKey, context?.previousProfile);
      toast.error("Failed to unpin Bloom context", {
        description: toErrorMessage(error),
      });
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKey, profile);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });

  const clearAllConversations = useCallback(
    () => clearAllConversationsMutation.mutateAsync(),
    [clearAllConversationsMutation],
  );

  const markTipSeen = useCallback(
    (tipId: BloomOnboardingTipId) =>
      markTipSeenMutation.mutateAsync(normalizeOnboardingTipId(tipId)),
    [markTipSeenMutation],
  );

  const unlockAllFeatures = useCallback(
    () => unlockAllFeaturesMutation.mutateAsync(),
    [unlockAllFeaturesMutation],
  );

  const pinEntity = useCallback(
    (entityType: BloomPageEntityType, entityId: string, entityName: string) =>
      pinEntityMutation.mutateAsync({ entityType, entityId, entityName }),
    [pinEntityMutation],
  );

  const unpinEntity = useCallback(
    (entityType: BloomPageEntityType, entityId: string) =>
      unpinEntityMutation.mutateAsync({ entityType, entityId }),
    [unpinEntityMutation],
  );

  const deleteBloomProfile = useCallback(
    () => deleteBloomProfileMutation.mutateAsync(),
    [deleteBloomProfileMutation],
  );

  return {
    updatePreferences,
    markTipSeen,
    unlockAllFeatures,
    pinEntity,
    unpinEntity,
    clearAllConversations,
    deleteBloomProfile,
    isUpdatingPreferences: updatePreferencesMutation.isPending,
    isMarkingTipSeen: markTipSeenMutation.isPending,
    isUnlockingAllFeatures: unlockAllFeaturesMutation.isPending,
    isPinningEntity: pinEntityMutation.isPending,
    isUnpinningEntity: unpinEntityMutation.isPending,
    isClearingConversations: clearAllConversationsMutation.isPending,
    isDeletingProfile: deleteBloomProfileMutation.isPending,
  };
}
