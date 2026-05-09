import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/contexts/AdminContext";
import type { SegmentRuleGroup } from "@/lib/segmentFields";
import type { SegmentKind, SegmentStatus } from "@/hooks/useSegments";
import { resolveTenantMutationContext } from "@/utils/resolveTenantMutationContext";

export interface CreateSegmentInput {
  name: string;
  description?: string | null;
  type: SegmentKind;
  status?: SegmentStatus;
  rules: SegmentRuleGroup;
  includeAllCustomers?: boolean;
  memberIds?: string[];
}

export function useCreateSegment() {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const { isMasterAdmin, activeTenantId, hasHydratedTenantContext } =
    useAdmin();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSegmentInput) => {
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

      const { data: existing, error: existingError } = await supabase
        .from("crm_segments")
        .select("id")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .ilike("name", trimmedName)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }
      if (existing) {
        throw new Error("A segment with this name already exists.");
      }

      const { data: segment, error: insertError } = await supabase
        .from("crm_segments")
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          name: trimmedName,
          description: input.description?.trim() || null,
          auto_update: input.type === "dynamic",
          conditions: input.rules,
          include_all_customers: input.includeAllCustomers ?? false,
          status: input.status ?? "active",
          customer_count:
            input.type === "static" ? (input.memberIds?.length ?? 0) : 0,
        })
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      if (segment && input.type === "static" && input.memberIds?.length) {
        const rows = input.memberIds.map((customerId) => ({
          customer_id: customerId,
          segment_id: segment.id,
          assigned_by_user_id: userId,
        }));

        const { error: membershipError } = await supabase
          .from("customer_segments")
          .upsert(rows, { onConflict: "customer_id,segment_id" });

        if (membershipError) {
          throw membershipError;
        }
      }

      return segment;
    },
    onSuccess: (_data) => {
      void queryClient.invalidateQueries({ queryKey: ["segments"] });
      void queryClient.invalidateQueries({
        queryKey: ["segment-preview-base"],
      });
      void queryClient.invalidateQueries({ queryKey: ["customer-segments"] });
    },
  });
}
