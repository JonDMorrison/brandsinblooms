import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/contexts/AdminContext";
import { resolveTenantMutationContext } from "@/utils/resolveTenantMutationContext";

export function useDeleteSegment() {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const { isMasterAdmin, activeTenantId, hasHydratedTenantContext } =
    useAdmin();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (segmentId: string) => {
      const { tenantId } = await resolveTenantMutationContext({
        userId: user?.id,
        tenantId: tenant?.id,
        isMasterAdmin,
        activeTenantId,
        hasHydratedTenantContext,
      });

      const { error } = await supabase
        .from("crm_segments")
        .update({
          deleted_at: new Date().toISOString(),
          status: "archived",
        })
        .eq("tenant_id", tenantId)
        .eq("id", segmentId);

      if (error) {
        throw error;
      }

      return segmentId;
    },
    onSuccess: (_data, segmentId) => {
      void queryClient.invalidateQueries({ queryKey: ["segments"] });
      void queryClient.invalidateQueries({
        queryKey: ["segment", undefined, segmentId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["segment-members", undefined, segmentId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["segment-preview-base"],
      });
      void queryClient.invalidateQueries({ queryKey: ["customer-segments"] });
    },
  });
}
