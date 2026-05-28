import type { AskBloomResourceType, ResourceFocus } from "@/types/askBloom";

type UnknownRecord = Record<string, unknown>;

interface CustomerLike extends UnknownRecord {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  tags?: string[] | null;
  created_at?: string | null;
  lifetime_value?: number | null;
  order_count?: number | null;
  avg_order_value?: number | null;
  notes?: string | null;
  email_opt_in?: boolean | null;
  sms_opt_in?: boolean | null;
}

interface CustomerOrderLike extends UnknownRecord {
  created_at?: string | null;
  total?: number | null;
  total_amount?: number | null;
  item_count?: number | null;
  status?: string | null;
}

interface CampaignEngagementLike extends UnknownRecord {
  campaign_name?: string | null;
  action?: string | null;
  created_at?: string | null;
  engaged_at?: string | null;
}

interface SegmentLike extends UnknownRecord {
  name?: string | null;
}

interface ProductLike extends UnknownRecord {
  id: string;
  name?: string | null;
  sku?: string | null;
  price?: number | null;
  compare_at_price?: number | null;
  vendor?: string | null;
  brand?: string | null;
  category?: string | null;
  subcategory?: string | null;
  inventory_count?: number | null;
  track_inventory?: boolean | null;
}

interface ProductVariantLike extends UnknownRecord {
  name?: string | null;
  sku?: string | null;
  price?: number | null;
  inventory_count?: number | null;
}

interface ProductSalesStatsLike extends UnknownRecord {
  units_sold_30d?: number | null;
  unitsSold30d?: number | null;
  units_sold?: number | null;
  unitsSold?: number | null;
  revenue_generated?: number | null;
  revenueGenerated?: number | null;
  revenue_30d?: number | null;
  revenue?: number | null;
}

interface OrderLike extends UnknownRecord {
  id: string;
  order_number?: string | null;
  created_at?: string | null;
  status?: string | null;
  total?: number | null;
  subtotal?: number | null;
  tax?: number | null;
  shipping?: number | null;
  discount?: number | null;
  payment_status?: string | null;
  fulfillment_status?: string | null;
  fulfillment_state?: string | null;
  fulfillment_type?: string | null;
  timeline?: unknown;
  status_history?: unknown;
}

interface OrderCustomerLike extends UnknownRecord {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
}

interface OrderLineItemLike extends UnknownRecord {
  name?: string | null;
  title?: string | null;
  product_name?: string | null;
  quantity?: number | null;
  total?: number | null;
  price?: number | null;
  status?: string | null;
}

interface CampaignLike extends UnknownRecord {
  id: string;
  name?: string | null;
  type?: string | null;
  status?: string | null;
  created_at?: string | null;
  scheduled_at?: string | null;
  subject?: string | null;
  subject_line?: string | null;
  preview_text?: string | null;
  preheader_text?: string | null;
}

interface CampaignPerformanceLike extends UnknownRecord {
  sent_count?: number | null;
  sent?: number | null;
  open_rate?: number | null;
  click_rate?: number | null;
  conversion_rate?: number | null;
  unsubscribe_rate?: number | null;
  attributed_revenue?: number | null;
}

interface CampaignAudienceLike extends UnknownRecord {
  segment_name?: string | null;
  reach?: number | null;
  audience_size?: number | null;
  projected_recipient_count?: number | null;
}

