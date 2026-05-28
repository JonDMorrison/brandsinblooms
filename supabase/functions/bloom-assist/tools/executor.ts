import type { JsonArray, JsonObject, JsonValue } from "../types.ts";
import { cacheGet, cacheInvalidate, cacheSet } from "../cache.ts";
import {
  compactAuditObject,
  logSecurityAuditEvent,
} from "../security/audit.ts";
import {
  isTenantIsolationExemptTool,
  suppressCrossTenantResult,
  validateTenantContext,
  validateTenantIsolation,
} from "../security/tenant-isolation.ts";
import { generateContent } from "./implementations/content-generation.ts";
import {
  getDashboardSummary,
  getEmailHealth,
  getRevenueAnalytics,
} from "./implementations/analytics-tools.ts";
import { getCampaignAnalytics } from "./implementations/campaign-analytics.ts";
import {
  getCustomerInsights,
  getCustomerTimeline,
  getIntegrationStatus,
} from "./implementations/entity-analytics.ts";
import { getCustomerDetail } from "./implementations/get-customer-detail.ts";
import { getProductDetail } from "./implementations/get-product-detail.ts";
import { getSegmentMembers } from "./implementations/get-segment-members.ts";
import { exportDataImplementation } from "./implementations/export-data.ts";
import { executeGenerateImage } from "./implementations/image-tools.ts";
import { navigateToImplementation } from "./implementations/navigate-to.ts";
import { campaignMutationImplementation } from "./implementations/campaign-mutations.ts";
import { customerMutationImplementation } from "./implementations/customer-mutations.ts";
import { productMutationImplementation } from "./implementations/product-mutations.ts";
import { queryCampaigns } from "./implementations/query-campaigns.ts";
import { queryCustomers } from "./implementations/query-customers.ts";
import { queryOrders } from "./implementations/query-orders.ts";
import { queryProducts } from "./implementations/query-products.ts";
import { querySegments } from "./implementations/query-segments.ts";
import { searchKnowledge } from "./implementations/search-knowledge.ts";
import { segmentAudienceImplementation } from "./implementations/segment-audience.ts";
import { tagConsentImplementation } from "./implementations/tag-consent-tools.ts";
import { getRegisteredTool, normalizeToolRole } from "./registry.ts";
import type {
  ConfirmationDetails,
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionLogInput,
  ToolImplementation,
  ToolName,
  ToolResult,
  ToolRole,
  ToolValidationIssue,
  ToolValidationResult,
} from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonObject(value: unknown): value is JsonObject {
  return isRecord(value) && Object.values(value).every(isJsonValue);
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

  return isJsonObject(value);
}

function readSchemaType(schema: JsonObject): string | null {
  return typeof schema.type === "string" ? schema.type : null;
}

function readSchemaProperties(schema: JsonObject): Record<string, JsonObject> {
  if (!isRecord(schema.properties)) {
    return {};
  }

  const properties: Record<string, JsonObject> = {};
  for (const [key, value] of Object.entries(schema.properties)) {
    if (isJsonObject(value)) {
      properties[key] = value;
    }
  }

  return properties;
}

function readRequiredFields(schema: JsonObject): string[] {
  return Array.isArray(schema.required)
    ? schema.required.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
}

function readEnumValues(schema: JsonObject): JsonArray | null {
  return Array.isArray(schema.enum) && schema.enum.every(isJsonValue)
    ? schema.enum
    : null;
}

