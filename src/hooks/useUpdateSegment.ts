import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/contexts/AdminContext";
import type { SegmentRuleGroup } from "@/lib/segmentFields";
import type { SegmentKind, SegmentStatus } from "@/hooks/useSegments";
import { resolveTenantMutationContext } from "@/utils/resolveTenantMutationContext";

export interface UpdateSegmentInput {
  segmentId: string;
  name: string;
  description?: string | null;
  type: SegmentKind;
  status: SegmentStatus;
  rules: SegmentRuleGroup;
  includeAllCustomers?: boolean;
  memberIds?: string[];
}

export function useUpdateSegment() {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const { isMasterAdmin, activeTenantId, hasHydratedTenantContext } =
    useAdmin();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateSegmentInput) => {
      const { tenantId, userId } = await resolveTenantMutationContext({
        userId: user?.id,
        tenantId: tenant?.id,
        isMasterAdmin,
        activeTenantId,
        hasHydratedTenantContext,
      });

      const trimmedName = input.name.trim();
      if (!trimmedName) {
        throw new Error("Segment name is required.");
      }

      const { data: duplicate, error: duplicateError } = await supabase
        .from("crm_segments")
        .select("id")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .ilike("name", trimmedName)
        .neq("id", input.segmentId)
        .maybeSingle();

      if (duplicateError) {
        throw duplicateError;
      }
      if (duplicate) {
        throw new Error("A segment with this name already exists.");
      }

      const { error: updateError } = await supabase
        .from("crm_segments")
        .update({
          name: trimmedName,
          description: input.description?.trim() || null,
          auto_update: input.type === "dynamic",
          conditions: input.rules,
          include_all_customers: input.includeAllCustomers ?? false,
          status: input.status,
        })
        .eq("tenant_id", tenantId)
        .eq("id", input.segmentId);

      if (updateError) {
        throw updateError;
      }

      const targetMemberIds = new Set(input.memberIds ?? []);

      const { data: currentMemberships, error: membershipsError } =
        await supabase
          .from("customer_segments")
          .select("customer_id")
          .eq("segment_id", input.segmentId);

      if (membershipsError) {
        throw membershipsError;
      }

      const currentMemberIds = new Set(
        (currentMemberships ?? []).map((row) => row.customer_id),
      );

      if (input.type === "dynamic") {
        if (currentMemberIds.size) {
          const { error: deleteMembershipsError } = await supabase
            .from("customer_segments")
            .delete()
            .eq("segment_id", input.segmentId);

          if (deleteMembershipsError) {
            throw deleteMembershipsError;
          }
        }
      } else {
        const idsToAdd = [...targetMemberIds].filter(
          (id) => !currentMemberIds.has(id),
        );
        const idsToRemove = [...currentMemberIds].filter(
          (id) => !targetMemberIds.has(id),
        );

        if (idsToRemove.length) {
          const { error: removeError } = await supabase
            .from("customer_segments")
            .delete()
            .eq("segment_id", input.segmentId)
            .in("customer_id", idsToRemove);

          if (removeError) {
            throw removeError;
          }
        }

        if (idsToAdd.length) {
          const rows = idsToAdd.map((customerId) => ({
            customer_id: customerId,
            segment_id: input.segmentId,
            assigned_by_user_id: userId,
          }));
          const { error: addError } = await supabase
            .from("customer_segments")
            .upsert(rows, { onConflict: "customer_id,segment_id" });

          if (addError) {
            throw addError;
          }
        }

        const { error: countError } = await supabase
          .from("crm_segments")
          .update({ customer_count: targetMemberIds.size })
          .eq("tenant_id", tenantId)
          .eq("id", input.segmentId);

        if (countError) {
          throw countError;
        }
      }

      return input.segmentId;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["segments"] });
      void queryClient.invalidateQueries({
        queryKey: ["segment", undefined, variables.segmentId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["segment-members", undefined, variables.segmentId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["segment-preview-base"],
      });
      void queryClient.invalidateQueries({ queryKey: ["customer-segments"] });
    },
  });
}
