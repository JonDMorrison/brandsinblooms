import { format, formatDistanceToNowStrict } from "date-fns";

export const MAX_VISIBLE_CARD_ROWS = 5;

export type ResultCardTone =
  | "primary"
  | "neutral"
  | "success"
  | "warning"
  | "danger";

export interface NormalizedToolResult {
  toolName: string;
  blockType: string | null;
  status: "success" | "error";
  data: unknown;
  count: number | null;
  message: string | null;
  error: string | null;
  raw: unknown;
}

export type MutationResultState =
  | "created"
  | "updated"
  | "deleted"
  | "duplicate_found";

export type ResultCardAction = {
  label: string;
  type: "download" | "link" | "navigate" | "prompt";
  prompt: string;
  href?: string;
  downloadName?: string | null;
};

export interface ExportResultMetadata {
  downloadUrl: string;
  entityLabel: string | null;
  expiresAt: string | null;
  fileName: string | null;
  fileSizeLabel: string | null;
  format: string | null;
  generatedAt: string | null;
  rowCount: number | null;
  totalMatchingCount: number | null;
  truncated: boolean;
}

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

export function getValue(
  record: Record<string, unknown>,
  keys: string[],
): unknown {
  for (const key of keys) {
    const direct = record[key];
    if (direct !== undefined && direct !== null && direct !== "") {
      return direct;
    }

    if (!key.includes(".")) {
      continue;
    }

    let current: unknown = record;
    for (const segment of key.split(".")) {
      current = isRecord(current) ? current[segment] : undefined;
    }
    if (current !== undefined && current !== null && current !== "") {
      return current;
    }
  }

  return undefined;
}

