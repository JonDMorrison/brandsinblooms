import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import {
  parseCampaignApproval,
  parseCampaignApprovalSetting,
  type CampaignApproval,
  type CampaignApprovalSetting,
} from "@/lib/crm/campaignApproval";

/** Tenant scope comes from the server (get_current_crm_access), as for every CRM read. */
export function useCampaignApprovalSetting(enabled = true) {
  const { tenantId } = useUserRole();
  const queryClient = useQueryClient();
  const queryKey = ["campaign-approval-setting", tenantId];

  const query = useQuery<CampaignApprovalSetting | null>({
    queryKey,
    enabled: enabled && Boolean(tenantId),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_campaign_approval_setting");
      if (error) throw error;
      return parseCampaignApprovalSetting(data);
    },
  });

  const setRequired = useMutation({
    mutationFn: async (required: boolean) => {
      const { data, error } = await supabase.rpc("set_campaign_approval_required", { p_required: required });
      if (error) throw error;
      const result = data as { scheduledNowWaiting?: unknown } | null;
      return typeof result?.scheduledNowWaiting === "number" ? result.scheduledNowWaiting : 0;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ["campaign-approval"] });
    },
  });

  return { setting: query.data ?? null, isLoading: query.isLoading, error: query.error, setRequired };
}

export function useCampaignApproval(campaignId: string | null | undefined, enabled = true) {
  const { tenantId } = useUserRole();
  const queryClient = useQueryClient();
  const queryKey = ["campaign-approval", tenantId, campaignId];

  const query = useQuery<CampaignApproval | null>({
    queryKey,
    enabled: enabled && Boolean(tenantId) && Boolean(campaignId),
    // Approval depends on the saved email. Always ask again when shown.
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_campaign_approval", { p_campaign_id: campaignId as string });
      if (error) throw error;
      return parseCampaignApproval(data);
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const submit = useMutation({
    mutationFn: async (note: string) => {
      const { error } = await supabase.rpc("submit_campaign_for_approval", {
        p_campaign_id: campaignId as string,
        p_note: note.trim() || undefined,
      });
      if (error) throw error;
    },
    onSettled: () => void refresh(),
  });

  const decide = useMutation({
    mutationFn: async (input: { decision: "approve" | "request_changes"; reviewedFingerprint: string; note: string }) => {
      const { data, error } = await supabase.rpc("decide_campaign_approval", {
        p_campaign_id: campaignId as string,
        p_decision: input.decision,
        p_reviewed_fingerprint: input.reviewedFingerprint,
        p_note: input.note.trim() || undefined,
      });
      if (error) throw error;
      const result = data as { ok?: unknown; reason?: unknown } | null;
      return { ok: result?.ok === true, reason: typeof result?.reason === "string" ? result.reason : null };
    },
    onSettled: () => void refresh(),
  });

  return { approval: query.data ?? null, isLoading: query.isLoading, error: query.error, refresh, submit, decide };
}