const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const EXAMPLE_DOMAIN_PATTERN = /example\.com/gi;
const GENERIC_SUMMARY_LIMIT = 16;
const SUMMARY_LIST_LIMIT = 5;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asRecordArray = (value: unknown): UnknownRecord[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const readString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const readNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const readBoolean = (value: unknown) =>
  typeof value === "boolean" ? value : null;

const readStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((entry) => readString(entry))
        .filter((entry): entry is string => entry.length > 0)
    : [];

const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const sanitizeText = (value: unknown, allowUuid = false) => {
  const normalized = collapseWhitespace(readString(value)).replace(
    EXAMPLE_DOMAIN_PATTERN,
    "redacted-domain",
  );

  if (!normalized) {
    return "";
  }

  if (allowUuid) {
    return normalized;
  }

  return normalized.replace(UUID_PATTERN, "[redacted-id]").trim();
};

const hasUuid = (value: unknown) =>
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(
    readString(value),
  );

const formatDate = (value: unknown) => {
  const raw = readString(value);
  if (!raw) {
    return "Not available";
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return sanitizeText(raw);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};

const formatMoney = (value: unknown) => {
  const amount = readNumber(value);
  if (amount === null) {
    return "$0";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatPercent = (value: unknown) => {
  const amount = readNumber(value);
  if (amount === null) {
    return "Not available";
  }

  const normalized = amount <= 1 ? amount * 100 : amount;
  return `${normalized.toFixed(1)}%`;
};

const buildFullName = (record: { full_name?: string | null; first_name?: string | null; last_name?: string | null }) => {
  const fullName = sanitizeText(record.full_name);
  if (fullName) {
    return fullName;
  }

  const parts = [sanitizeText(record.first_name), sanitizeText(record.last_name)].filter(
    (value) => value.length > 0,
  );

  return parts.join(" ").trim();
};

const resolveSourceRoute = () => {
  if (typeof window === "undefined") {
    return "/";
  }

  return window.location.pathname || "/";
};

const createResourceFocus = (
  resourceType: AskBloomResourceType,
  resourceId: string,
  resourceLabel: string,
  resourceSummary: string,
): ResourceFocus => ({
  resourceType,
  resourceId,
  resourceLabel: sanitizeText(resourceLabel) || humanizeResourceType(resourceType),
  resourceSummary,
  sourceRoute: resolveSourceRoute(),
  fetchedAt: new Date().toISOString(),
});

const humanizeResourceType = (resourceType: AskBloomResourceType) =>
  resourceType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const finalizeSummary = (lines: Array<string | null | undefined>) =>
  lines
    .filter((line): line is string => Boolean(line && line.trim()))
    .join("\n")
    .replace(EXAMPLE_DOMAIN_PATTERN, "redacted-domain");

const maybeSection = (title: string, lines: string[]) =>
  lines.length > 0 ? [title, ...lines] : [];

const formatRecentOrder = (order: CustomerOrderLike) => {
  const total = readNumber(order.total) ?? readNumber(order.total_amount) ?? 0;
  const itemCount = readNumber(order.item_count) ?? 0;
  const status = sanitizeText(order.status) || "Unknown";
  return `  - ${formatDate(order.created_at)} | ${formatMoney(total)} | ${itemCount} items | ${status}`;
};

const formatCampaignEngagement = (engagement: CampaignEngagementLike) => {
  const campaignName = sanitizeText(engagement.campaign_name) || "Campaign";
  const action = sanitizeText(engagement.action) || "Activity";
  const timestamp = formatDate(engagement.engaged_at ?? engagement.created_at);
  return `  - ${campaignName} | ${action} | ${timestamp}`;
};

const formatVariant = (variant: ProductVariantLike) => {
  const name = sanitizeText(variant.name) || "Unnamed variant";
  const sku = sanitizeText(variant.sku) || "No SKU";
  const price = readNumber(variant.price);
  const inventory = readNumber(variant.inventory_count);
  const details = [
    sku !== "No SKU" ? `SKU ${sku}` : sku,
    price === null ? "inherits base price" : formatMoney(price),
    inventory === null ? "stock not available" : `${inventory} in stock`,
  ];
  return `  - ${name} | ${details.join(" | ")}`;
};

const formatTimelineEntry = (entry: unknown) => {
  if (typeof entry === "string") {
    const text = sanitizeText(entry);
    return text ? `  - ${text}` : null;
  }

  if (!isRecord(entry)) {
    return null;
  }

  const status = sanitizeText(entry.status ?? entry.label ?? entry.event) || "Event";
  const timestamp = formatDate(entry.created_at ?? entry.updated_at ?? entry.timestamp);
  return `  - ${status} | ${timestamp}`;
};

const shouldSkipGenericEntry = (key: string, value: unknown) => {
  const normalizedKey = key.toLowerCase();
  if (
    normalizedKey === "id" ||
    normalizedKey.endsWith("_id") ||
    normalizedKey.includes("uuid")
  ) {
    return true;
  }

  return typeof value === "string" && hasUuid(value);
};

const humanizeKey = (key: string) =>
  key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());

const stringifyGenericValue = (value: unknown): string => {
  if (typeof value === "string") {
    return sanitizeText(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const primitiveValues = value
      .map((entry) => stringifyGenericValue(entry))
      .filter((entry) => entry.length > 0)
      .slice(0, SUMMARY_LIST_LIMIT);

    if (primitiveValues.length > 0) {
      return primitiveValues.join(", ");
    }

    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }

  if (isRecord(value)) {
    const visibleEntries = Object.entries(value)
      .filter(([key, entry]) => !shouldSkipGenericEntry(key, entry))
      .map(([key, entry]) => `${humanizeKey(key)}: ${stringifyGenericValue(entry)}`)
      .filter((entry) => entry.length > 0)
      .slice(0, 4);

    return visibleEntries.join("; ");
  }

  return "";
};

export function buildCustomerFocus(
  customer: CustomerLike,
  recentOrders?: CustomerOrderLike[] | null,
  campaignEngagements?: CampaignEngagementLike[] | null,
  segments?: SegmentLike[] | null,
): ResourceFocus {
  const resourceId = sanitizeText(customer.id, true);
  const resourceLabel =
    buildFullName(customer) || sanitizeText(customer.email) || "Customer";
  const segmentNames = (segments ?? [])
    .map((segment) => sanitizeText(segment.name))
    .filter((name) => name.length > 0);
  const tags = readStringArray(customer.tags);
  const ordersSection = (recentOrders ?? [])
    .slice(0, SUMMARY_LIST_LIMIT)
    .map(formatRecentOrder);
  const campaignSection = (campaignEngagements ?? [])
    .slice(0, SUMMARY_LIST_LIMIT)
    .map(formatCampaignEngagement);
  const fullName = buildFullName(customer) || "Customer";
  const lastOrderDate =
    recentOrders && recentOrders.length > 0
      ? formatDate(recentOrders[0]?.created_at)
      : "Never";

  const summary = finalizeSummary([
    "[RESOURCE FOCUS]",
    "Type: Customer",
    `Name: ${fullName}`,
    `ID: ${resourceId}`,
    `Email: ${sanitizeText(customer.email) || "Not available"}`,
    `Phone: ${sanitizeText(customer.phone) || "Not provided"}`,
    `Status: ${sanitizeText(customer.status) || "Not available"}`,
    `Tags: ${tags.length > 0 ? tags.join(", ") : "None"}`,
    `Segments: ${segmentNames.length > 0 ? segmentNames.join(", ") : "None"}`,
    `Created: ${formatDate(customer.created_at)}`,
    `Lifetime Value: ${formatMoney(customer.lifetime_value)}`,
    `Total Orders: ${readNumber(customer.order_count) ?? 0}`,
    `Average Order Value: ${formatMoney(customer.avg_order_value)}`,
    `Last Order: ${lastOrderDate}`,
    ...maybeSection("Recent Orders (last 5):", ordersSection),
    ...maybeSection("Campaign Engagement (last 5):", campaignSection),
    `Notes: ${sanitizeText(customer.notes) || "None"}`,
    `Communication: Email ${
      readBoolean(customer.email_opt_in) === true ? "Yes" : "No"
    }, SMS ${readBoolean(customer.sms_opt_in) === true ? "Yes" : "No"}`,
    "[END RESOURCE FOCUS]",
  ]);

  return createResourceFocus("customer", resourceId, resourceLabel, summary);
}

export function buildProductFocus(
  product: ProductLike,
  variants?: ProductVariantLike[] | null,
  salesStats?: ProductSalesStatsLike | null,
): ResourceFocus {
  const resourceId = sanitizeText(product.id, true);
  const variantRecords = variants ?? [];
  const variantSummary = variantRecords
    .slice(0, SUMMARY_LIST_LIMIT)
    .map(formatVariant);
  const vendor =
    sanitizeText(product.vendor) || sanitizeText(product.brand) || "Not available";
  const stockLevel =
    readBoolean(product.track_inventory) === false
      ? "Tracking disabled"
      : `${readNumber(product.inventory_count) ?? 0}`;
  const unitsSold =
    readNumber(salesStats?.units_sold_30d) ??
    readNumber(salesStats?.unitsSold30d) ??
    readNumber(salesStats?.units_sold) ??
    readNumber(salesStats?.unitsSold);
  const revenueGenerated =
    readNumber(salesStats?.revenue_generated) ??
    readNumber(salesStats?.revenueGenerated) ??
    readNumber(salesStats?.revenue_30d) ??
    readNumber(salesStats?.revenue);

  const summary = finalizeSummary([
    "[RESOURCE FOCUS]",
    "Type: Product",
    `Name: ${sanitizeText(product.name) || "Product"}`,
    `ID: ${resourceId}`,
    `SKU: ${sanitizeText(product.sku) || "Not available"}`,
    `Price: ${formatMoney(product.price)}`,
    `Compare At Price: ${
      readNumber(product.compare_at_price) === null
        ? "Not available"
        : formatMoney(product.compare_at_price)
    }`,
    `Vendor: ${vendor}`,
    `Category: ${sanitizeText(product.category) || "Not available"}`,
    `Subcategory: ${sanitizeText(product.subcategory) || "Not available"}`,
    `Stock Level: ${stockLevel}`,
    `Variant Count: ${variantRecords.length}`,
    ...maybeSection("Variant Summary:", variantSummary),
    `Units Sold (30d): ${unitsSold ?? "Not available"}`,
    `Revenue Generated: ${
      revenueGenerated === null ? "Not available" : formatMoney(revenueGenerated)
    }`,
    "[END RESOURCE FOCUS]",
  ]);

  return createResourceFocus(
    "product",
    resourceId,
    sanitizeText(product.name) || "Product",
    summary,
  );
}

export function buildOrderFocus(
  order: OrderLike,
  customer?: OrderCustomerLike | null,
  lineItems?: OrderLineItemLike[] | null,
): ResourceFocus {
  const resourceId = sanitizeText(order.id, true);
  const customerName = customer ? buildFullName(customer) : "";
  const fulfillmentStatus =
    sanitizeText(
      order.fulfillment_status ?? order.fulfillment_state ?? order.fulfillment_type,
    ) || "Not available";
  const items = (lineItems ?? []).map((item) => {
    const name =
      sanitizeText(item.name) ||
      sanitizeText(item.title) ||
      sanitizeText(item.product_name) ||
      "Line item";
    const quantity = readNumber(item.quantity) ?? 0;
    const value = readNumber(item.total) ?? readNumber(item.price);
    const status = sanitizeText(item.status);
    const parts = [`qty ${quantity}`];
    if (value !== null) {
      parts.push(formatMoney(value));
    }
    if (status) {
      parts.push(status);
    }
    return `  - ${name} | ${parts.join(" | ")}`;
  });
  const timeline = asRecordArray(order.timeline).length
    ? asRecordArray(order.timeline)
    : Array.isArray(order.status_history)
      ? order.status_history
      : [];
  const timelineLines = timeline
    .map(formatTimelineEntry)
    .filter((line): line is string => Boolean(line));

  const summary = finalizeSummary([
    "[RESOURCE FOCUS]",
    "Type: Order",
    `Order Number: ${sanitizeText(order.order_number) || "Not available"}`,
    `ID: ${resourceId}`,
    `Date: ${formatDate(order.created_at)}`,
    `Status: ${sanitizeText(order.status) || "Not available"}`,
    `Total: ${formatMoney(order.total)}`,
    `Subtotal: ${
      readNumber(order.subtotal) === null ? "Not available" : formatMoney(order.subtotal)
    }`,
    `Tax: ${readNumber(order.tax) === null ? "Not available" : formatMoney(order.tax)}`,
    `Shipping: ${
      readNumber(order.shipping) === null ? "Not available" : formatMoney(order.shipping)
    }`,
    `Discount: ${
      readNumber(order.discount) === null ? "Not available" : formatMoney(order.discount)
    }`,
    `Customer Name: ${customerName || "Not available"}`,
    `Customer Email: ${sanitizeText(customer?.email) || "Not available"}`,
    ...maybeSection("Line Items:", items),
    `Payment Status: ${sanitizeText(order.payment_status) || "Not available"}`,
    `Fulfillment Status: ${fulfillmentStatus}`,
    ...maybeSection("Timeline:", timelineLines),
    "[END RESOURCE FOCUS]",
  ]);

  return createResourceFocus(
    "order",
    resourceId,
    sanitizeText(order.order_number) || "Order",
    summary,
  );
}

export function buildCampaignFocus(
  campaign: CampaignLike,
  performance?: CampaignPerformanceLike | null,
  audience?: CampaignAudienceLike | null,
): ResourceFocus {
  const resourceId = sanitizeText(campaign.id, true);
  const audienceSegment = sanitizeText(audience?.segment_name) || "Not available";
  const reach =
    readNumber(audience?.reach) ??
    readNumber(audience?.audience_size) ??
    readNumber(audience?.projected_recipient_count);

  const summary = finalizeSummary([
    "[RESOURCE FOCUS]",
    "Type: Campaign",
    `Name: ${sanitizeText(campaign.name) || "Campaign"}`,
    `ID: ${resourceId}`,
    `Type: ${sanitizeText(campaign.type) || "Not available"}`,
    `Status: ${sanitizeText(campaign.status) || "Not available"}`,
    `Created Date: ${formatDate(campaign.created_at)}`,
    `Scheduled Date: ${formatDate(campaign.scheduled_at)}`,
    `Audience Segment: ${audienceSegment}`,
    `Audience Reach: ${reach ?? "Not available"}`,
    `Subject Line: ${
      sanitizeText(campaign.subject ?? campaign.subject_line) || "Not available"
    }`,
    `Preview Text: ${
      sanitizeText(campaign.preview_text ?? campaign.preheader_text) ||
      "Not available"
    }`,
    `Sent Count: ${
      readNumber(performance?.sent_count ?? performance?.sent) ?? "Not available"
    }`,
    `Open Rate: ${formatPercent(performance?.open_rate)}`,
    `Click Rate: ${formatPercent(performance?.click_rate)}`,
    `Conversion Rate: ${formatPercent(performance?.conversion_rate)}`,
    `Unsubscribe Rate: ${formatPercent(performance?.unsubscribe_rate)}`,
    `Attributed Revenue: ${formatMoney(performance?.attributed_revenue)}`,
    "[END RESOURCE FOCUS]",
  ]);

  return createResourceFocus(
    "campaign",
    resourceId,
    sanitizeText(campaign.name) || "Campaign",
    summary,
  );
}

export function buildGenericFocus(
  resourceType: AskBloomResourceType,
  resourceId: string,
  label: string,
  data: unknown,
): ResourceFocus {
  const genericData = isRecord(data) ? data : {};
  const details = Object.entries(genericData)
    .filter(([key, value]) => !shouldSkipGenericEntry(key, value))
    .map(([key, value]) => {
      const renderedValue = stringifyGenericValue(value);
      if (!renderedValue) {
        return null;
      }
      return `${humanizeKey(key)}: ${renderedValue}`;
    })
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, GENERIC_SUMMARY_LIMIT);

  const summary = finalizeSummary([
    "[RESOURCE FOCUS]",
    `Type: ${humanizeResourceType(resourceType)}`,
    `Name: ${sanitizeText(label) || humanizeResourceType(resourceType)}`,
    `ID: ${sanitizeText(resourceId, true)}`,
    ...maybeSection("Details:", details),
    "[END RESOURCE FOCUS]",
  ]);

  return createResourceFocus(
    resourceType,
    sanitizeText(resourceId, true),
    sanitizeText(label) || humanizeResourceType(resourceType),
    summary,
  );
}
