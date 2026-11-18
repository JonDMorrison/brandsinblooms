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

/**
 * Every top-level record a tool returned: each row of an array result, or the
 * single object. Checking only the first row would let a foreign row hide
 * behind a legitimate one.
 */
function entityRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  return isRecord(value) ? [value] : [];
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
  const foreign = entityRecords(data).find(
    (entity) => "tenant_id" in entity && entity.tenant_id !== expectedTenantId,
  );

  if (!foreign) {
    return { valid: true, violationDetails: null };
  }

  const foundTenantId = foreign.tenant_id;
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