function readNumberConstraint(schema: JsonObject, key: string): number | null {
  const value = schema[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function enumMatches(value: unknown, allowedValues: JsonArray): boolean {
  return allowedValues.some(
    (allowedValue) => JSON.stringify(allowedValue) === JSON.stringify(value),
  );
}

function addIssue(
  issues: ToolValidationIssue[],
  path: string,
  message: string,
): void {
  issues.push({ path, message });
}

function validateStringConstraints(
  value: string,
  schema: JsonObject,
  path: string,
  issues: ToolValidationIssue[],
): void {
  const minLength = readNumberConstraint(schema, "minLength");
  const maxLength = readNumberConstraint(schema, "maxLength");
  const pattern = typeof schema.pattern === "string" ? schema.pattern : null;
  const format = typeof schema.format === "string" ? schema.format : null;

  if (minLength !== null && value.length < minLength) {
    addIssue(issues, path, `Must be at least ${minLength} characters`);
  }

  if (maxLength !== null && value.length > maxLength) {
    addIssue(issues, path, `Must be no more than ${maxLength} characters`);
  }

  if (pattern && !new RegExp(pattern).test(value)) {
    addIssue(issues, path, "Does not match the required format");
  }

  if (format === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
    addIssue(issues, path, "Must be a valid email address");
  }

  if (format === "date-time" && Number.isNaN(Date.parse(value))) {
    addIssue(issues, path, "Must be a valid ISO date-time string");
  }
}

function validateNumberConstraints(
  value: number,
  schema: JsonObject,
  path: string,
  issues: ToolValidationIssue[],
): void {
  const minimum = readNumberConstraint(schema, "minimum");
  const maximum = readNumberConstraint(schema, "maximum");

  if (minimum !== null && value < minimum) {
    addIssue(issues, path, `Must be greater than or equal to ${minimum}`);
  }

  if (maximum !== null && value > maximum) {
    addIssue(issues, path, `Must be less than or equal to ${maximum}`);
  }
}

function validateValueAgainstSchema(
  value: unknown,
  schema: JsonObject,
  path: string,
  issues: ToolValidationIssue[],
): void {
  const allowedValues = readEnumValues(schema);
  if (allowedValues && !enumMatches(value, allowedValues)) {
    addIssue(issues, path, "Value is not one of the allowed options");
    return;
  }

  const schemaType = readSchemaType(schema);
  if (!schemaType) {
    return;
  }

  switch (schemaType) {
    case "object": {
      if (!isRecord(value)) {
        addIssue(issues, path, "Must be an object");
        return;
      }

      const properties = readSchemaProperties(schema);
      const requiredFields = readRequiredFields(schema);

      for (const field of requiredFields) {
        if (!(field in value)) {
          addIssue(issues, `${path}.${field}`, "Required field is missing");
        }
      }

      for (const [field, fieldValue] of Object.entries(value)) {
        const fieldSchema = properties[field];
        if (!fieldSchema) {
          if (schema.additionalProperties === false) {
            addIssue(
              issues,
              `${path}.${field}`,
              "Unknown field is not allowed",
            );
          }
          continue;
        }

        validateValueAgainstSchema(
          fieldValue,
          fieldSchema,
          `${path}.${field}`,
          issues,
        );
      }
      break;
    }
    case "array": {
      if (!Array.isArray(value)) {
        addIssue(issues, path, "Must be an array");
        return;
      }

      const minItems = readNumberConstraint(schema, "minItems");
      const maxItems = readNumberConstraint(schema, "maxItems");
      if (minItems !== null && value.length < minItems) {
        addIssue(issues, path, `Must contain at least ${minItems} items`);
      }
      if (maxItems !== null && value.length > maxItems) {
        addIssue(issues, path, `Must contain no more than ${maxItems} items`);
      }

      const itemSchema = isJsonObject(schema.items) ? schema.items : null;
      if (itemSchema) {
        value.forEach((item, index) => {
          validateValueAgainstSchema(
            item,
            itemSchema,
            `${path}[${index}]`,
            issues,
          );
        });
      }
      break;
    }
    case "string":
      if (typeof value !== "string") {
        addIssue(issues, path, "Must be a string");
        return;
      }
      validateStringConstraints(value, schema, path, issues);
      break;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        addIssue(issues, path, "Must be a number");
        return;
      }
      validateNumberConstraints(value, schema, path, issues);
      break;
    case "integer":
      if (typeof value !== "number" || !Number.isInteger(value)) {
        addIssue(issues, path, "Must be an integer");
        return;
      }
      validateNumberConstraints(value, schema, path, issues);
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        addIssue(issues, path, "Must be a boolean");
      }
      break;
    case "null":
      if (value !== null) {
        addIssue(issues, path, "Must be null");
      }
      break;
  }
}

export function validateToolParams(
  tool: ToolDefinition,
  params: unknown,
): ToolValidationResult {
  if (!isJsonObject(params)) {
    return {
      ok: false,
      issues: [{ path: "$", message: "Tool parameters must be a JSON object" }],
    };
  }

  const issues: ToolValidationIssue[] = [];
  validateValueAgainstSchema(params, tool.function.parameters, "$", issues);

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: params };
}

