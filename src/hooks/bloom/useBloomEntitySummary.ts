import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type {
  BloomEntitySummary,
  BloomEntitySummaryDetail,
  BloomPageContext,
  BloomPageEntityType,
} from "@/hooks/bloom/types";

const ENTITY_SUMMARY_STALE_TIME_MS = 60 * 1000;

type CustomerSummaryRow = Pick<
  Database["public"]["Tables"]["crm_customers"]["Row"],
  | "deleted_at"
  | "email"
  | "first_name"
  | "id"
  | "last_name"
  | "last_purchase_date"
  | "tenant_id"
  | "total_spent"
>;

type ProductSummaryRow = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  "id" | "inventory_count" | "name" | "price" | "status" | "tenant_id"
>;

type CampaignSummaryRow = Pick<
  Database["public"]["Tables"]["crm_campaigns"]["Row"],
  | "id"
  | "name"
  | "projected_recipient_count"
  | "status"
  | "subject_line"
  | "tenant_id"
  | "total_recipients"
>;

type SegmentSummaryRow = Pick<
  Database["public"]["Tables"]["crm_segments"]["Row"],
  | "customer_count"
  | "deleted_at"
  | "id"
  | "is_system_segment"
  | "name"
  | "source"
  | "status"
  | "tenant_id"
>;

