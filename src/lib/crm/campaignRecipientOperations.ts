import { formatInTimeZone } from "date-fns-tz";
import type { DerivedMetrics } from "@/hooks/analytics/useCampaignDerivedMetrics";

export type RecipientEventSelection =
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained";

export type RecipientCompositeFilter =
  | "all"
  | "engaged"
  | "unengaged"
  | "issues";

export type RecipientTimeRange = "all" | "1h" | "24h" | "7d";

export type RecipientDeliveryFilter =
  | "all"
  | "delivered"
  | "bounced"
  | "pending"
  | "failed";

export type RecipientSortColumn =
  | "customer_name"
  | "email"
  | "latest_event"
  | "event_time";

export type RecipientSortDirection = "asc" | "desc";

export interface RecipientFilterState {
  searchQuery: string;
  compositeFilter: RecipientCompositeFilter;
  selectedEvents: RecipientEventSelection[];
  timeRange: RecipientTimeRange;
  deliveryFilter: RecipientDeliveryFilter;
}

export interface RecipientFilterChip {
  key: string;
  label: string;
}

export interface CampaignRecipientExportRow {
  recipient_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string;
  latest_event: string;
  latest_event_at: string | null;
  delivery_status: string;
  all_events?: string[] | null;
}

const COMPOSITE_FILTERS = new Set<RecipientCompositeFilter>([
  "all",
  "engaged",
  "unengaged",
  "issues",
]);

const EVENT_ORDER: RecipientEventSelection[] = [
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
];

const EVENT_LABELS: Record<RecipientEventSelection, string> = {
  delivered: "Delivered",
  opened: "Opened",
  clicked: "Clicked",
  bounced: "Bounced",
  complained: "Complained",
};

const TIME_LABELS: Record<RecipientTimeRange, string> = {
  all: "All time",
  "1h": "Last hour",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
};

const DELIVERY_LABELS: Record<RecipientDeliveryFilter, string> = {
  all: "All",
  delivered: "Delivered",
  bounced: "Bounced",
  pending: "Pending",
  failed: "Failed",
};

const COMPOSITE_LABELS: Record<Exclude<RecipientCompositeFilter, "all">, string> = {
  engaged: "Engaged",
  unengaged: "Unengaged",
  issues: "Issues",
};

function sanitizeSearchValue(value: string | null | undefined) {
  return (value || "").trim();
}

export function parseEventQueryValue(value: string | null | undefined) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized || normalized === "all") {
    return {
      compositeFilter: "all" as RecipientCompositeFilter,
      selectedEvents: [] as RecipientEventSelection[],
    };
  }

  if (COMPOSITE_FILTERS.has(normalized as RecipientCompositeFilter)) {
    return {
      compositeFilter: normalized as RecipientCompositeFilter,
      selectedEvents: [] as RecipientEventSelection[],
    };
  }

  const selectedEvents = normalized
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is RecipientEventSelection =>
      EVENT_ORDER.includes(part as RecipientEventSelection),
    );

  return {
    compositeFilter: "all" as RecipientCompositeFilter,
    selectedEvents: EVENT_ORDER.filter((event) => selectedEvents.includes(event)),
  };
}

export function serializeEventQueryValue(
  compositeFilter: RecipientCompositeFilter,
  selectedEvents: RecipientEventSelection[],
) {
  if (compositeFilter !== "all") {
    return compositeFilter;
  }

  if (selectedEvents.length === 0) {
    return null;
  }

  return EVENT_ORDER.filter((event) => selectedEvents.includes(event)).join(",");
}

export function parseTimeRange(value: string | null | undefined): RecipientTimeRange {
  const normalized = (value || "all").trim().toLowerCase();
  if (normalized === "1h" || normalized === "24h" || normalized === "7d") {
    return normalized;
  }
  return "all";
}

export function parseDeliveryFilter(
  value: string | null | undefined,
): RecipientDeliveryFilter {
  const normalized = (value || "all").trim().toLowerCase();
  if (
    normalized === "delivered" ||
    normalized === "bounced" ||
    normalized === "pending" ||
    normalized === "failed"
  ) {
    return normalized;
  }
  return "all";
}

export function buildRecipientFilterState(params: URLSearchParams): RecipientFilterState {
  const { compositeFilter, selectedEvents } = parseEventQueryValue(
    params.get("event") || params.get("filter"),
  );

  return {
    searchQuery: sanitizeSearchValue(params.get("q") || params.get("search")),
    compositeFilter,
    selectedEvents,
    timeRange: parseTimeRange(params.get("time")),
    deliveryFilter: parseDeliveryFilter(params.get("delivery")),
  };
}

export function hasActiveRecipientFilters(filters: RecipientFilterState) {
  return Boolean(
    filters.searchQuery ||
      filters.compositeFilter !== "all" ||
      filters.selectedEvents.length > 0 ||
      filters.timeRange !== "all" ||
      filters.deliveryFilter !== "all",
  );
}

