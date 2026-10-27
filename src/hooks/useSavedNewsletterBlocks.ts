import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useAdmin } from "@/contexts/AdminContext";
import type { StudioBlock } from "@/types/studioBlocks";
import type { Json } from "@/integrations/supabase/types";
import {
  readSavedBlock,
  savedBlockName,
  type SavedBlock,
} from "@/lib/studio/newsletter/savedBlocks";
export function useSavedNewsletterBlocks() {
  const { user } = useAuth();
  const { tenant, loading: tenantLoading, error: tenantError } = useTenant();
  const admin = useAdmin();
  const cache = useQueryClient();
  const tenantId =
    !tenantLoading &&
    (!admin.isMasterAdmin ||
      !admin.activeTenantId ||
      admin.activeTenantId === tenant?.id)
      ? tenant?.id
      : null;
  const key = ["newsletter-saved-blocks", user?.id, tenantId] as const;
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(user?.id && tenantId),
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_saved_blocks")
        .select("id,name,block_data,updated_at")
        .eq("tenant_id", tenantId!)
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error)
        throw new Error(
          "Saved Blocks could not be loaded from this account. Please retry.",
        );
      return (data || []).flatMap((row) => {
        const block = readSavedBlock(row.block_data);
        return block
          ? [
              {
                id: row.id,
                name: row.name,
                block,
                updatedAt: row.updated_at,
              } satisfies SavedBlock,
            ]
          : [];
      });
    },
  });
  const context = () => {
    if (!tenantId || !user?.id)
      throw new Error("Select an account before saving blocks.");
    return { tenantId, userId: user.id };
  };
  const create = useMutation({
    mutationFn: async ({
      name,
      block,
    }: {
      name: string;
      block: StudioBlock;
    }) => {
      const ctx = context();
      const clean = readSavedBlock(block);
      if (!clean) throw new Error("This block cannot be saved.");
      const { data, error } = await supabase
        .from("crm_saved_blocks")
        .insert({
          tenant_id: ctx.tenantId,
          created_by: ctx.userId,
          save_schema_version: 2,
          name: savedBlockName(name),
          block_data: JSON.parse(JSON.stringify(clean)) as Json,
        })
        .select("id")
        .single();
      if (error)
        throw new Error(
          "Could not save the block. Your newsletter has not changed.",
        );
      return { id: data.id, ...ctx };
    },
    onSuccess: (result) =>
      cache.invalidateQueries({
        queryKey: ["newsletter-saved-blocks", result.userId, result.tenantId],
      }),
  });
  const rename = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const ctx = context();
      const { data, error } = await supabase
        .from("crm_saved_blocks")
        .update({
          name: savedBlockName(name),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("tenant_id", ctx.tenantId)
        .select("id")
        .single();
      if (error || !data)
        throw new Error(
          "This saved block could not be renamed. Refresh and retry.",
        );
      return ctx;
    },
    onSuccess: (result) =>
      cache.invalidateQueries({
        queryKey: ["newsletter-saved-blocks", result.userId, result.tenantId],
      }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const ctx = context();
      const { data, error } = await supabase
        .from("crm_saved_blocks")
        .delete()
        .eq("id", id)
        .eq("tenant_id", ctx.tenantId)
        .select("id")
        .single();
      if (error || !data)
        throw new Error(
          "This saved block could not be removed. Refresh and retry.",
        );
      return ctx;
    },
    onSuccess: (result) =>
      cache.invalidateQueries({
        queryKey: ["newsletter-saved-blocks", result.userId, result.tenantId],
      }),
  });
  return {
    blocks: tenantId ? query.data || [] : [],
    loading: tenantLoading || query.isLoading,
    error: tenantError || query.error?.message || "",
    reload: query.refetch,
    create: create.mutateAsync,
    rename: rename.mutateAsync,
    remove: remove.mutateAsync,
    busy: create.isPending || rename.isPending || remove.isPending,
    accountName: tenant?.name || "this account",
    ready: Boolean(tenantId && user?.id),
  };
}
