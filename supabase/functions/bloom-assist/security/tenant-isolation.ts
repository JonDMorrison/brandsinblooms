import type { JsonValue } from "../types.ts";
import type {
  ToolExecutionContext,
  ToolName,
  ToolResult,
} from "../tools/types.ts";

export type TenantIsolationValidationResult = {
  valid: boolean;
  violationDetails: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstEntityRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    return isRecord(value[0]) ? value[0] : null;
  }

  return isRecord(value) ? value : null;
}

export function isTenantIsolationExemptTool(toolName: ToolName): boolean {
  return false;
}

export function validateTenantContext(
  context: ToolExecutionContext,
): TenantIsolationValidationResult {
  if (!context.tenantId || !context.userId) {
    return {
      valid: false,
      violationDetails: "Tool context was missing tenant or user identity.",
    };
  }

  if (
    context.authenticatedTenantId &&
    context.authenticatedTenantId !== context.tenantId
  ) {
    return {
      valid: false,
      violationDetails: `Authenticated tenant ${context.authenticatedTenantId} did not match tool tenant ${context.tenantId}.`,
    };
  }

  return { valid: true, violationDetails: null };
}

export function validateTenantIsolation(
  toolResult: unknown,
  expectedTenantId: string,
): TenantIsolationValidationResult {
  const resultRecord = isRecord(toolResult) ? toolResult : null;
  const data: JsonValue | null =
    resultRecord && "data" in resultRecord
      ? (resultRecord.data as JsonValue | null)
      : null;
  const entity = firstEntityRecord(data);

  if (!entity || !("tenant_id" in entity)) {
    return { valid: true, violationDetails: null };
  }

  const foundTenantId = entity.tenant_id;
  if (foundTenantId === expectedTenantId) {
    return { valid: true, violationDetails: null };
  }

  return {
    valid: false,
    violationDetails:
      typeof foundTenantId === "string"
        ? `Expected tenant ${expectedTenantId}, found tenant ${foundTenantId}.`
        : `Expected tenant ${expectedTenantId}, found a non-string tenant_id value.`,
  };
}

export function suppressCrossTenantResult(): ToolResult {
  return {
    success: false,
    data: null,
    count: 0,
    message:
      "Tool result was suppressed because tenant isolation validation failed.",
    error: "tenant_isolation_violation",
    block_type: "text",
    confirmation_required: false,
    confirmation_details: null,
  };
}
