import type {
  BloomAuditEventType,
  JsonObject,
  JsonValue,
  LogAuditEventOptions,
  PersistenceClient,
} from "../types.ts";

export type SecurityAuditEventType =
  | "injection_attempt"
  | "output_violation"
  | "cross_tenant_attempt"
  | "rate_limit";

const MAX_AUDIT_SUMMARY_CHARS = 200;
const MAX_STACK_CHARS = 500;
const SECURITY_EVENT_FALLBACKS: Record<
  SecurityAuditEventType,
  BloomAuditEventType
> = {
  injection_attempt: "execution",
  output_violation: "error",
  cross_tenant_attempt: "error",
  rate_limit: "error",
};

let exactSecurityEventTypesSupported: boolean | null = null;

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

  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every(isJsonValue)
  );
}

function limitText(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars - 3)}...` : value;
}

export function summarizeForAudit(
  value: JsonValue,
  maxChars = MAX_AUDIT_SUMMARY_CHARS,
): string {
  return limitText(JSON.stringify(value), maxChars);
}

export function stackTraceSummary(error: unknown): string | null {
  if (!(error instanceof Error) || !error.stack) {
    return null;
  }

  return limitText(error.stack.replace(/\s+/g, " ").trim(), MAX_STACK_CHARS);
}

export function compactAuditObject(value: Record<string, unknown>): JsonObject {
  const compacted: JsonObject = {};

  for (const [key, item] of Object.entries(value)) {
    if (isJsonValue(item)) {
      compacted[key] = item;
    }
  }

  return compacted;
}

async function insertAuditEvent(args: {
  serviceClient: PersistenceClient;
  tenantId: string;
  userId: string;
  eventType: string;
  eventData: JsonObject;
  options?: LogAuditEventOptions;
}): Promise<string | null> {
  const { error } = await args.serviceClient.from("bloom_audit_log").insert({
    tenant_id: args.tenantId,
    user_id: args.userId,
    conversation_id: args.options?.conversationId ?? null,
    message_id: args.options?.messageId ?? null,
    event_type: args.eventType,
    event_data: args.eventData,
    model_used: args.options?.model ?? null,
    tokens_input: args.options?.tokens?.input ?? null,
    tokens_output: args.options?.tokens?.output ?? null,
    latency_ms: args.options?.latencyMs ?? null,
  });

  return error?.message ?? null;
}

export async function logSecurityAuditEvent(
  serviceClient: PersistenceClient,
  tenantId: string,
  userId: string,
  securityEventType: SecurityAuditEventType,
  eventData: JsonObject,
  options: LogAuditEventOptions = {},
): Promise<void> {
  const payload: JsonObject = {
    security_event_type: securityEventType,
    ...eventData,
  };

  if (exactSecurityEventTypesSupported !== false) {
    const exactError = await insertAuditEvent({
      serviceClient,
      tenantId,
      userId,
      eventType: securityEventType,
      eventData: payload,
      options,
    });

    if (!exactError) {
      exactSecurityEventTypesSupported = true;
      return;
    }

    exactSecurityEventTypesSupported = false;
  }

  const fallbackEventType = SECURITY_EVENT_FALLBACKS[securityEventType];
  const fallbackError = await insertAuditEvent({
    serviceClient,
    tenantId,
    userId,
    eventType: fallbackEventType,
    eventData: {
      ...payload,
      requested_event_type: securityEventType,
      stored_event_type: fallbackEventType,
    },
    options,
  });

  if (fallbackError) {
    throw new Error(
      `Failed to log Bloom security audit event: ${fallbackError}`,
    );
  }
}
