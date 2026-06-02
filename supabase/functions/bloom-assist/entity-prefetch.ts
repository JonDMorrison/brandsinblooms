import type {
  EntitySummary,
  PageEntityType,
  PersistenceClient,
} from "./types.ts";

type EntityRecord = Record<string, unknown>;

function isRecord(value: unknown): value is EntityRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatCurrency(value: number | null): string | null {
  if (value === null) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatInteger(value: number | null): string | null {
  if (value === null) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatShortDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function joinSummaryParts(parts: Array<string | null>): string {
  const detailText = parts
    .filter((part): part is string => Boolean(part))
    .join(", ");
  return detailText || "No additional details available.";
}

function fallbackName(prefix: string, entityId: string): string {
  return `${prefix} ${entityId.slice(0, 8)}`;
}

function buildCustomerName(record: EntityRecord, entityId: string): string {
  const firstName = readString(record.first_name);
  const lastName = readString(record.last_name);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return (
    fullName || readString(record.email) || fallbackName("Customer", entityId)
  );
}

function buildCustomerSummary(
  record: EntityRecord,
  entityId: string,
): EntitySummary {
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
      email ? email : null,
      totalSpent ? `${totalSpent} total spent` : null,
      lastPurchaseDate ? `last purchase ${lastPurchaseDate}` : null,
    ]),
  };
}

function buildProductSummary(
  record: EntityRecord,
  entityId: string,
): EntitySummary {
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
  };
}

function buildCampaignSummary(
  record: EntityRecord,
  entityId: string,
): EntitySummary {
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
  };
}

function humanizeSegmentType(record: EntityRecord): string {
  if (record.is_system_segment === true) {
    return "system";
  }

  const source = readString(record.source);
  if (!source) {
    return "custom";
  }

  return source.replace(/[_-]+/g, " ");
}

function buildSegmentSummary(
  record: EntityRecord,
  entityId: string,
): EntitySummary {
  const status = readString(record.status);
  const memberCount = formatInteger(readFiniteNumber(record.customer_count));

  return {
    entityType: "segment",
    entityId,
    name: readString(record.name) || fallbackName("Segment", entityId),
    summaryText: joinSummaryParts([
      `${humanizeSegmentType(record)} segment`,
      status ? `status ${status}` : null,
      memberCount ? `${memberCount} members` : null,
    ]),
  };
}

async function fetchCustomerSummary(
  serviceClient: PersistenceClient,
  entityId: string,
  tenantId: string,
): Promise<EntitySummary | null> {
  const { data, error } = await serviceClient
    .from("crm_customers")
    .select(
      "id, first_name, last_name, email, total_spent, last_purchase_date, tenant_id, deleted_at",
    )
    .eq("id", entityId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error(
      "[bloom-assist] Failed to prefetch customer summary",
      error.message,
    );
    return null;
  }

  return isRecord(data) ? buildCustomerSummary(data, entityId) : null;
}

async function fetchProductSummary(
  serviceClient: PersistenceClient,
  entityId: string,
  tenantId: string,
): Promise<EntitySummary | null> {
  const { data, error } = await serviceClient
    .from("products")
    .select("id, name, price, status, inventory_count, tenant_id")
    .eq("id", entityId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    console.error(
      "[bloom-assist] Failed to prefetch product summary",
      error.message,
    );
    return null;
  }

  return isRecord(data) ? buildProductSummary(data, entityId) : null;
}

async function fetchCampaignSummary(
  serviceClient: PersistenceClient,
  entityId: string,
  tenantId: string,
): Promise<EntitySummary | null> {
  const { data, error } = await serviceClient
    .from("crm_campaigns")
    .select(
      "id, name, subject_line, status, projected_recipient_count, total_recipients, tenant_id",
    )
    .eq("id", entityId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    console.error(
      "[bloom-assist] Failed to prefetch campaign summary",
      error.message,
    );
    return null;
  }

  return isRecord(data) ? buildCampaignSummary(data, entityId) : null;
}

async function fetchSegmentSummary(
  serviceClient: PersistenceClient,
  entityId: string,
  tenantId: string,
): Promise<EntitySummary | null> {
  const { data, error } = await serviceClient
    .from("crm_segments")
    .select(
      "id, name, source, is_system_segment, status, customer_count, tenant_id, deleted_at",
    )
    .eq("id", entityId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error(
      "[bloom-assist] Failed to prefetch segment summary",
      error.message,
    );
    return null;
  }

  return isRecord(data) ? buildSegmentSummary(data, entityId) : null;
}

export async function prefetchEntitySummary(
  serviceClient: PersistenceClient,
  entityType: PageEntityType,
  entityId: string,
  tenantId: string,
): Promise<EntitySummary | null> {
  switch (entityType) {
    case "customer":
      return fetchCustomerSummary(serviceClient, entityId, tenantId);
    case "product":
      return fetchProductSummary(serviceClient, entityId, tenantId);
    case "campaign":
      return fetchCampaignSummary(serviceClient, entityId, tenantId);
    case "segment":
      return fetchSegmentSummary(serviceClient, entityId, tenantId);
  }
}
