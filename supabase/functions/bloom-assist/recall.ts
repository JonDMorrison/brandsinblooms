import type { JsonObject, JsonValue, PersistenceClient } from "./types.ts";

const MAX_TOOL_EXECUTIONS_TO_SCAN = 50;
const MAX_PARAM_CHARS = 520;
const MAX_RESULT_SUMMARY_CHARS = 280;
const SECRET_KEYS = new Set([
  "tenant_id",
  "tenantId",
  "user_id",
  "userId",
  "auth_token",
  "authToken",
  "authorization",
  "service_role_key",
]);

export type RecallTriggerResult = {
  hasRecall: boolean;
  entityHint: string | null;
  toolHint: string | null;
};

export type RecalledContext = {
  toolName: string;
  params: JsonObject;
  resultSummary: string;
};

export type RecallResolutionScope = {
  tenantId?: string;
  userId?: string;
};

type ToolExecutionRow = {
  tool_name: string;
  tool_input: JsonObject;
  tool_output: JsonValue | null;
  status: string;
  created_at: string;
};

type RequiredRecallScope = {
  tenantId: string;
  userId: string;
};

type EntityPattern = {
  hint: string;
  pattern: RegExp;
};

type ToolPattern = {
  hint: string;
  pattern: RegExp;
};

const RECALL_PATTERNS = [
  /\b(use|reuse|apply|run|show|list|find|make|do|try|send|create|update)\s+(it|that|those|them|the same)\b/i,
  /\b(the same|same criteria|same filters|same filter|same query|same search|same segment|same campaign)\b/i,
  /\b(like before|like last time|from earlier|the one from earlier|as before|again)\b/i,
  /\bwhat we\s+(discussed|talked about|used)\b/i,
  /\bas we\s+(discussed|talked about|used)\b/i,
  /\b(that|those|the)\s+(segment|customers?|contacts?|campaign|products?|items?|orders?|query|filters?|criteria)\b/i,
];

const ENTITY_PATTERNS: EntityPattern[] = [
  {
    hint: "customer",
    pattern: /\b(customers?|contacts?|clients?|people|audience|recipients?)\b/i,
  },
  {
    hint: "product",
    pattern: /\b(products?|items?|inventory|skus?|merchandise)\b/i,
  },
  {
    hint: "campaign",
    pattern: /\b(campaigns?|emails?|sms|newsletter|messages?|send|sent)\b/i,
  },
  {
    hint: "segment",
    pattern: /\b(segments?|lists?|groups?|audiences?)\b/i,
  },
  {
    hint: "order",
    pattern: /\b(orders?|purchases?|sales?|transactions?|revenue)\b/i,
  },
  {
    hint: "persona",
    pattern: /\b(personas?)\b/i,
  },
];

const TOOL_PATTERNS: ToolPattern[] = [
  {
    hint: "query",
    pattern:
      /\b(query|queries|search|find|filter|filters|criteria|list|show|results?)\b/i,
  },
  {
    hint: "campaign",
    pattern: /\b(campaigns?|emails?|sms|newsletter)\b/i,
  },
  {
    hint: "analytics",
    pattern: /\b(analytics?|revenue|metrics?|dashboard|insights?|health)\b/i,
  },
  {
    hint: "generate_content",
    pattern:
      /\b(copy|content|subject lines?|caption|social post|description)\b/i,
  },
  {
    hint: "generate_image",
    pattern: /\b(images?|photos?|graphics?|visuals?)\b/i,
  },
  {
    hint: "export",
    pattern: /\b(exports?|download|csv|json)\b/i,
  },
  {
    hint: "navigate",
    pattern: /\b(navigate|open|page|screen)\b/i,
  },
];