const readString = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const readFiniteNumber = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const formatCurrency = (value: number | null) => {
  if (value === null) {
    return null;
  }

  return new Intl.NumberFormat(undefined, {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
};

const formatInteger = (value: number | null) => {
  if (value === null) {
    return null;
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(value);
};

const formatShortDate = (value: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
};

const joinSummaryParts = (parts: Array<string | null>) => {
  const detailText = parts
    .filter((part): part is string => Boolean(part))
    .join(", ");

  return detailText || "No additional details available.";
};

const compactDetailItems = (
  items: Array<BloomEntitySummaryDetail | null>,
): BloomEntitySummaryDetail[] =>
  items.filter((item): item is BloomEntitySummaryDetail => Boolean(item));

const detailItem = (
  label: string,
  value: string | null,
): BloomEntitySummaryDetail | null =>
  value
    ? {
        label,
        value,
      }
    : null;

const fallbackName = (prefix: string, entityId: string) =>
  `${prefix} ${entityId.slice(0, 8)}`;

const buildCustomerName = (
  record: CustomerSummaryRow,
  entityId: string,
): string => {
  const firstName = readString(record.first_name);
  const lastName = readString(record.last_name);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return (
    fullName || readString(record.email) || fallbackName("Customer", entityId)
  );
};

const buildCustomerSummary = (
  record: CustomerSummaryRow,
  entityId: string,
): BloomEntitySummary => {
  const email = readString(record.email);
  const totalSpent = formatCurrency(readFiniteNumber(record.total_spent));
  const lastPurchaseDate = formatShortDate(
    readString(record.last_purchase_date),
  );

  return {
    entityType: "customer",
    entityId,
    name: buildCustomerName(record, entityId),
    summaryText: joinSummaryParts([
      email,
      totalSpent ? `${totalSpent} total spent` : null,
      lastPurchaseDate ? `last purchase ${lastPurchaseDate}` : null,
    ]),
    detailItems: compactDetailItems([
      detailItem("Email", email),
      detailItem("Total spent", totalSpent),
      detailItem("Last purchase", lastPurchaseDate),
    ]),
  };
};

const buildProductSummary = (
  record: ProductSummaryRow,
  entityId: string,
): BloomEntitySummary => {
  const price = formatCurrency(readFiniteNumber(record.price));
  const status = readString(record.status);
  const inventoryCount = formatInteger(
    readFiniteNumber(record.inventory_count),
  );

  return {
    entityType: "product",
    entityId,
    name: readString(record.name) || fallbackName("Product", entityId),
    summaryText: joinSummaryParts([
      price ? `${price} price` : null,
      status ? `status ${status}` : null,
      inventoryCount ? `${inventoryCount} in inventory` : null,
    ]),
    detailItems: compactDetailItems([
      detailItem("Price", price),
      detailItem("Status", status),
      detailItem("Inventory", inventoryCount),
    ]),
  };
};

const buildCampaignSummary = (
  record: CampaignSummaryRow,
  entityId: string,
): BloomEntitySummary => {
  const subjectLine = readString(record.subject_line);
  const status = readString(record.status);
  const audienceSize =
    formatInteger(readFiniteNumber(record.projected_recipient_count)) ??
    formatInteger(readFiniteNumber(record.total_recipients));

  return {
    entityType: "campaign",
    entityId,
    name: readString(record.name) || fallbackName("Campaign", entityId),
    summaryText: joinSummaryParts([
      subjectLine ? `subject \"${subjectLine}\"` : null,
      status ? `status ${status}` : null,
      audienceSize ? `${audienceSize} audience size` : null,
    ]),
    detailItems: compactDetailItems([
      detailItem("Subject", subjectLine),
      detailItem("Status", status),
      detailItem("Audience", audienceSize),
    ]),
  };
};

const humanizeSegmentType = (record: SegmentSummaryRow) => {
  if (record.is_system_segment === true) {
    return "System";
  }

  const source = readString(record.source);
  if (!source) {
    return "Custom";
  }

  return source
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const buildSegmentSummary = (
  record: SegmentSummaryRow,
  entityId: string,
): BloomEntitySummary => {
  const segmentType = humanizeSegmentType(record);
  const status = readString(record.status);
  const memberCount = formatInteger(readFiniteNumber(record.customer_count));

  return {
    entityType: "segment",
    entityId,
    name: readString(record.name) || fallbackName("Segment", entityId),
    summaryText: joinSummaryParts([
      `${segmentType.toLowerCase()} segment`,
      status ? `status ${status}` : null,
      memberCount ? `${memberCount} members` : null,
    ]),
    detailItems: compactDetailItems([
      detailItem("Type", segmentType),
      detailItem("Status", status),
      detailItem("Members", memberCount),
    ]),
  };
};

const fetchCustomerSummary = async (
  entityId: string,
  tenantId: string,
): Promise<BloomEntitySummary | null> => {
  const { data, error } = await supabase
    .from("crm_customers")
    .select(
      "id, first_name, last_name, email, total_spent, last_purchase_date, tenant_id, deleted_at",
    )
    .eq("id", entityId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? buildCustomerSummary(data, entityId) : null;
};

const fetchProductSummary = async (
  entityId: string,
  tenantId: string,
): Promise<BloomEntitySummary | null> => {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, price, status, inventory_count, tenant_id")
    .eq("id", entityId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? buildProductSummary(data, entityId) : null;
};

const fetchCampaignSummary = async (
  entityId: string,
  tenantId: string,
): Promise<BloomEntitySummary | null> => {
  const { data, error } = await supabase
    .from("crm_campaigns")
    .select(
      "id, name, subject_line, status, projected_recipient_count, total_recipients, tenant_id",
    )
    .eq("id", entityId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? buildCampaignSummary(data, entityId) : null;
};

const fetchSegmentSummary = async (
  entityId: string,
  tenantId: string,
): Promise<BloomEntitySummary | null> => {
  const { data, error } = await supabase
    .from("crm_segments")
    .select(
      "id, name, source, is_system_segment, status, customer_count, tenant_id, deleted_at",
    )
    .eq("id", entityId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? buildSegmentSummary(data, entityId) : null;
};

const fetchEntitySummary = async (
  entityType: BloomPageEntityType,
  entityId: string,
  tenantId: string,
) => {
  switch (entityType) {
    case "customer":
      return fetchCustomerSummary(entityId, tenantId);
    case "product":
      return fetchProductSummary(entityId, tenantId);
    case "campaign":
      return fetchCampaignSummary(entityId, tenantId);
    case "segment":
      return fetchSegmentSummary(entityId, tenantId);
  }
};

export function useBloomEntitySummary(
  pageContext: BloomPageContext | null | undefined,
  tenantId: string | null | undefined,
) {
  const entityType = pageContext?.entityType ?? null;
  const entityId = pageContext?.entityId ?? null;

  const query = useQuery({
    queryKey: ["bloom-entity-summary", tenantId, entityType, entityId],
    queryFn: () => {
      if (!tenantId || !entityType || !entityId) {
        return Promise.resolve(null);
      }

      return fetchEntitySummary(entityType, entityId, tenantId);
    },
    enabled: Boolean(tenantId && entityType && entityId),
    staleTime: ENTITY_SUMMARY_STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    data: query.data ?? null,
  };
}
