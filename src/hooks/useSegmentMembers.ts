import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import {
  buildCustomerName,
  getCustomerLifecycleStage,
} from "@/lib/segmentFields";
import type { Database } from "@/integrations/supabase/types";

type CustomerRow = Database["public"]["Tables"]["crm_customers"]["Row"];

export interface SegmentMemberRecord {
  membershipId: string;
  customerId: string;
  name: string;
  email: string;
  phone: string | null;
  lifecycleStage: string;
  preferredChannel: string | null;
  lastActivityAt: string | null;
  addedAt: string;
  addedByUserId: string | null;
  customer: CustomerRow;
}

export interface UseSegmentMembersOptions {
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useSegmentMembers(
  segmentId?: string,
  options: UseSegmentMembersOptions = {},
) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;
  const search = String(options.search ?? "")
    .trim()
    .toLowerCase();
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 25;

  const query = useQuery({
    queryKey: ["segment-members", tenantId, segmentId],
    enabled: Boolean(tenantId && segmentId),
    queryFn: async () => {
      if (!tenantId || !segmentId) {
        return [] as SegmentMemberRecord[];
      }

      const { data, error } = await supabase
        .from("customer_segments")
        .select(
          `
            id,
            assigned_at,
            assigned_by_user_id,
            crm_customers!inner(*)
          `,
        )
        .eq("segment_id", segmentId)
        .eq("crm_customers.tenant_id", tenantId)
        .order("assigned_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => {
        const customer = row.crm_customers as unknown as CustomerRow;
        const lastActivityAt =
          customer.last_purchase_date ??
          customer.last_email_clicked_at ??
          customer.last_open_at ??
          customer.updated_at ??
          customer.created_at;

        return {
          membershipId: row.id,
          customerId: customer.id,
          name: buildCustomerName(customer),
          email: customer.email,
          phone: customer.phone,
          lifecycleStage: getCustomerLifecycleStage(customer),
          preferredChannel: customer.preferred_channel,
          lastActivityAt,
          addedAt: row.assigned_at,
          addedByUserId: row.assigned_by_user_id,
          customer,
        } satisfies SegmentMemberRecord;
      });
    },
    staleTime: 30_000,
  });

  const filteredMembers = useMemo(() => {
    const records = query.data ?? [];
    if (!search) {
      return records;
    }

    return records.filter((record) => {
      return (
        record.name.toLowerCase().includes(search) ||
        record.email.toLowerCase().includes(search) ||
        String(record.phone ?? "")
          .toLowerCase()
          .includes(search)
      );
    });
  }, [query.data, search]);

  const paginatedMembers = useMemo(() => {
    const startIndex = Math.max(0, (page - 1) * pageSize);
    return filteredMembers.slice(startIndex, startIndex + pageSize);
  }, [filteredMembers, page, pageSize]);

  return {
    ...query,
    members: paginatedMembers,
    allMembers: filteredMembers,
    totalCount: filteredMembers.length,
    totalPages: Math.max(1, Math.ceil(filteredMembers.length / pageSize)),
  };
}
