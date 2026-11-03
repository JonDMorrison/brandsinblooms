import type {
  EntitySummary,
  PageEntityType,
  PersistenceClient,
} from "./types.ts";
import { readCustomerPurchaseEvidence } from "../_shared/customer-intelligence/customer-purchase-evidence.ts";

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

// Never assume a currency. Without a known ISO code, show the plain amount.
function formatCurrency(
  value: number | null,
  currency: string | null = null,
): string | null {
  if (value === null) {
    return null;
  }

  const code = currency?.toUpperCase() ?? null;
  return new Intl.NumberFormat(
    "en-US",
    code && /^[A-Z]{3}$/.test(code)
      ? { style: "currency", currency: code, maximumFractionDigits: 0 }
      : { maximumFractionDigits: 0 },
  ).format(value);
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
  const purchases = readCustomerPurchaseEvidence(record);
  const totalSpent = purchases.total_spent === null
    ? null
    : new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(purchases.total_spent);
  const reported = purchases.reported_period_spending;
  const reportSummary = reported
    ? `${new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(reported.spend)} CAD reported spending from ${reported.start} to ${reported.end}; ${reported.transactions} reported transactions. These are source-period totals, not lifetime value or dated orders.`
    : null;
  const lastPurchaseDate = formatShortDate(
    readString(record.last_purchase_date),
  );

  return {
    entityType: "customer",
    entityId,
    name: buildCustomerName(record, entityId),
    summaryText: joinSummaryParts([
      email ? email : null,
      totalSpent !== null ? `${totalSpent} recorded spending` : "Recorded spending unknown",
      reportSummary,
      lastPurchaseDate ? `last purchase ${lastPurchaseDate}` : null,
    ]),
  };
}

function buildProductSummary(
  record: EntityRecord,
  entityId: string,
): EntitySummary {
  const price = formatCurrency(
    readFiniteNumber(record.price),
    readString(record.currency),
  );
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
      subjectLine ? `subject "${subjectLine}"` : null,
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

/** Customer fields a group rule can depend on that imported period reports never fill. */
const PURCHASE_DATA_FIELDS: Record<string, string> = {
  first_purchase_date: "purchase dates",
  last_purchase_date: "purchase dates",
  total_spent: "lifetime spending totals",
  pos_order_count: "order counts",
};

/** Purchase data this group's rules need that no live customer in the company has. */
export function missingRuleData(conditions: unknown, available: ReadonlySet<string>): string[] {
  const rules = isRecord(conditions) && Array.isArray(conditions.rules) ? conditions.rules : [];
  const missing: string[] = [];
  for (const rule of rules) {
    const field = isRecord(rule) ? readString(rule.field) : null;
    const label = field ? PURCHASE_DATA_FIELDS[field] : undefined;
    if (field && label && !available.has(field) && !missing.includes(label)) missing.push(label);
  }
  return missing;
}

export function buildSegmentSummary(
  record: EntityRecord,
  entityId: string,
  missingData: string[] = [],
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
      missingData.length
        ? `empty because no customer in this company has ${missingData.join(" or ")} on file yet (the imported sales reports do not include them). Say that plainly; do not say no customers meet the criteria`
        : null,
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
      "id, first_name, last_name, email, total_spent, first_purchase_date, last_purchase_date, pos_order_count, custom_fields, tenant_id, deleted_at",
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
    .select("id, name, price, currency, status, inventory_count, tenant_id")
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
      "id, name, source, is_system_segment, status, customer_count, conditions, tenant_id, deleted_at",
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

  if (!isRecord(data)) return null;
  // An empty group may only be empty because the data its rule reads was never imported.
  let missing: string[] = [];
  if (readFiniteNumber(data.customer_count) === 0) {
    const rules = isRecord(data.conditions) && Array.isArray(data.conditions.rules) ? data.conditions.rules : [];
    const needed = [...new Set(rules.flatMap((rule) => {
      const field = isRecord(rule) ? readString(rule.field) : null;
      return field && PURCHASE_DATA_FIELDS[field] ? [field] : [];
    }))];
    const available = new Set<string>();
    for (const field of needed) {
      const { data: sample, error: sampleError } = await serviceClient
        .from("crm_customers")
        .select("id")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .not(field, "is", null)
        .limit(1);
      // On a failed check, claim nothing.
      if (sampleError || (Array.isArray(sample) && sample.length > 0)) available.add(field);
    }
    missing = missingRuleData(data.conditions, available);
  }
  return buildSegmentSummary(data, entityId, missing);
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