const ENTITY_TOOL_FRAGMENTS: Record<string, string[]> = {
  customer: ["customer", "customers", "persona", "segment_members", "consent"],
  product: ["product", "products"],
  campaign: ["campaign", "campaigns", "email_health"],
  segment: ["segment", "segments", "audience"],
  order: ["order", "orders", "revenue"],
  persona: ["persona", "personas"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) {
    return true;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isJsonObject(value: unknown): value is JsonObject {
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function toJsonObject(value: unknown): JsonObject {
  return isJsonObject(value) ? value : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function limitText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxChars - 15)).trim()} [truncated]`;
}

function safeJsonStringify(value: JsonValue, maxChars: number): string {
  return limitText(JSON.stringify(value), maxChars);
}

function normalizeHint(value: string | null): string | null {
  return value?.trim().toLowerCase().replace(/\s+/g, "_") || null;
}

function inferEntityHint(message: string): string | null {
  for (const item of ENTITY_PATTERNS) {
    if (item.pattern.test(message)) {
      return item.hint;
    }
  }

  return null;
}

function inferToolHint(message: string): string | null {
  for (const item of TOOL_PATTERNS) {
    if (item.pattern.test(message)) {
      return item.hint;
    }
  }

  return null;
}

function hasRecallPattern(message: string): boolean {
  return RECALL_PATTERNS.some((pattern) => pattern.test(message));
}

function requireScope(
  scope: RecallResolutionScope | undefined,
): RequiredRecallScope {
  if (!scope?.tenantId || !scope.userId) {
    throw new Error(
      "Tenant and user scope are required to resolve recalled context",
    );
  }

  return {
    tenantId: scope.tenantId,
    userId: scope.userId,
  };
}

function parseToolExecutionRows(value: unknown): ToolExecutionRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rows: ToolExecutionRow[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const toolName = readString(item.tool_name);
    const status = readString(item.status);
    const createdAt = readString(item.created_at);
    if (!toolName || !status || !createdAt) {
      continue;
    }

    rows.push({
      tool_name: toolName,
      tool_input: toJsonObject(item.tool_input),
      tool_output: isJsonValue(item.tool_output) ? item.tool_output : null,
      status,
      created_at: createdAt,
    });
  }

  return rows;
}

function removeSecretProperties(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(removeSecretProperties);
  }

  if (!isJsonObject(value)) {
    return value;
  }

  const sanitized: JsonObject = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (SECRET_KEYS.has(key)) {
      continue;
    }

    sanitized[key] = removeSecretProperties(nestedValue);
  }

  return sanitized;
}

function sanitizeParams(value: JsonObject): JsonObject {
  const sanitized = removeSecretProperties(value);
  return isJsonObject(sanitized) ? sanitized : {};
}

function matchesEntityHint(
  toolName: string,
  entityHint: string | null,
): boolean {
  if (!entityHint) {
    return true;
  }

  const fragments = ENTITY_TOOL_FRAGMENTS[entityHint] ?? [entityHint];
  return fragments.some((fragment) => toolName.includes(fragment));
}

function matchesToolHint(toolName: string, toolHint: string | null): boolean {
  if (!toolHint) {
    return true;
  }

  if (toolHint === "query") {
    return (
      toolName.startsWith("query_") ||
      toolName.startsWith("get_") ||
      toolName === "compute_audience_size"
    );
  }

  if (toolHint === "analytics") {
    return (
      toolName.includes("analytics") ||
      toolName.includes("dashboard") ||
      toolName.includes("insights") ||
      toolName.includes("health") ||
      toolName.includes("revenue")
    );
  }

  return toolName.includes(toolHint);
}

function selectMatchingToolExecution(
  rows: ToolExecutionRow[],
  entityHint: string | null,
  toolHint: string | null,
): ToolExecutionRow | null {
  const normalizedEntityHint = normalizeHint(entityHint);
  const normalizedToolHint = normalizeHint(toolHint);

  if (!normalizedEntityHint && !normalizedToolHint) {
    return rows[0] ?? null;
  }

  return (
    rows.find((row) => {
      const toolName = row.tool_name.toLowerCase();
      return (
        matchesToolHint(toolName, normalizedToolHint) &&
        matchesEntityHint(toolName, normalizedEntityHint)
      );
    }) ?? null
  );
}

function readOutputCount(value: JsonValue | null): number | null {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (!isJsonObject(value)) {
    return null;
  }

  for (const key of ["count", "total", "total_count", "result_count"]) {
    const count = value[key];
    if (typeof count === "number" && Number.isFinite(count)) {
      return count;
    }
  }

  for (const key of [
    "data",
    "results",
    "items",
    "customers",
    "products",
    "campaigns",
    "segments",
    "orders",
  ]) {
    const item = value[key];
    if (Array.isArray(item)) {
      return item.length;
    }
  }

  const confirmationDetails = value.confirmation_details;
  if (isJsonObject(confirmationDetails)) {
    const affectedCount = confirmationDetails.affected_count;
    if (typeof affectedCount === "number" && Number.isFinite(affectedCount)) {
      return affectedCount;
    }
  }

  return null;
}

function displayNameFromObject(value: JsonObject): string | null {
  const firstName = readString(value.first_name);
  const lastName = readString(value.last_name);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }

  for (const key of [
    "name",
    "title",
    "subject_line",
    "email",
    "sku",
    "phone",
    "id",
  ]) {
    const text = readString(value[key]);
    if (text) {
      return text;
    }
  }

  return null;
}

function collectDisplayNames(
  value: JsonValue | null,
  names: string[],
  depth = 0,
): void {
  if (names.length >= 3 || depth > 4 || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectDisplayNames(item, names, depth + 1);
      if (names.length >= 3) {
        return;
      }
    }
    return;
  }

  if (!isJsonObject(value)) {
    return;
  }

  const displayName = displayNameFromObject(value);
  if (displayName && !names.includes(displayName)) {
    names.push(displayName);
  }

  for (const key of [
    "data",
    "results",
    "items",
    "customers",
    "products",
    "campaigns",
    "segments",
    "orders",
  ]) {
    collectDisplayNames(value[key] ?? null, names, depth + 1);
    if (names.length >= 3) {
      return;
    }
  }
}

function summarizeToolOutput(output: JsonValue | null): string {
  if (output === null) {
    return "completed without a stored result payload.";
  }

  const count = readOutputCount(output);
  const names: string[] = [];
  collectDisplayNames(output, names);
  const message = isJsonObject(output) ? readString(output.message) : null;
  const countText =
    count === null
      ? "returned a completed result"
      : `returned ${count} ${count === 1 ? "result" : "results"}`;
  const namesText = names.length > 0 ? ` including ${names.join(", ")}` : "";
  const messageText = message ? ` (${limitText(message, 120)})` : "";

  return limitText(
    `${countText}${namesText}${messageText}.`,
    MAX_RESULT_SUMMARY_CHARS,
  );
}

export function detectRecallTrigger(message: string): RecallTriggerResult {
  const normalizedMessage = message.trim();
  const entityHint = inferEntityHint(normalizedMessage);
  const toolHint = inferToolHint(normalizedMessage);
  const hasRecall =
    hasRecallPattern(normalizedMessage) ||
    (/\b(that|those|them|it)\b/i.test(normalizedMessage) &&
      Boolean(entityHint || toolHint));

  return {
    hasRecall,
    entityHint,
    toolHint,
  };
}

export async function resolveRecalledContext(
  serviceClient: PersistenceClient,
  conversationId: string,
  entityHint: string | null,
  toolHint: string | null,
  scope?: RecallResolutionScope,
): Promise<RecalledContext | null> {
  const resolvedScope = requireScope(scope);
  const { data, error } = await serviceClient
    .from("bloom_tool_executions")
    .select("tool_name, tool_input, tool_output, status, created_at")
    .eq("tenant_id", resolvedScope.tenantId)
    .eq("user_id", resolvedScope.userId)
    .eq("conversation_id", conversationId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(MAX_TOOL_EXECUTIONS_TO_SCAN);

  if (error) {
    throw new Error(
      `Failed to resolve recalled Bloom context: ${error.message}`,
    );
  }

  const rows = parseToolExecutionRows(data);
  const match = selectMatchingToolExecution(rows, entityHint, toolHint);
  if (!match) {
    return null;
  }

  return {
    toolName: match.tool_name,
    params: sanitizeParams(match.tool_input),
    resultSummary: summarizeToolOutput(match.tool_output),
  };
}

export function formatRecalledContext(recalled: RecalledContext): string {
  return [
    `[Recalled Context] The user is referencing previous tool context from ${recalled.toolName}.`,
    `Previous parameters: ${safeJsonStringify(recalled.params, MAX_PARAM_CHARS)}.`,
    `Result summary: ${limitText(recalled.resultSummary, MAX_RESULT_SUMMARY_CHARS)}`,
    "Apply these parameters to the current request unless the user specifies modifications.",
  ].join(" ");
}
