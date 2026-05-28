import { differenceInDays, format, formatDistanceToNow } from "date-fns";
import type {
  BloomBlockAction,
  BloomBlockActionType,
  BloomBlockItem,
  DataCardEntityType,
  DataColumnType,
  DataTableColumn,
} from "@/components/bloom/blocks/blockTypes";

type JoyTone = "primary" | "neutral" | "success" | "warning" | "danger";

const CARD_ENTITY_TYPES = new Set<DataCardEntityType>([
  "customer",
  "product",
  "campaign",
  "segment",
]);

const STATUS_TONES: Record<string, JoyTone> = {
  active: "success",
  archived: "neutral",
  draft: "warning",
  dynamic: "primary",
  failed: "danger",
  paused: "warning",
  scheduled: "primary",
  sending: "primary",
  sent: "primary",
  static: "neutral",
};

const BLOCK_ARRAY_KEYS = ["blocks", "block_data", "content_blocks", "parts"];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const numeric = Number(value.replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

export function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function getRecordValue(
  record: Record<string, unknown>,
  key: string,
): unknown {
  if (key.includes(".")) {
    let current: unknown = record;
    for (const part of key.split(".")) {
      if (!isRecord(current)) {
        return undefined;
      }
      current = current[part];
    }
    return current;
  }

  if (key === "name") {
    return customerName(record) ?? record.name;
  }

  if (key === "customer") {
    return (
      record.customer_name ??
      customerName(record) ??
      record.customer_email ??
      record.email
    );
  }

  if (key === "segments") {
    return record.segment_names ?? record.segments;
  }

  if (key === "members") {
    return record.member_count ?? record.customer_count ?? record.members;
  }

  if (key === "last_order") {
    return (
      nestedRecordValue(record, "purchase_metrics", "last_purchase_date") ??
      record.last_order_date ??
      record.last_purchase_date
    );
  }

  if (key === "total") {
    return record.total ?? record.total_amount ?? record.total_price;
  }

  if (key === "date") {
    return record.order_date ?? record.sent_at ?? record.created_at;
  }

  if (
    key === "open_rate" ||
    key === "click_rate" ||
    key === "delivered_count"
  ) {
    return (
      record[key] ??
      nestedRecordValue(record, "metrics_summary", key) ??
      nestedRecordValue(record, "metrics", key)
    );
  }

  if (key === "total_spent") {
    return (
      record.total_spent ??
      nestedRecordValue(record, "purchase_metrics", "total_spent")
    );
  }

  return record[key];
}

function nestedRecordValue(
  record: Record<string, unknown>,
  parentKey: string,
  childKey: string,
): unknown {
  const parent = record[parentKey];
  return isRecord(parent) ? parent[childKey] : undefined;
}

export function statusTone(value: unknown): JoyTone {
  const normalized = readString(value)
    ?.toLowerCase()
    .replace(/[_\s]+/g, "-");
  return normalized ? (STATUS_TONES[normalized] ?? "neutral") : "neutral";
}

export function formatLabel(
  value: unknown,
  fallback = "Not available",
): string {
  const text = readString(value);
  if (!text) {
    return fallback;
  }

  return text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatCurrencyValue(
  value: unknown,
  currencyValue?: unknown,
): string {
  const amount = readNumber(value);
  if (amount === null) {
    return readString(value) ?? "$0.00";
  }

  const currency = readString(currencyValue) ?? "USD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumberValue(value: unknown): string {
  const numeric = readNumber(value);
  return numeric === null
    ? "0"
    : new Intl.NumberFormat("en-US").format(numeric);
}

export function formatPercentValue(value: unknown): string {
  const numeric = readNumber(value);
  if (numeric === null) {
    return "0%";
  }

  const percent = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Number.isInteger(percent) ? 0 : 1,
  }).format(percent)}%`;
}

export function formatDateValue(value: unknown): string {
  const text = readString(value);
  if (!text) {
    return "Not available";
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text;
  }

  return Math.abs(differenceInDays(new Date(), date)) < 7
    ? formatDistanceToNow(date, { addSuffix: true })
    : format(date, "MMM d, yyyy");
}

export function customerName(record: Record<string, unknown>): string | null {
  const explicitName =
    readString(record.name) ?? readString(record.customer_name);
  if (explicitName) {
    return explicitName;
  }

  const name = [readString(record.first_name), readString(record.last_name)]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .trim();

  return name || readString(record.email) || readString(record.customer_email);
}

export function entityDisplayName(
  entityType: string,
  entity: Record<string, unknown>,
): string {
  if (entityType === "customer") {
    return customerName(entity) ?? "this customer";
  }

  return (
    readString(entity.name) ??
    readString(entity.title) ??
    readString(entity.subject_line) ??
    readString(entity.email) ??
    `this ${entityType}`
  );
}

export function initialsForName(value: string): string {
  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "BS";
}

export function neutralAvatarBackground(value: string): string {
  const total = Array.from(value).reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );
  const options = ["neutral.100", "neutral.200", "neutral.300"];
  return options[total % options.length];
}

export function stringListFromValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (typeof entry === "string") {
        return entry.trim() ? [entry.trim()] : [];
      }

      if (!isRecord(entry)) {
        return [];
      }

      return (
        readString(entry.name) ??
        readString(entry.persona_name) ??
        readString(entry.label) ??
        []
      );
    });
  }

  const text = readString(value);
  if (!text) {
    return [];
  }

  return text
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function extractStringList(
  record: Record<string, unknown>,
  keys: string[],
): string[] {
  const values = keys.flatMap((key) =>
    stringListFromValue(getRecordValue(record, key)),
  );
  return Array.from(new Set(values));
}

export function primaryProductImageUrl(
  entity: Record<string, unknown>,
): string | null {
  const direct =
    readString(entity.image_url) ??
    readString(entity.thumbnail_url) ??
    readString(entity.image);
  if (direct) {
    return direct;
  }

  const images = entity.images;
  if (!Array.isArray(images)) {
    return null;
  }

  const records = images.filter(isRecord);
  const primary = records.find((image) => readBoolean(image.is_primary));
  const selected = primary ?? records[0];
  return selected
    ? (readString(selected.thumbnail_url) ?? readString(selected.image_url))
    : null;
}

export function inferEntityType(
  explicitValue: unknown,
  sample: Record<string, unknown> | null,
): string {
  const explicit = readString(explicitValue)?.toLowerCase();
  if (explicit) {
    return explicit;
  }

  if (!sample) {
    return "record";
  }

  if (
    sample.sku !== undefined ||
    sample.price !== undefined ||
    sample.inventory_count !== undefined
  ) {
    return "product";
  }

  if (
    sample.subject_line !== undefined ||
    sample.metrics_summary !== undefined ||
    sample.delivery_method !== undefined
  ) {
    return "campaign";
  }

  if (
    sample.customer_count !== undefined ||
    sample.rules_summary !== undefined ||
    sample.auto_update !== undefined
  ) {
    return "segment";
  }

  if (
    sample.order_date !== undefined ||
    sample.total_amount !== undefined ||
    sample.financial_status !== undefined
  ) {
    return "order";
  }

  if (
    sample.email !== undefined ||
    sample.first_name !== undefined ||
    sample.purchase_metrics !== undefined
  ) {
    return "customer";
  }

  return "record";
}

export function readEntityIdFromRecord(
  record: Record<string, unknown>,
): string | null {
  return (
    readString(record.id) ??
    readString(record.customer_id) ??
    readString(record.product_id) ??
    readString(record.campaign_id) ??
    readString(record.segment_id) ??
    readString(record.external_id)
  );
}

export function routeForEntityId(
  entityType: string,
  entityId: string | null,
): string | null {
  if (!entityId) {
    return null;
  }

  switch (entityType) {
    case "customer":
      return `/crm/customers/${entityId}`;
    case "product":
      return `/products/${entityId}`;
    case "campaign":
      return `/crm/campaigns/${entityId}`;
    case "segment":
      return `/crm/segments/${entityId}`;
    default:
      return null;
  }
}

export function isDataCardEntityType(
  value: string,
): value is DataCardEntityType {
  return CARD_ENTITY_TYPES.has(value as DataCardEntityType);
}

export function defaultColumnsForEntity(
  entityType: string,
  rows: Record<string, unknown>[],
): DataTableColumn[] {
  switch (entityType) {
    case "customer":
      return [
        { key: "name", label: "Name", sortable: true, type: "text" },
        { key: "email", label: "Email", sortable: true, type: "text" },
        {
          key: "total_spent",
          label: "Total Spent",
          sortable: true,
          type: "currency",
        },
        {
          key: "last_order",
          label: "Last Order",
          sortable: true,
          type: "date",
        },
        { key: "segments", label: "Segments", type: "text" },
      ];
    case "product":
      return [
        { key: "name", label: "Name", sortable: true, type: "text" },
        { key: "sku", label: "SKU", sortable: true, type: "text" },
        { key: "price", label: "Price", sortable: true, type: "currency" },
        { key: "status", label: "Status", sortable: true, type: "status" },
        {
          key: "inventory_count",
          label: "Inventory",
          sortable: true,
          type: "number",
        },
      ];
    case "campaign":
      return [
        { key: "name", label: "Name", sortable: true, type: "text" },
        { key: "subject_line", label: "Subject", sortable: true, type: "text" },
        { key: "status", label: "Status", sortable: true, type: "status" },
        { key: "sent_at", label: "Sent Date", sortable: true, type: "date" },
        {
          key: "open_rate",
          label: "Open Rate",
          sortable: true,
          type: "percentage",
        },
      ];
    case "segment":
      return [
        { key: "name", label: "Name", sortable: true, type: "text" },
        { key: "type", label: "Type", sortable: true, type: "status" },
        { key: "members", label: "Members", sortable: true, type: "number" },
        { key: "status", label: "Status", sortable: true, type: "status" },
      ];
    case "order":
      return [
        { key: "source", label: "Source", sortable: true, type: "status" },
        { key: "customer", label: "Customer", sortable: true, type: "text" },
        { key: "total", label: "Total", sortable: true, type: "currency" },
        { key: "status", label: "Status", sortable: true, type: "status" },
        { key: "date", label: "Date", sortable: true, type: "date" },
      ];
    default:
      return Object.keys(rows[0] ?? {})
        .filter((key) => !key.endsWith("_id") || key === "id")
        .slice(0, 5)
        .map((key) => ({
          key,
          label: formatLabel(key),
          sortable: true,
          type: inferColumnType(key),
        }));
  }
}

export function inferColumnType(key: string): DataColumnType {
  const normalized = key.toLowerCase();
  if (normalized.includes("date") || normalized.endsWith("_at")) {
    return "date";
  }
  if (
    normalized.includes("price") ||
    normalized.includes("spent") ||
    normalized.includes("total")
  ) {
    return "currency";
  }
  if (normalized.includes("rate") || normalized.includes("percent")) {
    return "percentage";
  }
  if (
    normalized.includes("status") ||
    normalized === "type" ||
    normalized === "source"
  ) {
    return "status";
  }
  if (normalized.includes("count") || normalized.includes("members")) {
    return "number";
  }
  return "text";
}

export function normalizeColumns(value: unknown): DataTableColumn[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const key = readString(entry.key);
    const label = readString(entry.label) ?? (key ? formatLabel(key) : null);
    if (!key || !label) {
      return [];
    }

    const rawType = readString(entry.type);
    const type =
      rawType === "currency" ||
      rawType === "date" ||
      rawType === "status" ||
      rawType === "number" ||
      rawType === "percentage" ||
      rawType === "text"
        ? rawType
        : inferColumnType(key);

    return [
      {
        key,
        label,
        sortable: readBoolean(entry.sortable) ?? true,
        type,
      },
    ];
  });
}

export function normalizeActions(
  value: unknown,
  entityType: string,
  entity: Record<string, unknown>,
): BloomBlockAction[] {
  if (Array.isArray(value)) {
    const actions = value.flatMap((entry) => {
      if (!isRecord(entry)) {
        return [];
      }

      const label = readString(entry.label);
      const prompt = readString(entry.prompt) ?? label;
      const url =
        readString(entry.url) ??
        readString(entry.href) ??
        readString(entry.target_path) ??
        readString(entry.targetPath) ??
        readString(entry.path);
      const rawType = readString(entry.type)?.toLowerCase();
      const type: BloomBlockActionType =
        rawType === "download" ||
        rawType === "link" ||
        rawType === "navigate" ||
        rawType === "prompt"
          ? rawType
          : url
            ? "link"
            : "prompt";
      if (!label || !prompt) {
        return [];
      }

      return [
        {
          label,
          prompt,
          type,
          url: url ?? undefined,
          downloadFileName:
            readString(entry.file_name) ??
            readString(entry.fileName) ??
            undefined,
          icon: readString(entry.icon) ?? undefined,
        },
      ];
    });

    if (actions.length > 0) {
      return actions;
    }
  }

  return defaultActionsForEntity(entityType, entity);
}

function defaultActionsForEntity(
  entityType: string,
  entity: Record<string, unknown>,
): BloomBlockAction[] {
  const name = entityDisplayName(entityType, entity);
  const id = readString(entity.id);
  const idContext = id ? ` (${id})` : "";

  switch (entityType) {
    case "customer":
      return [
        {
          label: "View in CRM",
          prompt: `Open ${name}${idContext} in CRM`,
          type: "prompt",
          icon: "eye",
        },
        {
          label: "View Orders",
          prompt: `View orders for ${name}`,
          type: "prompt",
          icon: "orders",
        },
        {
          label: "Create Campaign",
          prompt: `Create a campaign for ${name}`,
          type: "prompt",
          icon: "campaign",
        },
        {
          label: "Tag",
          prompt: `Tag ${name}`,
          type: "prompt",
          icon: "tag",
        },
      ];
    case "product":
      return [
        {
          label: "View in CRM",
          prompt: `Open ${name}${idContext} in CRM`,
          type: "prompt",
          icon: "eye",
        },
        {
          label: "Update Price",
          prompt: `Update the price for ${name}`,
          type: "prompt",
          icon: "pencil",
        },
        {
          label: "Generate Description",
          prompt: `Generate a product description for ${name}`,
          type: "prompt",
          icon: "sparkles",
        },
      ];
    case "campaign":
      return [
        {
          label: "View Report",
          prompt: `View the report for ${name}`,
          type: "prompt",
          icon: "report",
        },
        {
          label: "Clone",
          prompt: `Clone ${name}`,
          type: "prompt",
          icon: "clone",
        },
        {
          label: "Pause/Resume",
          prompt: `Pause or resume ${name}`,
          type: "prompt",
          icon: "pause",
        },
      ];
    case "segment":
      return [
        {
          label: "View Members",
          prompt: `View members in ${name}`,
          type: "prompt",
          icon: "users",
        },
        {
          label: "Use in Campaign",
          prompt: `Use ${name} in a campaign`,
          type: "prompt",
          icon: "campaign",
        },
      ];
    default:
      return [];
  }
}

export function normalizeBloomBlockItems(value: unknown): BloomBlockItem[] {
  return normalizeBlockValue(value, "block").filter((item) => {
    if (item.text !== null) {
      return item.text.trim().length > 0;
    }
    return item.blockType.trim().length > 0;
  });
}

function normalizeBlockValue(
  value: unknown,
  fallbackId: string,
): BloomBlockItem[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      normalizeBlockValue(entry, `${fallbackId}-${index}`),
    );
  }

  if (!isRecord(value)) {
    return [];
  }

  const blockType =
    readString(value.block_type) ??
    readString(value.blockType) ??
    readString(value.type);
  if (blockType) {
    return [createBlockItem(value, blockType, fallbackId)];
  }

  for (const key of BLOCK_ARRAY_KEYS) {
    const nested = value[key];
    if (Array.isArray(nested)) {
      return normalizeBlockValue(nested, fallbackId);
    }
  }

  return [];
}

function createBlockItem(
  value: Record<string, unknown>,
  blockType: string,
  fallbackId: string,
): BloomBlockItem {
  const text =
    blockType === "text" && !hasContentBlockPayload(value)
      ? (readString(value.text) ??
        readString(value.content) ??
        readString(value.markdown) ??
        readString(value.data))
      : null;
  const payload = value.payload ?? value;
  const id = readString(value.id) ?? `${fallbackId}-${blockType}`;
  const position = readNumber(value.position);

  return {
    id,
    blockType,
    payload,
    text,
    position,
  };
}

function hasContentBlockPayload(value: Record<string, unknown>): boolean {
  if (readString(value.contentType) || readString(value.content_type)) {
    return true;
  }

  const data = value.data;
  return (
    isRecord(data) &&
    (Boolean(readString(data.contentType)) ||
      Boolean(readString(data.content_type)))
  );
}

export function rowsFromValue(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord);
}
