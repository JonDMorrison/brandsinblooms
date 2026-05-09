import { supabase } from "@/integrations/supabase/client";
import { getSegmentById, SYSTEM_SEGMENTS } from "@/config/segmentDefinitions";

const UUID_LIKE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEASONAL_TAGS = new Set([
  "seasonal",
  "holiday",
  "christmas",
  "valentine",
  "easter",
  "summer",
  "winter",
]);
const SYSTEM_SEGMENT_IDS = new Set(
  SYSTEM_SEGMENTS.map((segment) => segment.id),
);
const PAGE_SIZE = 1000;

type PagedQueryResult<Row> = {
  data: Row[] | null;
  error: unknown;
};

export function isUuidLike(value: string) {
  return UUID_LIKE_REGEX.test(value);
}

function chunkIds(ids: string[], size = 200) {
  const chunks: string[][] = [];

  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }

  return chunks;
}

async function fetchIdsPaged<Row>(
  queryFactory: (
    from: number,
    to: number,
  ) => PromiseLike<PagedQueryResult<Row>>,
  rowToId: (row: Row) => string | null,
) {
  const ids = new Set<string>();

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await queryFactory(from, to);
    if (error) {
      throw error;
    }

    (data ?? []).forEach((row) => {
      const id = rowToId(row);
      if (id) {
        ids.add(id);
      }
    });

    if (!data || data.length < PAGE_SIZE) {
      break;
    }
  }

  return ids;
}

interface ComputeAudienceRecipientCountParams {
  tenantId?: string | null;
  totalCustomerCount?: number;
  includeAllCustomers?: boolean;
  additionalCustomerIds?: string[];
  fallbackToAllCustomers?: boolean;
  segmentIds: string[];
  personaIds: string[];
}

interface ResolveAudienceRecipientIdsParams {
  tenantId?: string | null;
  includeAllCustomers?: boolean;
  additionalCustomerIds?: string[];
  fallbackToAllCustomers?: boolean;
  segmentIds: string[];
  personaIds: string[];
}

async function fetchValidatedAdditionalCustomerIds(
  tenantId: string,
  customerIds: string[],
) {
  const validatedCustomerIds = new Set<string>();

  for (const customerIdChunk of chunkIds(customerIds)) {
    const { data, error } = await supabase
      .from("crm_customers")
      .select("id")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .in("id", customerIdChunk);

    if (error) {
      throw error;
    }

    (data ?? []).forEach((row) => {
      const customerId = String(row?.id || "");
      if (isUuidLike(customerId)) {
        validatedCustomerIds.add(customerId);
      }
    });
  }

  return validatedCustomerIds;
}

