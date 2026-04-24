import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface CustomerSegmentRecord {
  id: string;
  segment_id: string;
  assigned_at: string;
  segment: {
    id: string;
    name: string;
    description: string | null;
    customer_count: number;
    type: "dynamic" | "static";
    status: string;
  };
}

async function refreshSegmentCounts(segmentIds: string[]) {
  const uniqueIds = Array.from(new Set(segmentIds));

  await Promise.all(
    uniqueIds.map(async (segmentId) => {
      const { count, error: countError } = await supabase
        .from("customer_segments")
        .select("id", { count: "exact", head: true })
        .eq("segment_id", segmentId);

      if (countError) {
        throw countError;
      }

      const { error: updateError } = await supabase
        .from("crm_segments")
        .update({
          customer_count: count ?? 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", segmentId);

      if (updateError) {
        throw updateError;
      }
    }),
  );
}

export const useCustomerSegments = (customerId?: string) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["customer-segments", customerId],
    enabled: Boolean(customerId),
    queryFn: async (): Promise<CustomerSegmentRecord[]> => {
      if (!customerId) {
        return [];
      }

      const { data: membershipRows, error: membershipError } = await supabase
        .from("customer_segments")
        .select("id, segment_id, assigned_at")
        .eq("customer_id", customerId)
        .order("assigned_at", { ascending: false });

      if (membershipError) {
        throw membershipError;
      }

      const segmentIds = (membershipRows ?? []).map((row) => row.segment_id);
      if (!segmentIds.length) {
        return [];
      }

      const { data: segments, error: segmentError } = await supabase
        .from("crm_segments")
        .select(
          "id, name, description, customer_count, auto_update, status, deleted_at",
        )
        .in("id", segmentIds)
        .is("deleted_at", null);

      if (segmentError) {
        throw segmentError;
      }

      const registry = new Map(
        (segments ?? []).map((segment) => [segment.id, segment]),
      );

      return (membershipRows ?? [])
        .map((row) => {
          const segment = registry.get(row.segment_id);
          if (!segment) {
            return null;
          }

          return {
            id: row.id,
            segment_id: row.segment_id,
            assigned_at: row.assigned_at,
            segment: {
              id: segment.id,
              name: segment.name,
              description: segment.description,
              customer_count: segment.customer_count ?? 0,
              type: segment.auto_update ? "dynamic" : "static",
              status: segment.status,
            },
          } satisfies CustomerSegmentRecord;
        })
        .filter(Boolean) as CustomerSegmentRecord[];
    },
  });

  const addSegmentsMutation = useMutation({
    mutationFn: async (segmentIds: string[]) => {
      if (!customerId) {
        throw new Error("Customer ID required");
      }
      if (!segmentIds.length) {
        return;
      }

      const { data: segments, error: segmentError } = await supabase
        .from("crm_segments")
        .select("id, name, auto_update, deleted_at")
        .in("id", segmentIds)
        .is("deleted_at", null);

      if (segmentError) {
        throw segmentError;
      }

      const invalidSegments = (segments ?? []).filter(
        (segment) => segment.auto_update,
      );
      if (invalidSegments.length) {
        throw new Error("Only static segments can be assigned manually.");
      }

      const rows = segmentIds.map((segmentId) => ({
        customer_id: customerId,
        segment_id: segmentId,
        assigned_at: new Date().toISOString(),
        assigned_by_user_id: user?.id ?? null,
      }));

      const { error } = await supabase
        .from("customer_segments")
        .upsert(rows, { onConflict: "customer_id,segment_id" });

      if (error) {
        throw error;
      }

      await refreshSegmentCounts(segmentIds);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["customer-segments", customerId],
      });
      void queryClient.invalidateQueries({ queryKey: ["segments"] });
      void queryClient.invalidateQueries({ queryKey: ["segment-members"] });
      toast.success("Segments assigned successfully");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to assign segments",
      );
    },
  });

  const removeSegmentMutation = useMutation({
    mutationFn: async (segmentId: string) => {
      if (!customerId) {
        throw new Error("Customer ID required");
      }

      const { data: segment, error: segmentError } = await supabase
        .from("crm_segments")
        .select("id, auto_update")
        .eq("id", segmentId)
        .maybeSingle();

      if (segmentError) {
        throw segmentError;
      }

      if (segment?.auto_update) {
        throw new Error(
          "Dynamic segment memberships are managed automatically.",
        );
      }

      const { error } = await supabase
        .from("customer_segments")
        .delete()
        .eq("customer_id", customerId)
        .eq("segment_id", segmentId);

      if (error) {
        throw error;
      }

      await refreshSegmentCounts([segmentId]);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["customer-segments", customerId],
      });
      void queryClient.invalidateQueries({ queryKey: ["segments"] });
      void queryClient.invalidateQueries({ queryKey: ["segment-members"] });
      toast.success("Segment removed successfully");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove segment",
      );
    },
  });

  const addSegments = useCallback(
    async (segmentIds: string[]) => addSegmentsMutation.mutateAsync(segmentIds),
    [addSegmentsMutation],
  );

  const removeSegment = useCallback(
    async (segmentId: string) => removeSegmentMutation.mutateAsync(segmentId),
    [removeSegmentMutation],
  );

  return {
    customerSegments: query.data ?? [],
    staticSegments: (query.data ?? []).filter(
      (assignment) => assignment.segment.type === "static",
    ),
    dynamicSegments: (query.data ?? []).filter(
      (assignment) => assignment.segment.type === "dynamic",
    ),
    isLoading: query.isLoading,
    addSegments,
    removeSegment,
    isAddingSegments: addSegmentsMutation.isPending,
    isRemovingSegment: removeSegmentMutation.isPending,
  };
};