function createResult(args: {
  success: boolean;
  data?: JsonValue | null;
  count?: number | null;
  message: string;
  error?: string | null;
  blockType?: ToolResult["block_type"];
  confirmationRequired?: boolean;
  confirmationDetails?: ConfirmationDetails | null;
}): ToolResult {
  return {
    success: args.success,
    data: args.data ?? null,
    count: args.count ?? null,
    message: args.message,
    error: args.error ?? null,
    block_type: args.blockType ?? "text",
    confirmation_required: args.confirmationRequired ?? false,
    confirmation_details: args.confirmationDetails ?? null,
  };
}

function normalizeToolName(toolName: string): string {
  const trimmed = toolName.trim();
  return trimmed || "unknown_tool";
}

function inferAffectedCount(params: JsonObject): number | null {
  const customerIds = params.customer_ids;
  if (Array.isArray(customerIds)) {
    return customerIds.length;
  }

  const singleRecordKeys = [
    "customer_id",
    "product_id",
    "campaign_id",
    "segment_id",
  ];

  return singleRecordKeys.some((key) => typeof params[key] === "string")
    ? 1
    : null;
}

function isLikelyReversible(toolName: ToolName): boolean {
  switch (toolName) {
    case "delete_customer":
    case "send_campaign":
    case "bulk_tag_customers":
    case "manage_consent":
    case "export_data":
      return false;
    default:
      return true;
  }
}

function mutationEntityType(toolName: ToolName): string | null {
  switch (toolName) {
    case "create_customer":
    case "update_customer":
    case "delete_customer":
    case "bulk_tag_customers":
    case "manage_consent":
      return "customer";
    case "create_campaign":
    case "update_campaign":
    case "clone_campaign":
    case "schedule_campaign":
    case "send_campaign":
    case "pause_resume_campaign":
      return "campaign";
    case "create_segment":
    case "update_segment":
    case "assign_segment":
      return "segment";
    case "create_tag":
      return "tag";
    case "create_product":
    case "update_product":
    case "toggle_product_status":
      return "product";
    default:
      return null;
  }
}

function buildConfirmationDetails(
  tool: ToolDefinition,
  params: JsonObject,
): ConfirmationDetails {
  return {
    action: `${tool.function.name} with the validated parameters`,
    affected_count: inferAffectedCount(params),
    reversible: isLikelyReversible(tool.function.name),
    risk_level: tool.risk_level,
    tool_name: tool.function.name,
  };
}

function createConfirmationResult(
  tool: ToolDefinition,
  params: JsonObject,
): ToolResult {
  const confirmationDetails = buildConfirmationDetails(tool, params);
  return createResult({
    success: true,
    message: `Confirmation is required before Bloom can run ${tool.function.name}.`,
    blockType: "confirmation",
    confirmationRequired: true,
    confirmationDetails,
    data: {
      tool_name: tool.function.name,
      confirmation_details: confirmationDetails,
    },
  });
}

function resultToJsonObject(result: ToolResult): JsonObject {
  return {
    success: result.success,
    data: result.data,
    count: result.count,
    message: result.message,
    error: result.error,
    block_type: result.block_type,
    confirmation_required: result.confirmation_required ?? false,
    confirmation_details: result.confirmation_details
      ? {
          action: result.confirmation_details.action,
          affected_count: result.confirmation_details.affected_count,
          reversible: result.confirmation_details.reversible,
          risk_level: result.confirmation_details.risk_level,
          tool_name: result.confirmation_details.tool_name,
        }
      : null,
  };
}

async function logToolExecution(
  context: ToolExecutionContext,
  input: ToolExecutionLogInput,
): Promise<void> {
  const { error } = await context.serviceClient
    .from("bloom_tool_executions")
    .insert({
      message_id: context.messageId,
      conversation_id: context.conversationId,
      tenant_id: context.tenantId,
      user_id: context.userId,
      tool_name: normalizeToolName(input.toolName),
      tool_input: input.input,
      tool_output: input.output,
      status: input.status,
      error_message: input.errorMessage,
      execution_time_ms: input.executionTimeMs,
    });

  if (error) {
    throw new Error(`Failed to log Bloom tool execution: ${error.message}`);
  }
}