export async function resolveAudienceRecipientIds({
  tenantId,
  includeAllCustomers = false,
  additionalCustomerIds = [],
  fallbackToAllCustomers = false,
  segmentIds,
  personaIds,
}: ResolveAudienceRecipientIdsParams) {
  if (!tenantId) {
    return [] as string[];
  }

  const safeSegmentIds = segmentIds.filter(Boolean);
  const customSegmentIds = safeSegmentIds.filter(isUuidLike);
  const systemSegmentIds = safeSegmentIds.filter(
    (segmentId) => !isUuidLike(segmentId) && SYSTEM_SEGMENT_IDS.has(segmentId),
  );
  const safePersonaIds = personaIds.filter(Boolean);
  const safeAdditionalCustomerIds = Array.from(
    new Set(additionalCustomerIds.filter(isUuidLike)),
  );
  const shouldResolveAllCustomers =
    includeAllCustomers ||
    (fallbackToAllCustomers &&
      customSegmentIds.length === 0 &&
      systemSegmentIds.length === 0 &&
      safePersonaIds.length === 0 &&
      safeAdditionalCustomerIds.length === 0);

  let resolvedCustomerIds: Set<string> | null = null;

  if (shouldResolveAllCustomers) {
    const allCustomerIds = await fetchIdsPaged(
      (from, to) =>
        supabase
          .from("crm_customers")
          .select("id")
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .range(from, to),
      (row) => {
        const id = String(row?.id || "");
        return isUuidLike(id) ? id : null;
      },
    );

    resolvedCustomerIds = allCustomerIds;
  }

  let segmentCustomerIds: Set<string> | null = null;
  if (!resolvedCustomerIds && customSegmentIds.length > 0) {
    segmentCustomerIds = await fetchIdsPaged(
      (from, to) =>
        supabase
          .from("customer_segments")
          .select("customer_id")
          .in("segment_id", customSegmentIds)
          .range(from, to),
      (row) => {
        const id = String(row?.customer_id || "");
        return isUuidLike(id) ? id : null;
      },
    );
  }

  if (!resolvedCustomerIds && systemSegmentIds.length > 0) {
    const { data: customers, error: customersError } = await supabase
      .from("crm_customers")
      .select(
        "id, tags, total_spent, created_at, last_purchase_date, order_history",
      )
      .eq("tenant_id", tenantId);

    if (customersError) {
      throw customersError;
    }

    const systemSegmentCustomerIds = new Set<string>();
    const customerRows = customers ?? [];
    const customerIds = customerRows.map((customer) => String(customer.id));
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const automaticAssignments = {
      "loyalty-members": new Set(
        customerRows
          .filter(
            (customer) =>
              Array.isArray(customer.tags) && customer.tags.includes("loyalty"),
          )
          .map((customer) => String(customer.id)),
      ),
      "high-value": new Set(
        customerRows
          .filter((customer) => Number(customer.total_spent ?? 0) > 500)
          .map((customer) => String(customer.id)),
      ),
      "new-customers": new Set(
        customerRows
          .filter((customer) => {
            const createdAt = customer.created_at
              ? new Date(customer.created_at)
              : null;
            return createdAt ? createdAt >= thirtyDaysAgo : false;
          })
          .map((customer) => String(customer.id)),
      ),
      "lapsed-customers": new Set(
        customerRows
          .filter((customer) => {
            const lastPurchaseDate = customer.last_purchase_date
              ? new Date(customer.last_purchase_date)
              : null;
            return lastPurchaseDate ? lastPurchaseDate < ninetyDaysAgo : false;
          })
          .map((customer) => String(customer.id)),
      ),
      "seasonal-shoppers": new Set(
        customerRows
          .filter(
            (customer) =>
              Array.isArray(customer.tags) &&
              customer.tags.some((tag: string) =>
                SEASONAL_TAGS.has(tag.toLowerCase()),
              ),
          )
          .map((customer) => String(customer.id)),
      ),
      "frequent-buyers": new Set(
        customerRows
          .filter(
            (customer) =>
              Array.isArray(customer.order_history) &&
              customer.order_history.length >= 3,
          )
          .map((customer) => String(customer.id)),
      ),
      "perks-members": new Set<string>(),
    } satisfies Record<string, Set<string>>;

    for (const customerIdChunk of chunkIds(customerIds)) {
      const { data: perksRows, error: perksError } = await supabase
        .from("customer_loyalty_metrics")
        .select("customer_id")
        .eq("is_perks_member", true)
        .in("customer_id", customerIdChunk);

      if (perksError) {
        throw perksError;
      }

      (perksRows ?? []).forEach((row) => {
        const customerId = String(row?.customer_id || "");
        if (isUuidLike(customerId)) {
          automaticAssignments["perks-members"].add(customerId);
        }
      });
    }

    const manualAssignmentsByName = new Map<string, Set<string>>();
    const rawCustomerSegmentRows: Array<{
      customer_id: string;
      segment_id: string;
    }> = [];

    for (const customerIdChunk of chunkIds(customerIds)) {
      const { data: customerSegmentRows, error: customerSegmentsError } =
        await supabase
          .from("customer_segments")
          .select("customer_id, segment_id")
          .in("customer_id", customerIdChunk);

      if (customerSegmentsError) {
        throw customerSegmentsError;
      }

      rawCustomerSegmentRows.push(...(customerSegmentRows ?? []));
    }

    const manualSegmentIds = Array.from(
      new Set(
        rawCustomerSegmentRows
          .map((row) => String(row.segment_id || ""))
          .filter(Boolean),
      ),
    );

    if (manualSegmentIds.length > 0) {
      const { data: manualSegments, error: manualSegmentsError } =
        await supabase
          .from("crm_segments")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .in("id", manualSegmentIds);

      if (manualSegmentsError) {
        throw manualSegmentsError;
      }

      const segmentNameById = new Map(
        (manualSegments ?? []).map((segment) => [
          String(segment.id),
          segment.name,
        ]),
      );

      rawCustomerSegmentRows.forEach((row) => {
        const segmentName = segmentNameById.get(String(row.segment_id || ""));
        const customerId = String(row.customer_id || "");

        if (!segmentName || !isUuidLike(customerId)) {
          return;
        }

        if (!manualAssignmentsByName.has(segmentName)) {
          manualAssignmentsByName.set(segmentName, new Set<string>());
        }

        manualAssignmentsByName.get(segmentName)?.add(customerId);
      });
    }

    systemSegmentIds.forEach((segmentId) => {
      automaticAssignments[segmentId]?.forEach((customerId) => {
        systemSegmentCustomerIds.add(customerId);
      });

      const segmentName = getSegmentById(segmentId)?.name;
      if (!segmentName) {
        return;
      }

      manualAssignmentsByName.get(segmentName)?.forEach((customerId) => {
        systemSegmentCustomerIds.add(customerId);
      });
    });

    if (systemSegmentCustomerIds.size > 0) {
      segmentCustomerIds = segmentCustomerIds ?? new Set<string>();
      systemSegmentCustomerIds.forEach((customerId) => {
        segmentCustomerIds?.add(customerId);
      });
    }
  }

  let personaCustomerIds: Set<string> | null = null;
  if (!resolvedCustomerIds && safePersonaIds.length > 0) {
    const uuidPersonas = safePersonaIds.filter(isUuidLike);
    const predefinedPersonas = safePersonaIds.filter(
      (personaId) => !isUuidLike(personaId),
    );
    const combined = new Set<string>();

    if (uuidPersonas.length > 0) {
      const idsFromJunction = await fetchIdsPaged(
        (from, to) =>
          supabase
            .from("customer_personas")
            .select("customer_id")
            .in("persona_id", uuidPersonas)
            .range(from, to),
        (row) => {
          const id = String(row?.customer_id || "");
          return isUuidLike(id) ? id : null;
        },
      );
      idsFromJunction.forEach((id) => combined.add(id));

      const idsFromLegacy = await fetchIdsPaged(
        (from, to) =>
          supabase
            .from("crm_customers")
            .select("id")
            .eq("tenant_id", tenantId)
            .in("persona_id", uuidPersonas)
            .range(from, to),
        (row) => {
          const id = String(row?.id || "");
          return isUuidLike(id) ? id : null;
        },
      );
      idsFromLegacy.forEach((id) => combined.add(id));
    }

    if (predefinedPersonas.length > 0) {
      const idsFromPredefined = await fetchIdsPaged(
        (from, to) =>
          supabase
            .from("customer_personas")
            .select("customer_id")
            .in("predefined_persona_id", predefinedPersonas)
            .range(from, to),
        (row) => {
          const id = String(row?.customer_id || "");
          return isUuidLike(id) ? id : null;
        },
      );
      idsFromPredefined.forEach((id) => combined.add(id));

      const idsFromLegacy = await fetchIdsPaged(
        (from, to) =>
          supabase
            .from("crm_customers")
            .select("id")
            .eq("tenant_id", tenantId)
            .in("persona_id", predefinedPersonas)
            .range(from, to),
        (row) => {
          const id = String(row?.id || "");
          return isUuidLike(id) ? id : null;
        },
      );
      idsFromLegacy.forEach((id) => combined.add(id));
    }

    personaCustomerIds = combined;
  }

  if (!resolvedCustomerIds && segmentCustomerIds && personaCustomerIds) {
    const [small, large] =
      segmentCustomerIds.size <= personaCustomerIds.size
        ? [segmentCustomerIds, personaCustomerIds]
        : [personaCustomerIds, segmentCustomerIds];

    resolvedCustomerIds = new Set(
      Array.from(small).filter((id) => large.has(id)),
    );
  }

  if (!resolvedCustomerIds && segmentCustomerIds) {
    resolvedCustomerIds = new Set(segmentCustomerIds);
  }

  if (!resolvedCustomerIds && personaCustomerIds) {
    resolvedCustomerIds = new Set(personaCustomerIds);
  }

  if (!resolvedCustomerIds) {
    resolvedCustomerIds = new Set<string>();
  }

  if (safeAdditionalCustomerIds.length > 0) {
    const validatedAdditionalCustomerIds =
      await fetchValidatedAdditionalCustomerIds(
        tenantId,
        safeAdditionalCustomerIds,
      );
    validatedAdditionalCustomerIds.forEach((customerId) => {
      resolvedCustomerIds?.add(customerId);
    });
  }

  return Array.from(resolvedCustomerIds);
}

export async function computeAudienceRecipientCount({
  tenantId,
  totalCustomerCount = 0,
  includeAllCustomers = false,
  additionalCustomerIds = [],
  fallbackToAllCustomers = false,
  segmentIds,
  personaIds,
}: ComputeAudienceRecipientCountParams) {
  if (!tenantId) {
    return 0;
  }

  if (
    !includeAllCustomers &&
    additionalCustomerIds.filter(isUuidLike).length === 0 &&
    fallbackToAllCustomers &&
    segmentIds.filter(Boolean).length === 0 &&
    personaIds.filter(Boolean).length === 0
  ) {
    return totalCustomerCount;
  }

  const recipientIds = await resolveAudienceRecipientIds({
    tenantId,
    includeAllCustomers,
    additionalCustomerIds,
    fallbackToAllCustomers,
    segmentIds,
    personaIds,
  });

  return recipientIds.length;
}