export function buildRecipientFilterChips(
  filters: RecipientFilterState,
): RecipientFilterChip[] {
  const chips: RecipientFilterChip[] = [];

  if (filters.searchQuery) {
    chips.push({ key: "q", label: `Search: ${filters.searchQuery}` });
  }

  if (filters.compositeFilter !== "all") {
    chips.push({
      key: "event",
      label: `Event: ${COMPOSITE_LABELS[filters.compositeFilter as Exclude<RecipientCompositeFilter, "all">]}`,
    });
  } else if (filters.selectedEvents.length > 0) {
    chips.push({
      key: "event",
      label: `Event: ${filters.selectedEvents.map((event) => EVENT_LABELS[event]).join(", ")}`,
    });
  }

  if (filters.timeRange !== "all") {
    chips.push({ key: "time", label: `Time: ${TIME_LABELS[filters.timeRange]}` });
  }

  if (filters.deliveryFilter !== "all") {
    chips.push({
      key: "delivery",
      label: `Delivery: ${DELIVERY_LABELS[filters.deliveryFilter]}`,
    });
  }

  return chips;
}

export function buildRecipientSelectionScope(filters: RecipientFilterState) {
  return JSON.stringify({
    q: filters.searchQuery,
    event: serializeEventQueryValue(filters.compositeFilter, filters.selectedEvents),
    time: filters.timeRange,
    delivery: filters.deliveryFilter,
  });
}

export function toCsvValue(value: unknown) {
  const stringValue = value == null ? "" : String(value);
  if (
    stringValue.includes(",") ||
    stringValue.includes("\n") ||
    stringValue.includes('"')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function formatRecipientEventLabel(event: string | null | undefined) {
  switch ((event || "").toLowerCase()) {
    case "opened":
      return "Opened";
    case "clicked":
      return "Clicked";
    case "delivered":
      return "Delivered";
    case "bounced":
      return "Bounced";
    case "complained":
      return "Complained";
    case "unsubscribed":
      return "Unsubscribed";
    case "failed":
      return "Failed";
    case "sending":
      return "Sending";
    case "queued":
      return "Queued";
    case "sent":
      return "Sent";
    default:
      return event || "Unknown";
  }
}

export function formatRecipientDeliveryLabel(status: string | null | undefined) {
  switch ((status || "").toLowerCase()) {
    case "delivered":
      return "Delivered";
    case "bounced":
      return "Bounced";
    case "failed":
      return "Failed";
    case "pending":
      return "Pending";
    case "delayed":
      return "Pending";
    default:
      return status || "Unknown";
  }
}

export function formatExportTimestamp(
  timestamp: string | null | undefined,
  timezone?: string | null,
) {
  if (!timestamp) return "";
  const zone = timezone || "UTC";
  return formatInTimeZone(
    new Date(timestamp),
    zone,
    timezone ? "yyyy-MM-dd HH:mm:ss zzz" : "yyyy-MM-dd HH:mm:ss 'UTC'",
  );
}

export function sanitizeFileNamePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function buildRecipientCsv(
  rows: CampaignRecipientExportRow[],
  timezone?: string | null,
) {
  const headers = [
    "Customer Name",
    "Email Address",
    "Latest Event",
    "Event Timestamp",
    "Delivery Status",
    "All Events",
  ];

  const dataRows = rows.map((row) => [
    row.customer_name || "",
    row.customer_email,
    formatRecipientEventLabel(row.latest_event),
    formatExportTimestamp(row.latest_event_at, timezone),
    formatRecipientDeliveryLabel(row.delivery_status),
    (row.all_events || []).map((event) => formatRecipientEventLabel(event)).join(", "),
  ]);

  return [
    headers.map(toCsvValue).join(","),
    ...dataRows.map((row) => row.map(toCsvValue).join(",")),
  ].join("\n");
}

export function downloadTextFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatDateStamp(date = new Date()) {
  return date.toISOString().split("T")[0];
}

export function buildAbsoluteLocationPath(path: string) {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

export function formatCampaignHealthSummary(
  metrics: DerivedMetrics,
  recipientCount: number,
) {
  if (recipientCount === 0 || metrics.totals.sent === 0) {
    return "No delivery activity has been recorded for this campaign yet.";
  }

  const delivered = metrics.totals.delivered.toLocaleString();
  const opens = metrics.totals.opens.toLocaleString();
  const clicks = metrics.totals.clicks.toLocaleString();
  const issues = (
    metrics.totals.hard_bounces + metrics.totals.complaints
  ).toLocaleString();

  return `${delivered} of ${recipientCount.toLocaleString()} recipients reached inboxes, ${opens} opened, ${clicks} clicked, and ${issues} delivery issues were recorded.`;
}