function statusForResult(result: ToolResult) {
  return result.success || result.confirmation_required
    ? "completed"
    : "failed";
}

function unauthorizedResult(tool: ToolDefinition, role: ToolRole): ToolResult {
  return createResult({
    success: false,
    message: `The ${role} role is not allowed to run ${tool.function.name}.`,
    error: "forbidden",
    blockType: "text",
  });
}

function validationErrorResult(issues: ToolValidationIssue[]): ToolResult {
  return createResult({
    success: false,
    message: "Tool parameters failed validation.",
    error: "validation_error",
    blockType: "text",
    data: {
      issues: issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    },
  });
}

function unknownToolResult(toolName: string): ToolResult {
  return createResult({
    success: false,
    message: `Unknown Bloom tool: ${normalizeToolName(toolName)}.`,
    error: "unknown_tool",
    blockType: "text",
  });
}

function isCacheableTool(toolName: ToolName): boolean {
  return toolName !== "export_data";
}

async function logCrossTenantAttempt(
  context: ToolExecutionContext,
  toolName: string,
  violationDetails: string,
): Promise<void> {
  try {
    await logSecurityAuditEvent(
      context.serviceClient,
      context.tenantId,
      context.userId,
      "cross_tenant_attempt",
      compactAuditObject({
        tool_name: normalizeToolName(toolName),
        expected_tenant_id: context.tenantId,
        authenticated_tenant_id: context.authenticatedTenantId ?? null,
        violation_details: violationDetails,
      }),
      {
        conversationId: context.conversationId,
        messageId: context.messageId,
      },
    );
  } catch (error) {
    console.error(
      "[bloom-assist] Failed to log tenant isolation audit event",
      error,
    );
  }
}

function notImplementedResult(toolName: ToolName): ToolResult {
  return createResult({
    success: false,
    message: `${toolName} is registered and validated, but its CRM implementation arrives in a later Bloom milestone.`,
    error: "not_implemented",
    blockType: "text",
  });
}

function getToolImplementation(toolName: ToolName): ToolImplementation {
  const navigateTo = navigateToImplementation(toolName);
  if (navigateTo) {
    return navigateTo;
  }

  const exportData = exportDataImplementation(toolName);
  if (exportData) {
    return exportData;
  }

  const productMutation = productMutationImplementation(toolName);
  if (productMutation) {
    return productMutation;
  }

  const customerMutation = customerMutationImplementation(toolName);
  if (customerMutation) {
    return customerMutation;
  }

  const campaignMutation = campaignMutationImplementation(toolName);
  if (campaignMutation) {
    return campaignMutation;
  }

  const segmentAudience = segmentAudienceImplementation(toolName);
  if (segmentAudience) {
    return segmentAudience;
  }

  const tagConsent = tagConsentImplementation(toolName);
  if (tagConsent) {
    return tagConsent;
  }

  switch (toolName) {
    case "query_customers":
      return queryCustomers;
    case "query_products":
      return queryProducts;
    case "query_campaigns":
      return queryCampaigns;
    case "query_segments":
      return querySegments;
    case "query_orders":
      return queryOrders;
    case "search_knowledge":
      return searchKnowledge;
    case "get_customer_detail":
      return getCustomerDetail;
    case "get_product_detail":
      return getProductDetail;
    case "get_segment_members":
      return getSegmentMembers;
    case "get_campaign_analytics":
      return getCampaignAnalytics;
    case "get_dashboard_summary":
      return getDashboardSummary;
    case "get_revenue_analytics":
      return getRevenueAnalytics;
    case "get_email_health":
      return getEmailHealth;
    case "get_customer_timeline":
      return getCustomerTimeline;
    case "get_integration_status":
      return getIntegrationStatus;
    case "get_customer_insights":
      return getCustomerInsights;
    case "generate_content":
      return generateContent;
    case "generate_image":
      return executeGenerateImage;
    default:
      return () => Promise.resolve(notImplementedResult(toolName));
  }
}

function coerceLogInput(params: unknown): JsonObject {
  return isJsonObject(params) ? params : { invalid_params: true };
}

