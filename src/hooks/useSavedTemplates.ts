import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import type { StudioBlock } from "@/types/studioBlocks";

export interface SavedTemplate {
  id: string;
  user_id: string;
  tenant_id: string | null;
  name: string;
  description: string | null;
  layout_json: StudioBlock[];
  created_at: string;
  updated_at: string;
}

export interface SaveTemplateInput {
  name: string;
  description?: string | null;
  contentBlocks: StudioBlock[];
}

export interface RenameTemplateInput {
  id: string;
  name: string;
  description?: string | null;
}

const SAVED_TEMPLATES_STALE_TIME_MS = 30_000;

function toBlockArray(value: unknown): StudioBlock[] {
  return Array.isArray(value) ? (value as StudioBlock[]) : [];
}

function toSavedTemplate(row: Record<string, unknown>): SavedTemplate {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    tenant_id:
      typeof row.tenant_id === "string" && row.tenant_id ? row.tenant_id : null,
    name: typeof row.name === "string" ? row.name : "",
    description: typeof row.description === "string" ? row.description : null,
    layout_json: toBlockArray(row.layout_json),
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
  };
}

export function savedTemplatesQueryKey(userId: string | null | undefined) {
  return ["saved-templates", userId ?? null] as const;
}

export function useSavedTemplates() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  const userId = user?.id ?? null;
  const tenantId = tenant?.id ?? null;

  const queryKey = useMemo(() => savedTemplatesQueryKey(userId), [userId]);

  const query = useQuery({
    queryKey,
    enabled: Boolean(userId),
    staleTime: SAVED_TEMPLATES_STALE_TIME_MS,
    queryFn: async (): Promise<SavedTemplate[]> => {
      if (!userId) {
        return [];
      }

      const { data, error } = await supabase
        .from("saved_campaign_templates")
        .select(
          "id, user_id, tenant_id, name, description, layout_json, created_at, updated_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) =>
        toSavedTemplate(row as Record<string, unknown>),
      );
    },
  });

  const invalidate = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const saveMutation = useMutation({
    mutationFn: async (input: SaveTemplateInput): Promise<SavedTemplate> => {
      if (!userId) {
        throw new Error("Must be signed in to save a template");
      }
      const trimmedName = input.name.trim();
      if (!trimmedName) {
        throw new Error("Template name is required");
      }
      const description = input.description?.trim() || null;

      const { data, error } = await supabase
        .from("saved_campaign_templates")
        .insert({
          user_id: userId,
          tenant_id: tenantId,
          name: trimmedName,
          description,
          layout_json: input.contentBlocks as never,
          is_public: false,
          automation_ready: false,
        })
        .select(
          "id, user_id, tenant_id, name, description, layout_json, created_at, updated_at",
        )
        .single();

      if (error) {
        throw error;
      }

      return toSavedTemplate(data as Record<string, unknown>);
    },
    onSuccess: () => {
      void invalidate();
    },
  });

  const renameMutation = useMutation({
    mutationFn: async (input: RenameTemplateInput): Promise<SavedTemplate> => {
      const trimmedName = input.name.trim();
      if (!trimmedName) {
        throw new Error("Template name is required");
      }
      const description =
        input.description === undefined
          ? undefined
          : input.description?.trim() || null;

      const updatePayload: Record<string, unknown> = { name: trimmedName };
      if (description !== undefined) {
        updatePayload.description = description;
      }

      const { data, error } = await supabase
        .from("saved_campaign_templates")
        .update(updatePayload)
        .eq("id", input.id)
        .select(
          "id, user_id, tenant_id, name, description, layout_json, created_at, updated_at",
        )
        .single();

      if (error) {
        throw error;
      }

      return toSavedTemplate(data as Record<string, unknown>);
    },
    onSuccess: () => {
      void invalidate();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      // Table has no soft-delete column; hard delete is intentional.
      // The manage UI confirms before invoking this.
      const { error } = await supabase
        .from("saved_campaign_templates")
        .delete()
        .eq("id", id);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      void invalidate();
    },
  });

  const saveTemplate = useCallback(
    (input: SaveTemplateInput) => saveMutation.mutateAsync(input),
    [saveMutation],
  );

  const renameTemplate = useCallback(
    (id: string, name: string, description?: string | null) =>
      renameMutation.mutateAsync({ id, name, description }),
    [renameMutation],
  );

  const archiveTemplate = useCallback(
    (id: string) => archiveMutation.mutateAsync(id),
    [archiveMutation],
  );

  return {
    savedTemplates: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    saveTemplate,
    renameTemplate,
    archiveTemplate,
    isSaving: saveMutation.isPending,
    isRenaming: renameMutation.isPending,
    isArchiving: archiveMutation.isPending,
  };
}
