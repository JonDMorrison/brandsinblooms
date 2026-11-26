import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

export interface CampaignTemplateLock {
  locked: boolean;
  templateName: string | null;
  canDesign: boolean;
}

export function parseCampaignTemplateLock(value: unknown): CampaignTemplateLock {
  const data = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    locked: data.locked === true,
    templateName: typeof data.templateName === "string" && data.templateName ? data.templateName : null,
    canDesign: data.canDesign === true,
  };
}

/** The database's refusal of a design change on a locked email. */
export function isLockedDesignError(error: unknown): boolean {
  const message = error && typeof error === "object" ? (error as { message?: unknown }).message : null;
  return typeof message === "string" && /locked design/i.test(message);
}

/** Is this email held to a locked design? The database enforces it; this explains it. */
export function useCampaignTemplateLock(campaignId: string | null | undefined) {
  const { tenantId } = useUserRole();
  const queryClient = useQueryClient();
  const queryKey = ["campaign-template-lock", tenantId, campaignId];

  const query = useQuery<CampaignTemplateLock>({
    queryKey,
    enabled: Boolean(tenantId) && Boolean(campaignId),
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_campaign_template_lock", { p_campaign_id: campaignId as string });
      if (error) throw error;
      return parseCampaignTemplateLock(data);
    },
  });

  /** Name the locked template on the saved email, keeping everything else in its metadata. */
  const record = useCallback(
    async (templateId: string) => {
      if (!campaignId || !tenantId) return;
      const { data, error } = await supabase
        .from("crm_campaigns")
        .select("metadata")
        .eq("id", campaignId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error || !data) return;
      const metadata =
        data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
          ? (data.metadata as Record<string, unknown>)
          : {};
      if (metadata.lockedTemplateId === templateId) return;
      await supabase
        .from("crm_campaigns")
        .update({ metadata: { ...metadata, lockedTemplateId: templateId } as never })
        .eq("id", campaignId)
        .eq("tenant_id", tenantId);
      void queryClient.invalidateQueries({ queryKey: ["campaign-template-lock", tenantId, campaignId] });
    },
    [campaignId, queryClient, tenantId],
  );

  const release = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("release_campaign_template_lock", { p_campaign_id: campaignId as string });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
  });

  return { lock: query.data ?? null, record, release };
}