export async function executeTool(
  toolName: string,
  params: unknown,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const startedAt = Date.now();
  const tool = getRegisteredTool(toolName);
  let result: ToolResult;
  let logInput = coerceLogInput(params);
  const tenantContextCheck = validateTenantContext(context);

  if (!tenantContextCheck.valid) {
    result = suppressCrossTenantResult();
    await logCrossTenantAttempt(
      context,
      toolName,
      tenantContextCheck.violationDetails ??
        "Pre-execution tenant context validation failed.",
    );
    await logToolExecution(context, {
      toolName,
      input: logInput,
      output: resultToJsonObject(result),
      status: "failed",
      errorMessage: result.error,
      executionTimeMs: Date.now() - startedAt,
    });
    return result;
  }

  if (!tool) {
    result = unknownToolResult(toolName);
    await logToolExecution(context, {
      toolName,
      input: logInput,
      output: resultToJsonObject(result),
      status: "failed",
      errorMessage: result.error,
      executionTimeMs: Date.now() - startedAt,
    });
    return result;
  }

  const validation = validateToolParams(tool, params);
  if (!validation.ok) {
    result = validationErrorResult(validation.issues);
    await logToolExecution(context, {
      toolName: tool.function.name,
      input: logInput,
      output: resultToJsonObject(result),
      status: "failed",
      errorMessage: result.error,
      executionTimeMs: Date.now() - startedAt,
    });
    return result;
  }

  logInput = validation.value;
  const role = normalizeToolRole(context.userRole);
  if (!tool.allowed_roles.includes(role)) {
    result = unauthorizedResult(tool, role);
    await logToolExecution(context, {
      toolName: tool.function.name,
      input: logInput,
      output: resultToJsonObject(result),
      status: "failed",
      errorMessage: result.error,
      executionTimeMs: Date.now() - startedAt,
    });
    return result;
  }

  if (tool.requires_confirmation && context.approved !== true) {
    result = createConfirmationResult(tool, validation.value);
    await logToolExecution(context, {
      toolName: tool.function.name,
      input: logInput,
      output: resultToJsonObject(result),
      status: "completed",
      errorMessage: null,
      executionTimeMs: Date.now() - startedAt,
    });
    return result;
  }

  if (isCacheableTool(tool.function.name)) {
    const cachedResult = cacheGet(
      context.tenantId,
      tool.function.name,
      validation.value,
      context.cacheAuditScopeId,
    );
    if (cachedResult) {
      await logToolExecution(context, {
        toolName: tool.function.name,
        input: logInput,
        output: resultToJsonObject(cachedResult),
        status: statusForResult(cachedResult),
        errorMessage: cachedResult.error,
        executionTimeMs: Date.now() - startedAt,
      });
      return cachedResult;
    }
  }

  try {
    const implementation = getToolImplementation(tool.function.name);
    result = await implementation(validation.value, context);
  } catch (error) {
    result = createResult({
      success: false,
      message:
        error instanceof Error ? error.message : "Tool execution failed.",
      error: "execution_error",
      blockType: "text",
    });
  }

  if (!isTenantIsolationExemptTool(tool.function.name)) {
    const tenantResultCheck = validateTenantIsolation(result, context.tenantId);
    if (!tenantResultCheck.valid) {
      await logCrossTenantAttempt(
        context,
        tool.function.name,
        tenantResultCheck.violationDetails ??
          "Post-execution tenant result validation failed.",
      );
      result = suppressCrossTenantResult();
    }
  }

  if (result.success && result.confirmation_required !== true) {
    if (tool.category === "mutation") {
      const entityType = mutationEntityType(tool.function.name);
      if (entityType) {
        cacheInvalidate(
          context.tenantId,
          entityType,
          context.cacheAuditScopeId,
        );
      }
    } else {
      if (isCacheableTool(tool.function.name)) {
        cacheSet(
          context.tenantId,
          tool.function.name,
          validation.value,
          result,
        );
      }
    }
  }

  await logToolExecution(context, {
    toolName: tool.function.name,
    input: logInput,
    output: resultToJsonObject(result),
    status: statusForResult(result),
    errorMessage: result.error,
    executionTimeMs: Date.now() - startedAt,
  });

  return result;
}
