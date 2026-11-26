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
  /** Saved by the signed-in user. Teammates' templates are read-only. */
  isOwn: boolean;
  category: string | null;
  tags: string[];
  /** Emails started from a locked design keep that design. Set by designers. */
  isLocked: boolean;
}

export interface UpdateTemplateDetailsInput {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  tags?: string[];
  isLocked?: boolean;
}

const TEMPLATE_COLUMNS =
  "id, user_id, tenant_id, name, description, layout_json, created_at, updated_at, category, tags, is_locked";

/** Tags as saved: trimmed, no blanks, no repeats (case-insensitive), at most 12. */
export function normalizeTemplateTags(tags: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags ?? []) {
    const tag = String(raw).trim().slice(0, 40);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out.slice(0, 12);
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

function toSavedTemplate(
  row: Record<string, unknown>,
  currentUserId: string | null,
): SavedTemplate {
  return {
    isOwn: Boolean(currentUserId) && String(row.user_id) === currentUserId,
    isLocked: row.is_locked === true,
    id: String(row.id),
    user_id: String(row.user_id),
    tenant_id:
      typeof row.tenant_id === "string" && row.tenant_id ? row.tenant_id : null,
    name: typeof row.name === "string" ? row.name : "",
    description: typeof row.description === "string" ? row.description : null,
    layout_json: toBlockArray(row.layout_json),
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
    // "general" is the table's default, set on every design saved before
    // categories could be chosen. It means no category was picked.
    category:
      typeof row.category === "string" && row.category.trim() && row.category.trim().toLowerCase() !== "general"
        ? row.category.trim()
        : null,
    tags: normalizeTemplateTags(Array.isArray(row.tags) ? (row.tags as string[]) : []),
  };
}

export function savedTemplatesQueryKey(
  userId: string | null | undefined,
  tenantId?: string | null,
) {
  return ["saved-templates", userId ?? null, tenantId ?? null] as const;
}

export function useSavedTemplates() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  const userId = user?.id ?? null;
  const tenantId = tenant?.id ?? null;

  const queryKey = useMemo(
    () => savedTemplatesQueryKey(userId, tenantId),
    [tenantId, userId],
  );

  const query = useQuery({
    queryKey,
    enabled: Boolean(userId),
    staleTime: SAVED_TEMPLATES_STALE_TIME_MS,
    queryFn: async (): Promise<SavedTemplate[]> => {
      if (!userId) {
        return [];
      }

      let templatesQuery = supabase
        .from("saved_campaign_templates")
        .select(
          TEMPLATE_COLUMNS,
        );
      // This business's designs, from anyone on the team (RLS: tenant members
      // can read them), plus your own older ones saved without a business.
      // Never another tenant's, so a template never carries their branding.
      templatesQuery = tenantId
        ? templatesQuery.or(
            `tenant_id.eq.${tenantId},and(user_id.eq.${userId},tenant_id.is.null)`,
          )
        : templatesQuery.eq("user_id", userId);
      const { data, error } = await templatesQuery.order("created_at", {
        ascending: false,
      });

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) =>
        toSavedTemplate(row as Record<string, unknown>, userId),
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
          TEMPLATE_COLUMNS,
        )
        .single();

      if (error) {
        throw error;
      }

      return toSavedTemplate(data as Record<string, unknown>, userId);
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
          TEMPLATE_COLUMNS,
        )
        .single();

      if (error) {
        throw error;
      }

      return toSavedTemplate(data as Record<string, unknown>, userId);
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

  const detailsMutation = useMutation({
    mutationFn: async (input: UpdateTemplateDetailsInput): Promise<SavedTemplate> => {
      const name = input.name.trim();
      if (!name) throw new Error("Template name is required");
      const payload: Record<string, unknown> = { name };
      if (input.description !== undefined) payload.description = input.description?.trim() || null;
      if (input.category !== undefined) payload.category = input.category?.trim() || null;
      if (input.tags !== undefined) payload.tags = normalizeTemplateTags(input.tags);
      // The database refuses this unless the person has the design permission.
      if (input.isLocked !== undefined) payload.is_locked = input.isLocked;
      const { data, error } = await supabase
        .from("saved_campaign_templates")
        .update(payload)
        .eq("id", input.id)
        .select(TEMPLATE_COLUMNS)
        .single();
      if (error) throw error;
      return toSavedTemplate(data as Record<string, unknown>, userId);
    },
    onSuccess: () => {
      void invalidate();
    },
  });

  // A copy belongs to whoever made it, so a teammate's design can be reused
  // and changed without touching the original.
  const duplicateMutation = useMutation({
    mutationFn: async (template: SavedTemplate): Promise<SavedTemplate> => {
      if (!userId) throw new Error("Must be signed in to copy a template");
      const { data, error } = await supabase
        .from("saved_campaign_templates")
        .insert({
          user_id: userId,
          tenant_id: tenantId,
          name: `${template.name} (copy)`.slice(0, 120),
          description: template.description,
          layout_json: template.layout_json as never,
          category: template.category,
          tags: template.tags,
          is_public: false,
          automation_ready: false,
        })
        .select(TEMPLATE_COLUMNS)
        .single();
      if (error) throw error;
      return toSavedTemplate(data as Record<string, unknown>, userId);
    },
    onSuccess: () => {
      void invalidate();
    },
  });

  const updateTemplateDetails = useCallback(
    (input: UpdateTemplateDetailsInput) => detailsMutation.mutateAsync(input),
    [detailsMutation],
  );
  const duplicateTemplate = useCallback(
    (template: SavedTemplate) => duplicateMutation.mutateAsync(template),
    [duplicateMutation],
  );

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
    updateTemplateDetails,
    duplicateTemplate,
    isUpdatingDetails: detailsMutation.isPending,
    isDuplicating: duplicateMutation.isPending,
    isSaving: saveMutation.isPending,
    isRenaming: renameMutation.isPending,
    isArchiving: archiveMutation.isPending,
  };
}