export function formatLabel(value: unknown, fallback = "Result"): string {
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

export function formatToolTitle(toolName: string, fallback = "Result") {
  const cleaned = toolName
    .replace(/^(query|get|search|generate)_/, "")
    .replace(/_/g, " ")
    .trim();

  return formatLabel(cleaned || fallback, fallback).toUpperCase();
}

export function formatCurrency(value: unknown, currencyValue?: unknown) {
  const amount = readNumber(value);
  if (amount === null) {
    return null;
  }

  const currency = readString(currencyValue) ?? "USD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(value: unknown) {
  const numeric = readNumber(value);
  return numeric === null
    ? null
    : new Intl.NumberFormat("en-US").format(numeric);
}

export function formatPercent(value: unknown) {
  const numeric = readNumber(value);
  if (numeric === null) {
    return null;
  }

  const percent = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Number.isInteger(percent) ? 0 : 1,
  }).format(percent)}%`;
}

export function formatDate(value: unknown) {
  const text = readString(value);
  if (!text) {
    return null;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text;
  }

  const ageMs = Math.abs(Date.now() - date.getTime());
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return ageMs < sevenDaysMs
    ? formatDistanceToNowStrict(date, { addSuffix: true })
    : format(date, "MMM d");
}

export function valueToText(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US").format(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    const compact = value
      .map(valueToText)
      .filter((entry): entry is string => Boolean(entry));
    return compact.length > 0 ? compact.join(", ") : null;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Unsupported value";
  }
}

export function normalizeToolResult(input: {
  toolName: string | null | undefined;
  blockType?: string | null;
  data: unknown;
  status?:
    | "success"
    | "error"
    | "pending"
    | "executing"
    | "completed"
    | "failed"
    | null;
  message?: string | null;
  error?: string | null;
  count?: number | null;
}): NormalizedToolResult {
  const source = isRecord(input.data) ? input.data : null;
  const rawSuccess = source?.success;
  const explicitStatus = input.status;
  const outputError = readString(source?.error) ?? input.error ?? null;
  const normalizedStatus =
    explicitStatus === "error" ||
    explicitStatus === "failed" ||
    rawSuccess === false ||
    Boolean(outputError)
      ? "error"
      : "success";
  const data = source && "data" in source ? source.data : input.data;
  const count =
    readNumber(source?.count) ??
    input.count ??
    (Array.isArray(data)
      ? data.length
      : data === null || data === undefined
        ? 0
        : 1);

  return {
    toolName: readString(input.toolName) ?? "unknown_tool",
    blockType:
      readString(source?.block_type) ??
      readString(source?.blockType) ??
      readString(input.blockType),
    status: normalizedStatus,
    data,
    count,
    message: readString(source?.message) ?? input.message ?? null,
    error: outputError,
    raw: input.data,
  };
}

function resultRecord(
  result: NormalizedToolResult,
): Record<string, unknown> | null {
  if (isRecord(result.data)) {
    return result.data;
  }

  const raw = isRecord(result.raw) ? result.raw : null;
  if (isRecord(raw?.data)) {
    return raw.data;
  }

  return raw;
}

export function mutationStateForResult(
  result: NormalizedToolResult,
): MutationResultState | null {
  const raw = isRecord(result.raw) ? result.raw : null;
  const errorCode = readString(raw?.error) ?? result.error;

  if (errorCode === "duplicate_customer" || errorCode === "duplicate_product") {
    return "duplicate_found";
  }

  if (result.status === "error") {
    return null;
  }

  switch (result.toolName.toLowerCase()) {
    case "create_customer":
    case "create_product":
      return "created";
    case "update_customer":
    case "update_product":
    case "toggle_product_status":
      return "updated";
    case "delete_customer":
      return "deleted";
    default:
      return null;
  }
}

export function duplicateDisplayResult(
  result: NormalizedToolResult,
): NormalizedToolResult | null {
  if (mutationStateForResult(result) !== "duplicate_found") {
    return null;
  }

  const source = resultRecord(result);
  if (!source) {
    return null;
  }

  const entity = isRecord(source.existing_customer)
    ? source.existing_customer
    : isRecord(source.existing_product)
      ? source.existing_product
      : null;

  if (!entity) {
    return null;
  }

  return {
    ...result,
    count: 1,
    data: entity,
    status: "success",
  };
}

export function exportResultMetadata(
  result: NormalizedToolResult,
): ExportResultMetadata | null {
  const source = resultRecord(result);
  if (!source) {
    return null;
  }

  const downloadUrl =
    readString(source.download_url) ?? readString(source.downloadUrl);
  if (!downloadUrl) {
    return null;
  }

  const entity = isRecord(source.entity) ? source.entity : null;

  return {
    downloadUrl,
    entityLabel:
      readString(entity?.name) ?? readString(source.entity_type) ?? null,
    expiresAt: readString(source.expires_at) ?? readString(source.expiresAt),
    fileName: readString(source.file_name) ?? readString(source.fileName),
    fileSizeLabel:
      readString(source.file_size_label) ?? readString(source.fileSizeLabel),
    format: readString(source.format),
    generatedAt:
      readString(source.generated_at) ?? readString(source.generatedAt),
    rowCount: readNumber(source.row_count) ?? readNumber(source.rowCount),
    totalMatchingCount:
      readNumber(source.total_matching_count) ??
      readNumber(source.totalMatchingCount),
    truncated: readBoolean(source.truncated) ?? false,
  };
}

export function resultCardActions(
  result: NormalizedToolResult,
): ResultCardAction[] {
  const source = resultRecord(result);
  if (!source) {
    return [];
  }

  const actions: ResultCardAction[] = [];
  const exportMetadata = exportResultMetadata(result);

  if (exportMetadata?.downloadUrl) {
    actions.push({
      label: exportMetadata.format
        ? `Download ${formatLabel(exportMetadata.format)}`
        : "Download export",
      type: "download",
      prompt: exportMetadata.fileName
        ? `Download ${exportMetadata.fileName}`
        : "Download export",
      href: exportMetadata.downloadUrl,
      downloadName: exportMetadata.fileName,
    });
  }

  const rawActions = source.actions;
  if (!Array.isArray(rawActions)) {
    return actions;
  }

  return actions.concat(
    rawActions.flatMap((entry, index) => {
      if (!isRecord(entry)) {
        return [];
      }

      const label = readString(entry.label) ?? `Action ${index + 1}`;
      const prompt =
        readString(entry.prompt) ??
        readString(entry.action_prompt) ??
        readString(entry.actionPrompt) ??
        label;
      const href =
        readString(entry.url) ??
        readString(entry.href) ??
        readString(entry.target_path) ??
        readString(entry.targetPath) ??
        undefined;
      const rawType = readString(entry.type)?.toLowerCase();
      const type: ResultCardAction["type"] =
        rawType === "download" ||
        rawType === "link" ||
        rawType === "navigate" ||
        rawType === "prompt"
          ? rawType
          : href
            ? "link"
            : "prompt";

      if (href && actions.some((action) => action.href === href)) {
        return [];
      }

      return [
        {
          label,
          type,
          prompt,
          href,
          downloadName:
            readString(entry.file_name) ?? readString(entry.fileName) ?? null,
        },
      ];
    }),
  );
}

export function rowsFromResult(
  result: NormalizedToolResult,
): Record<string, unknown>[] {
  if (Array.isArray(result.data)) {
    return result.data.filter(isRecord);
  }

  if (isRecord(result.data)) {
    for (const key of [
      "items",
      "rows",
      "results",
      "customers",
      "products",
      "campaigns",
      "orders",
      "data",
    ]) {
      const nested = result.data[key];
      if (Array.isArray(nested)) {
        return nested.filter(isRecord);
      }
    }
    return [result.data];
  }

  return [];
}

export function visibleRows(result: NormalizedToolResult) {
  const rows = rowsFromResult(result);
  return {
    rows: rows.slice(0, MAX_VISIBLE_CARD_ROWS),
    total: result.count ?? rows.length,
    overflow: Math.max(
      0,
      (result.count ?? rows.length) - MAX_VISIBLE_CARD_ROWS,
    ),
  };
}

export function customerDisplayName(record: Record<string, unknown>) {
  const fullName = [readString(record.first_name), readString(record.last_name)]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .trim();

  return (
    readString(getValue(record, ["name", "customer_name"])) ??
    (fullName || null) ??
    readString(getValue(record, ["email", "customer_email"])) ??
    "Unnamed customer"
  );
}

export function initialsFor(value: string) {
  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "BS";
}

export function statusTone(value: unknown): ResultCardTone {
  const status = readString(value)
    ?.toLowerCase()
    .replace(/[\s_]+/g, "-");
  if (!status) {
    return "neutral";
  }
  if (
    ["active", "completed", "delivered", "paid", "sent", "success"].includes(
      status,
    )
  ) {
    return "success";
  }
  if (
    [
      "pending",
      "paused",
      "queued",
      "scheduled",
      "draft",
      "processing",
    ].includes(status)
  ) {
    return "warning";
  }
  if (
    [
      "cancelled",
      "canceled",
      "failed",
      "rejected",
      "blocked",
      "error",
    ].includes(status)
  ) {
    return "danger";
  }
  return "neutral";
}

export function inferEntityFromToolName(toolName: string) {
  const normalized = toolName.toLowerCase();
  if (
    normalized.includes("customer") ||
    normalized.includes("segment_members")
  ) {
    return "customer";
  }
  if (normalized.includes("product") || normalized.includes("inventory")) {
    return "product";
  }
  if (normalized.includes("campaign")) {
    return "campaign";
  }
  if (normalized.includes("order")) {
    return "order";
  }
  if (
    normalized.includes("dashboard") ||
    normalized.includes("analytics") ||
    normalized.includes("revenue") ||
    normalized.includes("health") ||
    normalized.includes("insight")
  ) {
    return "analytics";
  }
  return "generic";
}
