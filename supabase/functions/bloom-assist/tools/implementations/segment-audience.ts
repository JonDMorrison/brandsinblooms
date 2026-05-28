import {
  SYSTEM_SEGMENTS,
  getSegmentById,
} from "../../../../../src/config/segmentDefinitions.ts";
import {
  SYSTEM_PERSONAS,
  getPersonaMatchCandidates,
  normalizePersonaMetadata,
  type PersonaRecord,
} from "../../../../../src/config/systemPersonas.ts";
import type { Database } from "../../../../../src/integrations/supabase/types.ts";
import { resolveEligibleEmailCustomerIds } from "../../../_shared/eligibleEmailAudience.ts";
import {
  collectReferencedSegmentIds,
  evaluateSegmentRule,
  normalizeSegmentRuleGroup,
  type SegmentRuleGroup,
} from "../../../_shared/segmentEvaluator.ts";
import type { JsonArray, JsonObject, JsonValue } from "../../types.ts";
import type {
  ConfirmationDetails,
  FilterOperator,
  ToolExecutionContext,
  ToolFilter,
  ToolImplementation,
  ToolName,
  ToolResult,
  ToolRiskLevel,
} from "../types.ts";
import { FILTER_OPERATORS } from "../types.ts";
import {
  getQueryClient,
  isJsonValue,
  isRecord,
  uniqueStrings,
  type BloomQueryClient,
} from "./shared.ts";

type SegmentRow = Database["public"]["Tables"]["crm_segments"]["Row"];
type SegmentInsert = Database["public"]["Tables"]["crm_segments"]["Insert"];
type SegmentUpdate = Database["public"]["Tables"]["crm_segments"]["Update"];
type CustomerRow = Pick<
  Database["public"]["Tables"]["crm_customers"]["Row"],
  | "id"
  | "tenant_id"
  | "email"
  | "first_name"
  | "last_name"
  | "phone"
  | "email_opt_in"
  | "sms_opt_in"
  | "suppressed"
  | "opt_out"
  | "created_at"
  | "updated_at"
  | "custom_fields"
  | "last_open_at"
  | "last_email_clicked_at"
  | "total_emails_opened"
  | "total_emails_clicked"
  | "total_emails_sent"
  | "email_click_rate"
  | "email_engagement_score"
  | "first_purchase_date"
  | "last_purchase_date"
  | "lifetime_value"
  | "total_spent"
  | "pos_order_count"
  | "persona"
  | "persona_id"
  | "preferred_channel"
  | "tags"
  | "product_tags"
  | "is_vip"
  | "order_history"
>;
type CustomerIdentityRow = Pick<
  Database["public"]["Tables"]["crm_customers"]["Row"],
  | "id"
  | "email"
  | "first_name"
  | "last_name"
  | "suppressed"
  | "opt_out"
  | "email_opt_in"
>;
type PersonaRow = Database["public"]["Tables"]["crm_personas"]["Row"];
type CustomerPersonaRow = Pick<
  Database["public"]["Tables"]["customer_personas"]["Row"],
  "customer_id" | "persona_id" | "predefined_persona_id"
>;
type SegmentMembershipRow = Pick<
  Database["public"]["Tables"]["customer_segments"]["Row"],
  "customer_id" | "segment_id"
>;
type CampaignUsageRow = {
  id: string;
  name: string;
  status: string | null;
};

type SegmentMutationToolName =
  | "create_segment"
  | "update_segment"
  | "assign_segment";
type SegmentKind = "dynamic" | "static";
type SegmentStatus = "draft" | "active" | "paused" | "archived";
type SegmentOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "greater_than"
  | "less_than"
  | "between"
  | "is"
  | "is_not"
  | "is_one_of"
  | "is_none_of"
  | "before"
  | "after"
  | "within_last"
  | "not_within_last"
  | "is_empty"
  | "is_not_empty";

type PendingConfirmation = {
  messageId: string;
  expiresAt: number;
};

type AudiencePreview = {
  matchingIds: string[];
  sampleCustomers: CustomerIdentityRow[];
  warnings: string[];
};

type ResolvedSegment = {
  id: string;
  name: string;
  customerCount: number;
  isSystem: boolean;
};

type ResolvedPersona = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
};

const CONFIRMATION_TTL_MS = 15 * 60 * 1000;
const PAGE_SIZE = 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEASONAL_TAGS = new Set([
  "seasonal",
  "holiday",
  "christmas",
  "valentine",
  "easter",
  "summer",
  "winter",
]);
const ACTIVE_CAMPAIGN_STATUSES = new Set([
  "scheduled",
  "queued",
  "partially_queued",
  "sending",
  "paused",
]);
const SEGMENT_STATUSES = new Set(["draft", "active", "paused", "archived"]);
const FILTER_OPERATOR_SET = new Set<string>(FILTER_OPERATORS);
const SYSTEM_SEGMENT_IDS = new Set(
  SYSTEM_SEGMENTS.map((segment) => segment.id),
);
const SYSTEM_PERSONA_BY_ID = new Map(
  SYSTEM_PERSONAS.map((persona) => [persona.id, persona]),
);
const SEGMENT_OPERATOR_SET = new Set<string>([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "greater_than",
  "less_than",
  "between",
  "is",
  "is_not",
  "is_one_of",
  "is_none_of",
  "before",
  "after",
  "within_last",
  "not_within_last",
  "is_empty",
  "is_not_empty",
]);

const pendingConfirmations = new Map<string, PendingConfirmation>();

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(readString).filter((item): item is string => Boolean(item))
    : [];
}

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function readChanges(params: JsonObject): JsonObject {
  return isRecord(params.changes) ? (params.changes as JsonObject) : {};
}

function jsonArray(values: string[]): JsonArray {
  return values.map((value) => value);
}

function toJsonObject(value: unknown): JsonObject | null {
  return isRecord(value) && Object.values(value).every(isJsonValue)
    ? (value as JsonObject)
    : null;
}

function toJsonValue(value: unknown): JsonValue | null {
  return isJsonValue(value) ? value : null;
}

function toDatabaseJson(value: JsonValue): SegmentInsert["conditions"] {
  return value as SegmentInsert["conditions"];
}

function sortJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, sortJsonValue(nestedValue)]),
  ) as JsonObject;
}

function confirmationKey(
  context: ToolExecutionContext,
  toolName: SegmentMutationToolName,
  params: JsonObject,
): string {
  return [
    context.tenantId,
    context.userId,
    context.conversationId,
    toolName,
    JSON.stringify(sortJsonValue(params)),
  ].join(":");
}

function shouldExecuteAfterConfirmation(
  context: ToolExecutionContext,
  toolName: SegmentMutationToolName,
  params: JsonObject,
): boolean {
  if (context.approved === true) {
    return true;
  }

  const key = confirmationKey(context, toolName, params);
  const pending = pendingConfirmations.get(key);
  const now = Date.now();

  if (!pending || pending.expiresAt <= now) {
    pendingConfirmations.delete(key);
    return false;
  }

  if (pending.messageId === context.messageId) {
    return false;
  }

  pendingConfirmations.delete(key);
  return true;
}

function rememberConfirmation(
  context: ToolExecutionContext,
  toolName: SegmentMutationToolName,
  params: JsonObject,
): string {
  const key = confirmationKey(context, toolName, params);
  pendingConfirmations.set(key, {
    messageId: context.messageId,
    expiresAt: Date.now() + CONFIRMATION_TTL_MS,
  });
  return key;
}

function createResult(args: {
  success: boolean;
  message: string;
  data?: JsonValue | null;
  count?: number | null;
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

function errorResult(
  message: string,
  error = "segment_tool_error",
): ToolResult {
  return createResult({
    success: false,
    message,
    error,
    blockType: "text",
  });
}

function confirmationResult(args: {
  toolName: SegmentMutationToolName;
  riskLevel: ToolRiskLevel;
  action: string;
  affectedCount: number | null;
  reversible: boolean;
  taskPlan: JsonObject;
  warnings: string[];
  approvalKey: string;
}): ToolResult {
  const confirmationDetails: ConfirmationDetails = {
    action: args.action,
    affected_count: args.affectedCount,
    reversible: args.reversible,
    risk_level: args.riskLevel,
    tool_name: args.toolName,
  };

  return createResult({
    success: true,
    message: args.action,
    blockType: "confirmation",
    confirmationRequired: true,
    confirmationDetails,
    data: {
      tool_name: args.toolName,
      risk_level: args.riskLevel,
      task_plan: args.taskPlan,
      warnings: args.warnings,
      approval_key: args.approvalKey,
      confirmation_details: {
        action: confirmationDetails.action,
        affected_count: confirmationDetails.affected_count,
        reversible: confirmationDetails.reversible,
        risk_level: confirmationDetails.risk_level,
        tool_name: confirmationDetails.tool_name,
      },
    },
  });
}

function getServiceClient(context: ToolExecutionContext): BloomQueryClient {
  return context.serviceClient as BloomQueryClient;
}

function normalizeSegmentKind(
  value: unknown,
  fallback?: SegmentKind,
): SegmentKind | null {
  const normalized = readString(value)?.toLowerCase();
  if (normalized === "dynamic" || normalized === "static") {
    return normalized;
  }

  return fallback ?? null;
}

function normalizeSegmentStatus(
  value: unknown,
  fallback: SegmentStatus = "active",
): SegmentStatus {
  const normalized = readString(value)?.toLowerCase();
  return normalized && SEGMENT_STATUSES.has(normalized)
    ? (normalized as SegmentStatus)
    : fallback;
}

function customerName(
  customer: Pick<CustomerIdentityRow, "first_name" | "last_name" | "email">,
): string {
  const fullName = [customer.first_name, customer.last_name]
    .filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    )
    .join(" ")
    .trim();

  return fullName || customer.email || "Unnamed customer";
}

function mapSegmentCard(segment: SegmentRow): JsonObject {
  return {
    id: segment.id,
    tenant_id: segment.tenant_id,
    name: segment.name,
    description: segment.description,
    type: segment.auto_update ? "dynamic" : "static",
    status: segment.status,
    include_all_customers: segment.include_all_customers,
    customer_count: segment.customer_count ?? 0,
    is_system_segment: segment.is_system_segment,
    persona_id: segment.persona_id,
    source: segment.source,
    source_id: segment.source_id,
    created_at: segment.created_at,
    updated_at: segment.updated_at,
  };
}

function isToolFilter(value: unknown): value is ToolFilter {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.field === "string" &&
    typeof value.operator === "string" &&
    FILTER_OPERATOR_SET.has(value.operator) &&
    (value.value === undefined || isJsonValue(value.value))
  );
}

function readFilters(value: unknown): ToolFilter[] {
  return Array.isArray(value) ? value.filter(isToolFilter) : [];
}

function segmentFieldFromFilter(field: string): string {
  switch (field) {
    case "segment":
      return "segment_membership";
    case "persona":
    case "persona_id":
      return "persona_membership";
    case "tag":
      return "tag_membership";
    default:
      return field;
  }
}

function segmentOperatorFromFilter(
  operator: FilterOperator,
): SegmentOperator | null {
  switch (operator) {
    case "equals":
      return "equals";
    case "not_equals":
      return "not_equals";
    case "contains":
      return "contains";
    case "not_contains":
      return "not_contains";
    case "starts_with":
      return "starts_with";
    case "ends_with":
      return "ends_with";
    case "gt":
      return "greater_than";
    case "lt":
      return "less_than";
    case "between":
      return "between";
    case "in":
      return "is_one_of";
    case "not_in":
      return "is_none_of";
    case "is_null":
      return "is_empty";
    case "is_not_null":
      return "is_not_empty";
    default:
      return null;
  }
}

function buildRuleGroupFromFilters(filters: ToolFilter[]): JsonObject {
  const children = filters.map((filter, index) => {
    const operatorId = segmentOperatorFromFilter(filter.operator);
    if (!operatorId) {
      throw new Error(
        `Filter operator ${filter.operator} cannot be stored as a dynamic segment rule.`,
      );
    }

    return {
      id: `bloom-rule-${index + 1}`,
      kind: "rule",
      fieldId: segmentFieldFromFilter(filter.field),
      operatorId,
      value: filter.value ?? null,
    } satisfies JsonObject;
  });

  return {
    id: "bloom-rule-group",
    kind: "group",
    operator: "AND",
    children: children.map((child) => child as JsonValue),
  };
}

function normalizeRulesFromSource(source: JsonObject): JsonObject {
  const rawRules = isRecord(source.rules)
    ? source.rules
    : isRecord(source.conditions)
      ? source.conditions
      : null;

  if (rawRules) {
    const normalized = normalizeSegmentRuleGroup(rawRules);
    const jsonValue = toJsonValue(normalized);
    if (!jsonValue || !isRecord(jsonValue)) {
      throw new Error("Segment rules must be JSON-compatible.");
    }
    return jsonValue as JsonObject;
  }

  return buildRuleGroupFromFilters(readFilters(source.filters));
}

function validateRuleGroup(group: SegmentRuleGroup): string[] {
  const issues: string[] = [];
  const normalized = normalizeSegmentRuleGroup(group);

  for (const child of normalized.children ?? []) {
    const maybeGroup = child as SegmentRuleGroup;
    if (
      Array.isArray(maybeGroup.children) ||
      Array.isArray(maybeGroup.conditions)
    ) {
      issues.push(...validateRuleGroup(maybeGroup));
      continue;
    }

    const record = child as {
      fieldId?: string | null;
      field?: string | null;
      operatorId?: string | null;
      operator?: string | null;
      value?: unknown;
    };
    const fieldId = record.fieldId ?? record.field ?? null;
    const operatorId = record.operatorId ?? record.operator ?? null;
    if (!fieldId || !operatorId) {
      issues.push("Every dynamic segment rule needs a field and operator.");
      continue;
    }

    if (!SEGMENT_OPERATOR_SET.has(operatorId)) {
      issues.push(`Unsupported dynamic segment operator: ${operatorId}.`);
    }
  }

  return issues;
}

function hasRules(group: SegmentRuleGroup): boolean {
  return (normalizeSegmentRuleGroup(group).children ?? []).length > 0;
}

async function fetchIdsPaged<Row>(
  queryFactory: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: Row[] | null; error: unknown }>,
  rowToId: (row: Row) => string | null,
): Promise<Set<string>> {
  const ids = new Set<string>();

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await queryFactory(from, to);
    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      const id = rowToId(row);
      if (id && isUuid(id)) {
        ids.add(id);
      }
    }

    if (!data || data.length < PAGE_SIZE) {
      break;
    }
  }

  return ids;
}

function chunkStrings(values: string[], chunkSize = 200): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}

async function fetchTenantCustomers(
  client: BloomQueryClient,
  tenantId: string,
): Promise<CustomerRow[]> {
  const { data, error } = await client
    .from("crm_customers")
    .select(
      `
      id,
      tenant_id,
      email,
      first_name,
      last_name,
      phone,
      email_opt_in,
      sms_opt_in,
      suppressed,
      opt_out,
      created_at,
      updated_at,
      custom_fields,
      last_open_at,
      last_email_clicked_at,
      total_emails_opened,
      total_emails_clicked,
      total_emails_sent,
      email_click_rate,
      email_engagement_score,
      first_purchase_date,
      last_purchase_date,
      lifetime_value,
      total_spent,
      pos_order_count,
      persona,
      persona_id,
      preferred_channel,
      tags,
      product_tags,
      is_vip,
      order_history
    `,
    )
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  return (data ?? []) as CustomerRow[];
}

async function fetchCustomersByIds(
  client: BloomQueryClient,
  tenantId: string,
  customerIds: string[],
): Promise<CustomerIdentityRow[]> {
  const customers: CustomerIdentityRow[] = [];
  const uniqueIds = uniqueStrings(customerIds).filter(isUuid);

  for (const chunk of chunkStrings(uniqueIds)) {
    const { data, error } = await client
      .from("crm_customers")
      .select(
        "id, email, first_name, last_name, suppressed, opt_out, email_opt_in",
      )
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .in("id", chunk);

    if (error) {
      throw error;
    }

    customers.push(...((data ?? []) as CustomerIdentityRow[]));
  }

  return customers;
}

async function fetchValidatedCustomerIds(
  client: BloomQueryClient,
  tenantId: string,
  customerIds: string[],
): Promise<Set<string>> {
  const customers = await fetchCustomersByIds(client, tenantId, customerIds);
  return new Set(customers.map((customer) => customer.id));
}

async function fetchTenantCustomerIds(
  client: BloomQueryClient,
  tenantId: string,
): Promise<Set<string>> {
  return await fetchIdsPaged(
    (from, to) =>
      client
        .from("crm_customers")
        .select("id")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .range(from, to),
    (row) => (isRecord(row) && typeof row.id === "string" ? row.id : null),
  );
}

async function loadTenantMembershipMap(
  client: BloomQueryClient,
  tenantId: string,
): Promise<Map<string, Set<string>>> {
  const { data: segments, error: segmentError } = await client
    .from("crm_segments")
    .select("id")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  if (segmentError) {
    throw segmentError;
  }

  const segmentIds = (segments ?? []).map((segment) => segment.id);
  const membershipsByCustomerId = new Map<string, Set<string>>();
  if (segmentIds.length === 0) {
    return membershipsByCustomerId;
  }

  for (const chunk of chunkStrings(segmentIds)) {
    const { data, error } = await client
      .from("customer_segments")
      .select("customer_id, segment_id")
      .in("segment_id", chunk);

    if (error) {
      throw error;
    }

    for (const membership of (data ?? []) as SegmentMembershipRow[]) {
      const next =
        membershipsByCustomerId.get(membership.customer_id) ??
        new Set<string>();
      next.add(membership.segment_id);
      membershipsByCustomerId.set(membership.customer_id, next);
    }
  }

  return membershipsByCustomerId;
}

async function fetchSegmentMemberIds(
  client: BloomQueryClient,
  segmentId: string,
): Promise<Set<string>> {
  return await fetchIdsPaged(
    (from, to) =>
      client
        .from("customer_segments")
        .select("customer_id")
        .eq("segment_id", segmentId)
        .range(from, to),
    (row) =>
      isRecord(row) && typeof row.customer_id === "string"
        ? row.customer_id
        : null,
  );
}

async function syncSegmentMemberships(
  client: BloomQueryClient,
  segmentId: string,
  targetCustomerIds: string[],
  assignedByUserId: string | null,
): Promise<{ added: number; removed: number; total: number }> {
  const targetIds = new Set(uniqueStrings(targetCustomerIds).filter(isUuid));
  const currentIds = await fetchSegmentMemberIds(client, segmentId);
  const idsToAdd = [...targetIds].filter((id) => !currentIds.has(id));
  const idsToRemove = [...currentIds].filter((id) => !targetIds.has(id));

  for (const chunk of chunkStrings(idsToRemove)) {
    const { error } = await client
      .from("customer_segments")
      .delete()
      .eq("segment_id", segmentId)
      .in("customer_id", chunk);

    if (error) {
      throw error;
    }
  }

  for (const chunk of chunkStrings(idsToAdd)) {
    const rows = chunk.map((customerId) => ({
      customer_id: customerId,
      segment_id: segmentId,
      assigned_by_user_id: assignedByUserId,
      assigned_at: new Date().toISOString(),
    }));
    const { error } = await client
      .from("customer_segments")
      .upsert(rows, { onConflict: "customer_id,segment_id" });

    if (error) {
      throw error;
    }
  }

  const { error: countError } = await client
    .from("crm_segments")
    .update({
      customer_count: targetIds.size,
      updated_at: new Date().toISOString(),
    })
    .eq("id", segmentId);

  if (countError) {
    throw countError;
  }

  return {
    added: idsToAdd.length,
    removed: idsToRemove.length,
    total: targetIds.size,
  };
}

async function validateNoCircularSegmentReference(
  client: BloomQueryClient,
  tenantId: string,
  currentSegmentId: string | null,
  group: SegmentRuleGroup,
): Promise<void> {
  if (!currentSegmentId) {
    return;
  }

  const directReferences = collectReferencedSegmentIds(group).filter(isUuid);
  if (directReferences.includes(currentSegmentId)) {
    throw new Error("A segment cannot reference itself in its dynamic rules.");
  }

  if (directReferences.length === 0) {
    return;
  }

  const { data, error } = await client
    .from("crm_segments")
    .select("id, conditions")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  const dependencyMap = new Map<string, string[]>();
  for (const segment of data ?? []) {
    dependencyMap.set(
      segment.id,
      collectReferencedSegmentIds(
        normalizeSegmentRuleGroup(segment.conditions),
      ).filter(isUuid),
    );
  }

  const stack = [...directReferences];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const next = stack.pop();
    if (!next || visited.has(next)) {
      continue;
    }
    visited.add(next);
    if (next === currentSegmentId) {
      throw new Error(
        "The proposed segment rules would create a circular segment reference.",
      );
    }
    for (const dependency of dependencyMap.get(next) ?? []) {
      stack.push(dependency);
    }
  }
}

async function previewDynamicAudience(
  client: BloomQueryClient,
  context: ToolExecutionContext,
  args: {
    rules: JsonObject;
    includeAllCustomers: boolean;
    currentSegmentId: string | null;
  },
): Promise<AudiencePreview> {
  const customers = await fetchTenantCustomers(client, context.tenantId);
  const warnings: string[] = [];

  if (args.includeAllCustomers) {
    const eligibleIds = await resolveEligibleEmailCustomerIds(client, {
      tenantId: context.tenantId,
      customers: customers.filter(
        (customer) => customer.suppressed !== true && customer.opt_out !== true,
      ),
    });
    const matchingIds = [...eligibleIds];
    const sampleCustomers = await fetchCustomersByIds(
      client,
      context.tenantId,
      matchingIds.slice(0, 5),
    );
    return { matchingIds, sampleCustomers, warnings };
  }

  const normalizedRules = normalizeSegmentRuleGroup(args.rules);
  const ruleIssues = validateRuleGroup(normalizedRules);
  if (ruleIssues.length > 0) {
    throw new Error(ruleIssues[0]);
  }
  if (!hasRules(normalizedRules)) {
    return { matchingIds: [], sampleCustomers: [], warnings };
  }

  await validateNoCircularSegmentReference(
    client,
    context.tenantId,
    args.currentSegmentId,
    normalizedRules,
  );

  const membershipsByCustomerId = await loadTenantMembershipMap(
    client,
    context.tenantId,
  );
  const matchingCustomers = customers.filter((customer) =>
    evaluateSegmentRule(normalizedRules, customer as Record<string, unknown>, {
      customerSegmentsByCustomerId: membershipsByCustomerId,
    }),
  );

  const referencedIds =
    collectReferencedSegmentIds(normalizedRules).filter(isUuid);
  if (referencedIds.length > 0) {
    const { data, error } = await client
      .from("crm_segments")
      .select("id")
      .eq("tenant_id", context.tenantId)
      .is("deleted_at", null)
      .in("id", referencedIds);

    if (error) {
      throw error;
    }

    const foundIds = new Set((data ?? []).map((segment) => segment.id));
    for (const referencedId of referencedIds) {
      if (!foundIds.has(referencedId)) {
        warnings.push(
          `Referenced segment was not found for this tenant: ${referencedId}.`,
        );
      }
    }
  }

  return {
    matchingIds: matchingCustomers.map((customer) => customer.id),
    sampleCustomers: matchingCustomers.slice(0, 5),
    warnings,
  };
}

async function fetchSegment(
  client: BloomQueryClient,
  tenantId: string,
  segmentId: string,
): Promise<SegmentRow | null> {
  const { data, error } = await client
    .from("crm_segments")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", segmentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as SegmentRow | null;
}

async function findDuplicateSegmentName(
  client: BloomQueryClient,
  tenantId: string,
  name: string,
  excludeSegmentId?: string,
): Promise<string | null> {
  let query = client
    .from("crm_segments")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .ilike("name", name.trim())
    .limit(1);

  if (excludeSegmentId) {
    query = query.neq("id", excludeSegmentId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return data?.[0]?.name ?? null;
}

async function loadSegmentUsage(
  client: BloomQueryClient,
  tenantId: string,
  segmentId: string,
): Promise<JsonArray> {
  const usage: JsonObject[] = [];
  const [campaignsResult, smsCampaignsResult, campaignSegmentsResult] =
    await Promise.all([
      client
        .from("crm_campaigns")
        .select("id, name, status")
        .eq("tenant_id", tenantId)
        .eq("segment_id", segmentId),
      client
        .from("crm_sms_campaigns")
        .select("id, name, status")
        .eq("tenant_id", tenantId)
        .eq("segment_id", segmentId),
      client
        .from("campaign_segments")
        .select("campaign_id")
        .eq("segment_id", segmentId),
    ]);

  if (campaignsResult.error) throw campaignsResult.error;
  if (smsCampaignsResult.error) throw smsCampaignsResult.error;
  if (campaignSegmentsResult.error) throw campaignSegmentsResult.error;

  for (const campaign of (campaignsResult.data ?? []) as CampaignUsageRow[]) {
    if (campaign.status && ACTIVE_CAMPAIGN_STATUSES.has(campaign.status)) {
      usage.push({
        id: campaign.id,
        kind: "campaign",
        name: campaign.name,
        status: campaign.status,
      });
    }
  }

  for (const campaign of (smsCampaignsResult.data ??
    []) as CampaignUsageRow[]) {
    if (campaign.status && ACTIVE_CAMPAIGN_STATUSES.has(campaign.status)) {
      usage.push({
        id: campaign.id,
        kind: "sms_campaign",
        name: campaign.name,
        status: campaign.status,
      });
    }
  }

  const campaignIds = uniqueStrings(
    (campaignSegmentsResult.data ?? []).map((row) =>
      readString(row.campaign_id),
    ),
  );
  if (campaignIds.length > 0) {
    const { data, error } = await client
      .from("crm_campaigns")
      .select("id, name, status")
      .eq("tenant_id", tenantId)
      .in("id", campaignIds);

    if (error) {
      throw error;
    }

    for (const campaign of (data ?? []) as CampaignUsageRow[]) {
      if (campaign.status && ACTIVE_CAMPAIGN_STATUSES.has(campaign.status)) {
        usage.push({
          id: campaign.id,
          kind: "campaign",
          name: campaign.name,
          status: campaign.status,
        });
      }
    }
  }

  return usage;
}

async function createSegmentExecution(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const client = getServiceClient(context);
  const queryClient = getQueryClient(context);
  const name = readString(params.name);
  if (!name) {
    return errorResult("Segment name is required.", "validation_error");
  }

  const kind = normalizeSegmentKind(params.kind ?? params.type);
  if (!kind) {
    return errorResult(
      "Segment kind must be dynamic or static.",
      "validation_error",
    );
  }

  const duplicate = await findDuplicateSegmentName(
    queryClient,
    context.tenantId,
    name,
  );
  if (duplicate) {
    return errorResult(
      "A segment with this name already exists.",
      "duplicate_segment",
    );
  }

  const includeAllCustomers = readBoolean(params.include_all_customers);
  const rules = normalizeRulesFromSource(params);
  const memberIds = uniqueStrings([
    ...readStringArray(params.member_ids),
    ...readStringArray(params.customer_ids),
  ]).filter(isUuid);
  const preview =
    kind === "dynamic"
      ? await previewDynamicAudience(queryClient, context, {
          rules,
          includeAllCustomers,
          currentSegmentId: null,
        })
      : {
          matchingIds: [
            ...(await fetchValidatedCustomerIds(
              queryClient,
              context.tenantId,
              memberIds,
            )),
          ],
          sampleCustomers: await fetchCustomersByIds(
            queryClient,
            context.tenantId,
            memberIds.slice(0, 5),
          ),
          warnings: [],
        };

  const nowIso = new Date().toISOString();
  const insertPayload: SegmentInsert = {
    tenant_id: context.tenantId,
    user_id: context.userId,
    name,
    description: readString(params.description),
    auto_update: kind === "dynamic",
    conditions: toDatabaseJson(rules),
    include_all_customers: includeAllCustomers,
    status: normalizeSegmentStatus(params.status),
    customer_count: preview.matchingIds.length,
    updated_at: nowIso,
  };

  const { data, error } = await client
    .from("crm_segments")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const segment = data as SegmentRow;
  if (preview.matchingIds.length > 0) {
    await syncSegmentMemberships(
      client,
      segment.id,
      preview.matchingIds,
      kind === "static" ? context.userId : null,
    );
  }

  const refreshed = await fetchSegment(client, context.tenantId, segment.id);
  const card = refreshed ? mapSegmentCard(refreshed) : mapSegmentCard(segment);
  return createResult({
    success: true,
    message: `Created ${kind} segment "${segment.name}" with ${preview.matchingIds.length.toLocaleString()} matching customers.`,
    blockType: "data_card",
    data: card,
    count: 1,
  });
}

export const createSegment: ToolImplementation = async (params, context) => {
  if (shouldExecuteAfterConfirmation(context, "create_segment", params)) {
    return await createSegmentExecution(params, context);
  }

  const queryClient = getQueryClient(context);
  const name = readString(params.name);
  if (!name) {
    return errorResult("Segment name is required.", "validation_error");
  }

  const kind = normalizeSegmentKind(params.kind ?? params.type);
  if (!kind) {
    return errorResult(
      "Segment kind must be dynamic or static.",
      "validation_error",
    );
  }

  const rules = normalizeRulesFromSource(params);
  const includeAllCustomers = readBoolean(params.include_all_customers);
  const memberIds = uniqueStrings([
    ...readStringArray(params.member_ids),
    ...readStringArray(params.customer_ids),
  ]).filter(isUuid);
  const duplicate = await findDuplicateSegmentName(
    queryClient,
    context.tenantId,
    name,
  );
  const preview =
    kind === "dynamic"
      ? await previewDynamicAudience(queryClient, context, {
          rules,
          includeAllCustomers,
          currentSegmentId: null,
        })
      : {
          matchingIds: [
            ...(await fetchValidatedCustomerIds(
              queryClient,
              context.tenantId,
              memberIds,
            )),
          ],
          sampleCustomers: await fetchCustomersByIds(
            queryClient,
            context.tenantId,
            memberIds.slice(0, 5),
          ),
          warnings: [],
        };
  const warnings = [...preview.warnings];
  if (duplicate) {
    warnings.push(`A segment with this name already exists: "${duplicate}".`);
  }

  const approvalKey = rememberConfirmation(context, "create_segment", params);
  return confirmationResult({
    toolName: "create_segment",
    riskLevel: "low",
    action: `Create ${kind} segment "${name}".`,
    affectedCount: preview.matchingIds.length,
    reversible: true,
    warnings,
    approvalKey,
    taskPlan: {
      operation: "create_segment",
      segment: {
        name,
        type: kind,
        status: normalizeSegmentStatus(params.status),
        include_all_customers: includeAllCustomers,
      },
      preview: {
        matching_customer_count: preview.matchingIds.length,
        sample_customers: preview.sampleCustomers.map((customer) => ({
          id: customer.id,
          name: customerName(customer),
          email: customer.email,
        })),
      },
      steps: [
        "Insert a crm_segments row scoped to the current tenant and user.",
        "Materialize matching customer_segments rows for the previewed audience.",
        "Refresh crm_segments.customer_count for the new segment.",
      ],
    },
  });
};

function fieldDiff(
  label: string,
  currentValue: unknown,
  proposedValue: unknown,
): JsonObject | null {
  if (proposedValue === undefined || proposedValue === null) {
    return null;
  }

  const currentText =
    currentValue === null || currentValue === undefined
      ? null
      : String(currentValue);
  const proposedText = String(proposedValue);
  if (currentText === proposedText) {
    return null;
  }

  return { field: label, current: currentText, proposed: proposedText };
}

function hasRuleChange(changes: JsonObject): boolean {
  return "filters" in changes || "rules" in changes || "conditions" in changes;
}

async function updateSegmentExecution(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const segmentId = readString(params.segment_id);
  if (!segmentId) {
    return errorResult("segment_id is required.", "validation_error");
  }

  const queryClient = getQueryClient(context);
  const client = getServiceClient(context);
  const segment = await fetchSegment(queryClient, context.tenantId, segmentId);
  if (!segment) {
    return errorResult("Segment not found for this tenant.", "not_found");
  }
  if (segment.is_system_segment) {
    return errorResult(
      "System segments cannot be updated through Bloom.",
      "invalid_segment",
    );
  }

  const changes = readChanges(params);
  const proposedName = readString(changes.name) ?? segment.name;
  const proposedKind = normalizeSegmentKind(
    changes.kind ?? changes.type,
    typeof changes.auto_update === "boolean"
      ? changes.auto_update
        ? "dynamic"
        : "static"
      : segment.auto_update
        ? "dynamic"
        : "static",
  );
  if (!proposedKind) {
    return errorResult(
      "Segment kind must be dynamic or static.",
      "validation_error",
    );
  }

  const duplicate =
    proposedName !== segment.name
      ? await findDuplicateSegmentName(
          queryClient,
          context.tenantId,
          proposedName,
          segmentId,
        )
      : null;
  if (duplicate) {
    return errorResult(
      "A segment with this name already exists.",
      "duplicate_segment",
    );
  }

  const rules = hasRuleChange(changes)
    ? normalizeRulesFromSource(changes)
    : (toJsonObject(segment.conditions) ?? {
        id: "bloom-empty-group",
        kind: "group",
        operator: "AND",
        children: [],
      });
  const includeAllCustomers =
    typeof changes.include_all_customers === "boolean"
      ? changes.include_all_customers
      : segment.include_all_customers;
  const memberIds = uniqueStrings([
    ...readStringArray(changes.member_ids),
    ...readStringArray(changes.customer_ids),
  ]).filter(isUuid);
  const hasMemberList =
    memberIds.length > 0 ||
    "member_ids" in changes ||
    "customer_ids" in changes;
  const preview =
    proposedKind === "dynamic"
      ? await previewDynamicAudience(queryClient, context, {
          rules,
          includeAllCustomers,
          currentSegmentId: segmentId,
        })
      : {
          matchingIds: hasMemberList
            ? [
                ...(await fetchValidatedCustomerIds(
                  queryClient,
                  context.tenantId,
                  memberIds,
                )),
              ]
            : [...(await fetchSegmentMemberIds(queryClient, segmentId))],
          sampleCustomers: hasMemberList
            ? await fetchCustomersByIds(
                queryClient,
                context.tenantId,
                memberIds.slice(0, 5),
              )
            : await fetchCustomersByIds(
                queryClient,
                context.tenantId,
                [
                  ...(await fetchSegmentMemberIds(queryClient, segmentId)),
                ].slice(0, 5),
              ),
          warnings: [],
        };

  const payload: SegmentUpdate = {
    name: proposedName,
    description:
      "description" in changes
        ? readString(changes.description)
        : segment.description,
    auto_update: proposedKind === "dynamic",
    conditions: toDatabaseJson(rules),
    include_all_customers: includeAllCustomers,
    status: normalizeSegmentStatus(
      changes.status,
      normalizeSegmentStatus(segment.status),
    ),
    customer_count: preview.matchingIds.length,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("crm_segments")
    .update(payload)
    .eq("id", segmentId)
    .eq("tenant_id", context.tenantId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await syncSegmentMemberships(
    client,
    segmentId,
    preview.matchingIds,
    proposedKind === "static" ? context.userId : null,
  );

  const refreshed = await fetchSegment(client, context.tenantId, segmentId);
  return createResult({
    success: true,
    message: `Updated segment "${(data as SegmentRow).name}" with ${preview.matchingIds.length.toLocaleString()} matching customers.`,
    blockType: "data_card",
    data: refreshed
      ? mapSegmentCard(refreshed)
      : mapSegmentCard(data as SegmentRow),
    count: 1,
  });
}

export const updateSegment: ToolImplementation = async (params, context) => {
  if (shouldExecuteAfterConfirmation(context, "update_segment", params)) {
    return await updateSegmentExecution(params, context);
  }

  const segmentId = readString(params.segment_id);
  if (!segmentId) {
    return errorResult("segment_id is required.", "validation_error");
  }

  const client = getQueryClient(context);
  const segment = await fetchSegment(client, context.tenantId, segmentId);
  if (!segment) {
    return errorResult("Segment not found for this tenant.", "not_found");
  }
  if (segment.is_system_segment) {
    return errorResult(
      "System segments cannot be updated through Bloom.",
      "invalid_segment",
    );
  }

  const changes = readChanges(params);
  const proposedKind = normalizeSegmentKind(
    changes.kind ?? changes.type,
    typeof changes.auto_update === "boolean"
      ? changes.auto_update
        ? "dynamic"
        : "static"
      : segment.auto_update
        ? "dynamic"
        : "static",
  );
  if (!proposedKind) {
    return errorResult(
      "Segment kind must be dynamic or static.",
      "validation_error",
    );
  }

  const rules = hasRuleChange(changes)
    ? normalizeRulesFromSource(changes)
    : (toJsonObject(segment.conditions) ?? {
        id: "bloom-empty-group",
        kind: "group",
        operator: "AND",
        children: [],
      });
  const includeAllCustomers =
    typeof changes.include_all_customers === "boolean"
      ? changes.include_all_customers
      : segment.include_all_customers;
  const memberIds = uniqueStrings([
    ...readStringArray(changes.member_ids),
    ...readStringArray(changes.customer_ids),
  ]).filter(isUuid);
  const hasMemberList =
    memberIds.length > 0 ||
    "member_ids" in changes ||
    "customer_ids" in changes;
  const preview =
    proposedKind === "dynamic"
      ? await previewDynamicAudience(client, context, {
          rules,
          includeAllCustomers,
          currentSegmentId: segmentId,
        })
      : {
          matchingIds: hasMemberList
            ? [
                ...(await fetchValidatedCustomerIds(
                  client,
                  context.tenantId,
                  memberIds,
                )),
              ]
            : [...(await fetchSegmentMemberIds(client, segmentId))],
          sampleCustomers: hasMemberList
            ? await fetchCustomersByIds(
                client,
                context.tenantId,
                memberIds.slice(0, 5),
              )
            : await fetchCustomersByIds(
                client,
                context.tenantId,
                [...(await fetchSegmentMemberIds(client, segmentId))].slice(
                  0,
                  5,
                ),
              ),
          warnings: [],
        };
  const usage = await loadSegmentUsage(client, context.tenantId, segmentId);
  const proposedName = readString(changes.name) ?? segment.name;
  const duplicate =
    proposedName !== segment.name
      ? await findDuplicateSegmentName(
          client,
          context.tenantId,
          proposedName,
          segmentId,
        )
      : null;
  const warnings = [...preview.warnings];
  if (duplicate) {
    warnings.push(`A segment with this name already exists: "${duplicate}".`);
  }
  if (usage.length > 0) {
    warnings.push("This segment is used by scheduled or in-flight campaigns.");
  }

  const approvalKey = rememberConfirmation(context, "update_segment", params);
  return confirmationResult({
    toolName: "update_segment",
    riskLevel: "medium",
    action: `Update segment "${segment.name}".`,
    affectedCount: preview.matchingIds.length,
    reversible: true,
    warnings,
    approvalKey,
    taskPlan: {
      operation: "update_segment",
      segment_id: segment.id,
      current: {
        name: segment.name,
        type: segment.auto_update ? "dynamic" : "static",
        status: segment.status,
        customer_count: segment.customer_count ?? 0,
      },
      proposed: {
        name: proposedName,
        type: proposedKind,
        status: normalizeSegmentStatus(
          changes.status,
          normalizeSegmentStatus(segment.status),
        ),
        include_all_customers: includeAllCustomers,
        matching_customer_count: preview.matchingIds.length,
      },
      field_diffs: [
        fieldDiff("Name", segment.name, changes.name),
        fieldDiff("Description", segment.description, changes.description),
        fieldDiff(
          "Type",
          segment.auto_update ? "dynamic" : "static",
          changes.kind ?? changes.type,
        ),
        fieldDiff("Status", segment.status, changes.status),
        fieldDiff(
          "Include all customers",
          segment.include_all_customers,
          changes.include_all_customers,
        ),
      ].filter((diff): diff is JsonObject => Boolean(diff)),
      usage,
      sample_customers: preview.sampleCustomers.map((customer) => ({
        id: customer.id,
        name: customerName(customer),
        email: customer.email,
      })),
      steps: [
        "Update crm_segments fields scoped to the current tenant.",
        "Recompute and sync customer_segments membership rows for the proposed audience.",
        "Refresh crm_segments.customer_count for the updated segment.",
      ],
    },
  });
};

async function assignSegmentExecution(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const segmentId = readString(params.segment_id);
  const action = readString(params.action);
  const customerIds = uniqueStrings(
    readStringArray(params.customer_ids),
  ).filter(isUuid);
  if (!segmentId || !action || customerIds.length === 0) {
    return errorResult(
      "segment_id, customer_ids, and action are required.",
      "validation_error",
    );
  }
  if (action !== "add" && action !== "remove") {
    return errorResult("action must be add or remove.", "validation_error");
  }

  const client = getServiceClient(context);
  const queryClient = getQueryClient(context);
  const segment = await fetchSegment(queryClient, context.tenantId, segmentId);
  if (!segment) {
    return errorResult("Segment not found for this tenant.", "not_found");
  }
  if (segment.auto_update) {
    return errorResult(
      "Dynamic segment memberships are managed automatically.",
      "invalid_segment",
    );
  }

  const customers = await fetchCustomersByIds(
    queryClient,
    context.tenantId,
    customerIds,
  );
  const validIds = new Set(customers.map((customer) => customer.id));
  const missingIds = customerIds.filter(
    (customerId) => !validIds.has(customerId),
  );
  if (missingIds.length > 0) {
    return errorResult(
      "One or more customer IDs were not found for this tenant.",
      "not_found",
    );
  }

  if (action === "add") {
    for (const chunk of chunkStrings(customerIds)) {
      const rows = chunk.map((customerId) => ({
        customer_id: customerId,
        segment_id: segmentId,
        assigned_at: new Date().toISOString(),
        assigned_by_user_id: context.userId,
      }));
      const { error } = await client
        .from("customer_segments")
        .upsert(rows, { onConflict: "customer_id,segment_id" });

      if (error) {
        throw error;
      }
    }
  } else {
    for (const chunk of chunkStrings(customerIds)) {
      const { error } = await client
        .from("customer_segments")
        .delete()
        .eq("segment_id", segmentId)
        .in("customer_id", chunk);

      if (error) {
        throw error;
      }
    }
  }

  const finalIds = await fetchSegmentMemberIds(client, segmentId);
  const { error: countError } = await client
    .from("crm_segments")
    .update({
      customer_count: finalIds.size,
      updated_at: new Date().toISOString(),
    })
    .eq("id", segmentId)
    .eq("tenant_id", context.tenantId);

  if (countError) {
    throw countError;
  }

  return createResult({
    success: true,
    message: `${action === "add" ? "Added" : "Removed"} ${customerIds.length.toLocaleString()} customers ${action === "add" ? "to" : "from"} "${segment.name}".`,
    blockType: "data_card",
    data: {
      tenant_id: context.tenantId,
      segment_id: segment.id,
      segment_name: segment.name,
      action,
      affected_customer_count: customerIds.length,
      customer_count: finalIds.size,
      customers: customers.slice(0, 10).map((customer) => ({
        id: customer.id,
        name: customerName(customer),
        email: customer.email,
      })),
    },
    count: finalIds.size,
  });
}

export const assignSegment: ToolImplementation = async (params, context) => {
  if (shouldExecuteAfterConfirmation(context, "assign_segment", params)) {
    return await assignSegmentExecution(params, context);
  }

  const segmentId = readString(params.segment_id);
  const action = readString(params.action);
  const customerIds = uniqueStrings(
    readStringArray(params.customer_ids),
  ).filter(isUuid);
  if (!segmentId || !action || customerIds.length === 0) {
    return errorResult(
      "segment_id, customer_ids, and action are required.",
      "validation_error",
    );
  }
  if (action !== "add" && action !== "remove") {
    return errorResult("action must be add or remove.", "validation_error");
  }

  const client = getQueryClient(context);
  const segment = await fetchSegment(client, context.tenantId, segmentId);
  if (!segment) {
    return errorResult("Segment not found for this tenant.", "not_found");
  }
  if (segment.auto_update) {
    return errorResult(
      "Dynamic segment memberships are managed automatically.",
      "invalid_segment",
    );
  }

  const customers = await fetchCustomersByIds(
    client,
    context.tenantId,
    customerIds,
  );
  const validIds = new Set(customers.map((customer) => customer.id));
  const missingIds = customerIds.filter(
    (customerId) => !validIds.has(customerId),
  );
  const currentIds = await fetchSegmentMemberIds(client, segmentId);
  const effectiveIds =
    action === "add"
      ? customerIds.filter((customerId) => !currentIds.has(customerId))
      : customerIds.filter((customerId) => currentIds.has(customerId));
  const projectedCount =
    action === "add"
      ? currentIds.size + effectiveIds.length
      : Math.max(0, currentIds.size - effectiveIds.length);
  const warnings =
    missingIds.length > 0
      ? [
          "Some customer IDs were not found for this tenant and will block execution.",
        ]
      : [];
  const approvalKey = rememberConfirmation(context, "assign_segment", params);

  return confirmationResult({
    toolName: "assign_segment",
    riskLevel: "medium",
    action: `${action === "add" ? "Add" : "Remove"} ${customerIds.length.toLocaleString()} customers ${action === "add" ? "to" : "from"} "${segment.name}".`,
    affectedCount: effectiveIds.length,
    reversible: true,
    warnings,
    approvalKey,
    taskPlan: {
      operation: "assign_segment",
      segment_id: segment.id,
      segment_name: segment.name,
      action,
      requested_customer_count: customerIds.length,
      effective_customer_count: effectiveIds.length,
      current_customer_count: currentIds.size,
      projected_customer_count: projectedCount,
      sample_customers: customers.slice(0, 3).map((customer) => ({
        id: customer.id,
        name: customerName(customer),
        email: customer.email,
      })),
      missing_customer_ids: jsonArray(missingIds),
      steps: [
        action === "add"
          ? "Upsert customer_segments rows using customer_id,segment_id conflict handling."
          : "Delete matching customer_segments rows for the selected customers.",
        "Refresh crm_segments.customer_count after membership changes.",
      ],
    },
  });
};

function normalizeEmail(value: string | null): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getArrayValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }
  if (value === null || value === undefined || value === "") {
    return [];
  }
  return [String(value)];
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function customerValue(customer: CustomerRow, filter: ToolFilter): unknown {
  switch (filter.field) {
    case "segment":
      return customer.id;
    case "persona":
    case "persona_id":
      return customer.persona_id ?? customer.persona;
    case "tag":
    case "product_tag":
      return [
        ...getArrayValue(customer.tags),
        ...getArrayValue(customer.product_tags),
      ];
    default:
      return customer[filter.field as keyof CustomerRow] ?? null;
  }
}

function comparePrimitive(left: unknown, right: unknown): number | null {
  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);
  if (leftNumber !== null && rightNumber !== null) {
    return leftNumber - rightNumber;
  }

  const leftDate = parseDate(left);
  const rightDate = parseDate(right);
  if (leftDate && rightDate) {
    return leftDate.getTime() - rightDate.getTime();
  }

  return null;
}

function normalizedText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function filterMatchesCustomer(
  customer: CustomerRow,
  filter: ToolFilter,
): boolean {
  const value = customerValue(customer, filter);
  const expected = filter.value;
  const valueText = normalizedText(value);
  const expectedText = normalizedText(expected);
  const comparison = comparePrimitive(value, expected);

  switch (filter.operator) {
    case "equals":
      return valueText === expectedText;
    case "not_equals":
      return valueText !== expectedText;
    case "contains":
      return Array.isArray(value)
        ? value.map(normalizedText).includes(expectedText)
        : valueText.includes(expectedText);
    case "not_contains":
      return Array.isArray(value)
        ? !value.map(normalizedText).includes(expectedText)
        : !valueText.includes(expectedText);
    case "starts_with":
      return valueText.startsWith(expectedText);
    case "ends_with":
      return valueText.endsWith(expectedText);
    case "gt":
      return comparison !== null && comparison > 0;
    case "lt":
      return comparison !== null && comparison < 0;
    case "gte":
      return comparison !== null && comparison >= 0;
    case "lte":
      return comparison !== null && comparison <= 0;
    case "between": {
      if (!Array.isArray(expected) || expected.length !== 2) {
        return false;
      }
      const lower = comparePrimitive(value, expected[0]);
      const upper = comparePrimitive(value, expected[1]);
      return lower !== null && upper !== null && lower >= 0 && upper <= 0;
    }
    case "in":
      return (
        Array.isArray(expected) &&
        expected.map(normalizedText).includes(valueText)
      );
    case "not_in":
      return (
        Array.isArray(expected) &&
        !expected.map(normalizedText).includes(valueText)
      );
    case "is_null":
      return value === null || value === undefined || value === "";
    case "is_not_null":
      return value !== null && value !== undefined && value !== "";
    default:
      return false;
  }
}

async function resolveCustomSegments(
  client: BloomQueryClient,
  tenantId: string,
  ids: string[],
  names: string[],
): Promise<{ segments: ResolvedSegment[]; warnings: string[] }> {
  const warnings: string[] = [];
  const resolved = new Map<string, ResolvedSegment>();
  const customIds = ids.filter(isUuid);
  const systemIds = ids.filter(
    (id) => !isUuid(id) && SYSTEM_SEGMENT_IDS.has(id),
  );

  for (const systemId of systemIds) {
    const definition = getSegmentById(systemId);
    if (definition) {
      resolved.set(systemId, {
        id: systemId,
        name: definition.name,
        customerCount: 0,
        isSystem: true,
      });
    }
  }

  if (customIds.length > 0) {
    const { data, error } = await client
      .from("crm_segments")
      .select("id, name, customer_count")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .in("id", customIds);

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      resolved.set(row.id, {
        id: row.id,
        name: row.name,
        customerCount: row.customer_count ?? 0,
        isSystem: false,
      });
    }

    for (const id of customIds) {
      if (!resolved.has(id)) {
        warnings.push(`Segment was not found for ID ${id}.`);
      }
    }
  }

  for (const name of names) {
    const systemMatch = SYSTEM_SEGMENTS.find(
      (segment) => segment.name.toLowerCase() === name.toLowerCase(),
    );
    if (systemMatch) {
      resolved.set(systemMatch.id, {
        id: systemMatch.id,
        name: systemMatch.name,
        customerCount: 0,
        isSystem: true,
      });
      continue;
    }

    const { data, error } = await client
      .from("crm_segments")
      .select("id, name, customer_count")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .ilike("name", name)
      .limit(1);

    if (error) {
      throw error;
    }

    const segment = data?.[0];
    if (!segment) {
      warnings.push(`Segment name did not match an active segment: ${name}.`);
      continue;
    }

    resolved.set(segment.id, {
      id: segment.id,
      name: segment.name,
      customerCount: segment.customer_count ?? 0,
      isSystem: false,
    });
  }

  return { segments: [...resolved.values()], warnings };
}

async function fetchCustomSegmentCustomerIds(
  client: BloomQueryClient,
  tenantId: string,
  segmentIds: string[],
): Promise<Set<string>> {
  if (segmentIds.length === 0) {
    return new Set();
  }

  const rawIds = await fetchIdsPaged(
    (from, to) =>
      client
        .from("customer_segments")
        .select("customer_id")
        .in("segment_id", segmentIds)
        .range(from, to),
    (row) =>
      isRecord(row) && typeof row.customer_id === "string"
        ? row.customer_id
        : null,
  );
  return await fetchValidatedCustomerIds(client, tenantId, [...rawIds]);
}

async function fetchSystemSegmentCustomerIds(
  client: BloomQueryClient,
  tenantId: string,
  segmentIds: string[],
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>(
    segmentIds.map((id) => [id, new Set<string>()]),
  );
  if (segmentIds.length === 0) {
    return result;
  }

  const { data, error } = await client
    .from("crm_customers")
    .select(
      "id, tags, total_spent, created_at, last_purchase_date, order_history",
    )
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  const customers = (data ?? []) as Pick<
    CustomerRow,
    | "id"
    | "tags"
    | "total_spent"
    | "created_at"
    | "last_purchase_date"
    | "order_history"
  >[];
  const customerIds = customers.map((customer) => customer.id);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  for (const customer of customers) {
    const tags = getArrayValue(customer.tags).map((tag) => tag.toLowerCase());
    if (segmentIds.includes("loyalty-members") && tags.includes("loyalty")) {
      result.get("loyalty-members")?.add(customer.id);
    }
    if (
      segmentIds.includes("high-value") &&
      Number(customer.total_spent ?? 0) > 500
    ) {
      result.get("high-value")?.add(customer.id);
    }
    const createdAt = parseDate(customer.created_at);
    if (
      segmentIds.includes("new-customers") &&
      createdAt &&
      createdAt >= thirtyDaysAgo
    ) {
      result.get("new-customers")?.add(customer.id);
    }
    const lastPurchase = parseDate(customer.last_purchase_date);
    if (
      segmentIds.includes("lapsed-customers") &&
      lastPurchase &&
      lastPurchase < ninetyDaysAgo
    ) {
      result.get("lapsed-customers")?.add(customer.id);
    }
    if (
      segmentIds.includes("seasonal-shoppers") &&
      tags.some((tag) => SEASONAL_TAGS.has(tag))
    ) {
      result.get("seasonal-shoppers")?.add(customer.id);
    }
    if (
      segmentIds.includes("frequent-buyers") &&
      Array.isArray(customer.order_history) &&
      customer.order_history.length >= 3
    ) {
      result.get("frequent-buyers")?.add(customer.id);
    }
  }

  if (segmentIds.includes("perks-members") && customerIds.length > 0) {
    for (const chunk of chunkStrings(customerIds)) {
      const { data: perksRows, error: perksError } = await client
        .from("customer_loyalty_metrics")
        .select("customer_id")
        .eq("is_perks_member", true)
        .in("customer_id", chunk);

      if (perksError) {
        throw perksError;
      }

      for (const row of perksRows ?? []) {
        if (typeof row.customer_id === "string") {
          result.get("perks-members")?.add(row.customer_id);
        }
      }
    }
  }

  const rawMembershipRows: SegmentMembershipRow[] = [];
  for (const chunk of chunkStrings(customerIds)) {
    const { data: membershipRows, error: membershipError } = await client
      .from("customer_segments")
      .select("customer_id, segment_id")
      .in("customer_id", chunk);

    if (membershipError) {
      throw membershipError;
    }

    rawMembershipRows.push(
      ...((membershipRows ?? []) as SegmentMembershipRow[]),
    );
  }

  const manualSegmentIds = uniqueStrings(
    rawMembershipRows.map((row) => row.segment_id),
  );
  if (manualSegmentIds.length > 0) {
    const { data: manualSegments, error: manualSegmentsError } = await client
      .from("crm_segments")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .in("id", manualSegmentIds);

    if (manualSegmentsError) {
      throw manualSegmentsError;
    }

    const systemIdByName = new Map(
      SYSTEM_SEGMENTS.map((segment) => [
        segment.name.toLowerCase(),
        segment.id,
      ]),
    );
    const segmentNameById = new Map(
      (manualSegments ?? []).map((segment) => [segment.id, segment.name]),
    );
    for (const row of rawMembershipRows) {
      const name = segmentNameById.get(row.segment_id);
      const systemId = name ? systemIdByName.get(name.toLowerCase()) : null;
      if (systemId && segmentIds.includes(systemId)) {
        result.get(systemId)?.add(row.customer_id);
      }
    }
  }

  return result;
}

async function resolvePersonas(
  client: BloomQueryClient,
  tenantId: string,
  ids: string[],
  names: string[],
): Promise<{ personas: ResolvedPersona[]; warnings: string[] }> {
  const warnings: string[] = [];
  const resolved = new Map<string, ResolvedPersona>();
  const customIds = ids.filter(isUuid);
  const predefinedIds = ids.filter((id) => !isUuid(id));

  for (const predefinedId of predefinedIds) {
    const systemPersona = SYSTEM_PERSONA_BY_ID.get(predefinedId);
    if (systemPersona) {
      resolved.set(predefinedId, {
        id: predefinedId,
        name: systemPersona.persona_name,
        description: systemPersona.persona_description ?? null,
        isSystem: true,
      });
    } else {
      warnings.push(`System persona was not found for ID ${predefinedId}.`);
    }
  }

  if (customIds.length > 0) {
    const { data, error } = await client
      .from("crm_personas")
      .select("id, persona_name, persona_description")
      .eq("tenant_id", tenantId)
      .in("id", customIds);

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      resolved.set(row.id, {
        id: row.id,
        name: row.persona_name,
        description: row.persona_description,
        isSystem: false,
      });
    }

    for (const id of customIds) {
      if (!resolved.has(id)) {
        warnings.push(`Persona was not found for ID ${id}.`);
      }
    }
  }

  for (const name of names) {
    const normalizedName = name.toLowerCase();
    const systemPersona = SYSTEM_PERSONAS.find((persona) =>
      getPersonaMatchCandidates(persona).some(
        (candidate) => candidate.toLowerCase() === normalizedName,
      ),
    );
    if (systemPersona) {
      resolved.set(systemPersona.id, {
        id: systemPersona.id,
        name: systemPersona.persona_name,
        description: systemPersona.persona_description ?? null,
        isSystem: true,
      });
      continue;
    }

    const { data, error } = await client
      .from("crm_personas")
      .select("id, persona_name, persona_description")
      .eq("tenant_id", tenantId)
      .ilike("persona_name", name)
      .limit(1);

    if (error) {
      throw error;
    }

    const persona = data?.[0];
    if (!persona) {
      warnings.push(`Persona name did not match a tenant persona: ${name}.`);
      continue;
    }

    resolved.set(persona.id, {
      id: persona.id,
      name: persona.persona_name,
      description: persona.persona_description,
      isSystem: false,
    });
  }

  return { personas: [...resolved.values()], warnings };
}

async function fetchPersonaCustomerIds(
  client: BloomQueryClient,
  tenantId: string,
  personaIds: string[],
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>(
    personaIds.map((id) => [id, new Set<string>()]),
  );
  if (personaIds.length === 0) {
    return result;
  }

  const uuidPersonas = personaIds.filter(isUuid);
  const predefinedPersonas = personaIds.filter((id) => !isUuid(id));

  if (uuidPersonas.length > 0) {
    const { data, error } = await client
      .from("customer_personas")
      .select("customer_id, persona_id, predefined_persona_id")
      .in("persona_id", uuidPersonas);
    if (error) throw error;
    for (const row of (data ?? []) as CustomerPersonaRow[]) {
      if (row.persona_id) {
        result.get(row.persona_id)?.add(row.customer_id);
      }
    }

    const { data: legacy, error: legacyError } = await client
      .from("crm_customers")
      .select("id, persona_id")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .in("persona_id", uuidPersonas);
    if (legacyError) throw legacyError;
    for (const row of legacy ?? []) {
      if (typeof row.persona_id === "string") {
        result.get(row.persona_id)?.add(row.id);
      }
    }
  }

  if (predefinedPersonas.length > 0) {
    const { data, error } = await client
      .from("customer_personas")
      .select("customer_id, persona_id, predefined_persona_id")
      .in("predefined_persona_id", predefinedPersonas);
    if (error) throw error;
    for (const row of (data ?? []) as CustomerPersonaRow[]) {
      if (row.predefined_persona_id) {
        result.get(row.predefined_persona_id)?.add(row.customer_id);
      }
    }

    const { data: legacy, error: legacyError } = await client
      .from("crm_customers")
      .select("id, persona_id")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .in("persona_id", predefinedPersonas);
    if (legacyError) throw legacyError;
    for (const row of legacy ?? []) {
      if (typeof row.persona_id === "string") {
        result.get(row.persona_id)?.add(row.id);
      }
    }
  }

  const allCandidateIds = uniqueStrings(
    [...result.values()].flatMap((ids) => [...ids]),
  );
  const validIds = await fetchValidatedCustomerIds(
    client,
    tenantId,
    allCandidateIds,
  );
  for (const [personaId, ids] of result.entries()) {
    result.set(personaId, new Set([...ids].filter((id) => validIds.has(id))));
  }

  return result;
}

function intersectSets(left: Set<string>, right: Set<string>): Set<string> {
  const [small, large] =
    left.size <= right.size ? [left, right] : [right, left];
  return new Set([...small].filter((id) => large.has(id)));
}

function unionSets(sets: Set<string>[]): Set<string> {
  const result = new Set<string>();
  for (const set of sets) {
    for (const value of set) {
      result.add(value);
    }
  }
  return result;
}

async function computeDeliverableCount(
  client: BloomQueryClient,
  tenantId: string,
  customerIds: string[],
): Promise<number> {
  const customers = await fetchCustomersByIds(client, tenantId, customerIds);
  const eligibleIds = await resolveEligibleEmailCustomerIds(client, {
    tenantId,
    customers: customers.filter(
      (customer) => customer.suppressed !== true && customer.opt_out !== true,
    ),
  });
  return eligibleIds.size;
}

export const computeAudienceSize: ToolImplementation = async (
  params,
  context,
) => {
  const client = getQueryClient(context);
  const segmentIds = uniqueStrings(readStringArray(params.segment_ids)).filter(
    (id) => isUuid(id) || SYSTEM_SEGMENT_IDS.has(id),
  );
  const segmentNames = uniqueStrings(readStringArray(params.segment_names));
  const personaIds = uniqueStrings(readStringArray(params.persona_ids));
  const personaNames = uniqueStrings(readStringArray(params.persona_names));
  const additionalCustomerIds = uniqueStrings(
    readStringArray(params.additional_customer_ids),
  ).filter(isUuid);
  const filters = readFilters(params.filters);
  const includeAllCustomers = readBoolean(params.include_all_customers);
  const includeSuppressed = readBoolean(params.include_suppressed);
  const { segments, warnings: segmentWarnings } = await resolveCustomSegments(
    client,
    context.tenantId,
    segmentIds,
    segmentNames,
  );
  const { personas, warnings: personaWarnings } = await resolvePersonas(
    client,
    context.tenantId,
    personaIds,
    personaNames,
  );

  let baseIds: Set<string> | null = includeAllCustomers
    ? await fetchTenantCustomerIds(client, context.tenantId)
    : null;
  const customSegmentIds = segments
    .filter((segment) => !segment.isSystem)
    .map((segment) => segment.id);
  const systemSegmentIds = segments
    .filter((segment) => segment.isSystem)
    .map((segment) => segment.id);
  const segmentCounts: JsonObject[] = [];
  const segmentSets: Set<string>[] = [];

  if (customSegmentIds.length > 0) {
    for (const segment of segments.filter((item) => !item.isSystem)) {
      const ids = await fetchCustomSegmentCustomerIds(
        client,
        context.tenantId,
        [segment.id],
      );
      segmentSets.push(ids);
      segmentCounts.push({
        id: segment.id,
        name: segment.name,
        type: "custom",
        count: ids.size,
      });
    }
  }

  if (systemSegmentIds.length > 0) {
    const systemCounts = await fetchSystemSegmentCustomerIds(
      client,
      context.tenantId,
      systemSegmentIds,
    );
    for (const segment of segments.filter((item) => item.isSystem)) {
      const ids = systemCounts.get(segment.id) ?? new Set<string>();
      segmentSets.push(ids);
      segmentCounts.push({
        id: segment.id,
        name: segment.name,
        type: "system",
        count: ids.size,
      });
    }
  }

  const segmentUnion = segmentSets.length > 0 ? unionSets(segmentSets) : null;
  if (!baseIds && segmentUnion) {
    baseIds = segmentUnion;
  }

  const personaMaps = await fetchPersonaCustomerIds(
    client,
    context.tenantId,
    personas.map((persona) => persona.id),
  );
  const personaSets = personas.map(
    (persona) => personaMaps.get(persona.id) ?? new Set<string>(),
  );
  const personaUnion = personaSets.length > 0 ? unionSets(personaSets) : null;
  const personaCounts = personas.map((persona) => {
    const ids = personaMaps.get(persona.id) ?? new Set<string>();
    return {
      id: persona.id,
      name: persona.name,
      type: persona.isSystem ? "system" : "custom",
      count: ids.size,
    } satisfies JsonObject;
  });

  if (baseIds && personaUnion) {
    baseIds = intersectSets(baseIds, personaUnion);
  } else if (!baseIds && personaUnion) {
    baseIds = personaUnion;
  }

  if (filters.length > 0) {
    const customers = await fetchTenantCustomers(client, context.tenantId);
    const filteredIds = new Set(
      customers
        .filter((customer) =>
          filters.every((filter) => filterMatchesCustomer(customer, filter)),
        )
        .map((customer) => customer.id),
    );
    baseIds = baseIds ? intersectSets(baseIds, filteredIds) : filteredIds;
  }

  if (!baseIds) {
    baseIds = new Set<string>();
  }

  const validatedAdditionalIds = await fetchValidatedCustomerIds(
    client,
    context.tenantId,
    additionalCustomerIds,
  );
  for (const customerId of validatedAdditionalIds) {
    baseIds.add(customerId);
  }

  const rawUniqueIds = [...baseIds];
  const customerDetails = await fetchCustomersByIds(
    client,
    context.tenantId,
    rawUniqueIds,
  );
  const deliverableCount = await computeDeliverableCount(
    client,
    context.tenantId,
    rawUniqueIds,
  );
  const countedCustomers = includeSuppressed
    ? customerDetails
    : customerDetails.filter(
        (customer) => customer.suppressed !== true && customer.opt_out !== true,
      );
  const uniqueTotal = countedCustomers.length;
  const segmentMembershipTotal = segmentSets.reduce(
    (total, ids) => total + ids.size,
    0,
  );
  const overlapCustomers = new Set<string>();
  if (segmentSets.length > 1) {
    const seen = new Set<string>();
    for (const ids of segmentSets) {
      for (const customerId of ids) {
        if (seen.has(customerId)) {
          overlapCustomers.add(customerId);
        }
        seen.add(customerId);
      }
    }
  }

  return createResult({
    success: true,
    message: `Audience size is ${uniqueTotal.toLocaleString()} customers, with ${deliverableCount.toLocaleString()} estimated email-deliverable recipients.`,
    blockType: "stat_card",
    count: uniqueTotal,
    data: {
      tenant_id: context.tenantId,
      unique_total: uniqueTotal,
      raw_unique_total: rawUniqueIds.length,
      estimated_deliverable: deliverableCount,
      suppressed_or_opted_out_excluded: rawUniqueIds.length - uniqueTotal,
      include_suppressed: includeSuppressed,
      criteria: {
        include_all_customers: includeAllCustomers,
        segment_ids: jsonArray(segments.map((segment) => segment.id)),
        persona_ids: jsonArray(personas.map((persona) => persona.id)),
        filters_count: filters.length,
        additional_customer_count: validatedAdditionalIds.size,
      },
      per_segment_counts: segmentCounts,
      per_persona_counts: personaCounts,
      overlap: {
        selected_segment_count: segmentSets.length,
        segment_membership_total: segmentMembershipTotal,
        segment_union_count: segmentUnion?.size ?? 0,
        overlapping_customer_count: overlapCustomers.size,
        duplicated_membership_count: Math.max(
          0,
          segmentMembershipTotal - (segmentUnion?.size ?? 0),
        ),
      },
      warnings: [...segmentWarnings, ...personaWarnings],
      sample_customer_ids: jsonArray(
        countedCustomers.slice(0, 10).map((customer) => customer.id),
      ),
    },
  });
};

function buildPersonaNameIndex(personas: PersonaRecord[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const persona of personas) {
    for (const candidate of getPersonaMatchCandidates(persona)) {
      index.set(candidate.toLowerCase(), persona.id);
    }
  }
  return index;
}

function customerPersonaIds(
  customer: Pick<CustomerRow, "id" | "persona" | "persona_id">,
  assignments: CustomerPersonaRow[],
  personaNameIndex: Map<string, string>,
): string[] {
  const personaIds = new Set<string>();
  for (const assignment of assignments) {
    const assignmentId =
      assignment.persona_id ?? assignment.predefined_persona_id;
    if (assignmentId) {
      personaIds.add(assignmentId);
    }
  }
  if (customer.persona_id) {
    personaIds.add(customer.persona_id);
  }
  const legacyId = customer.persona
    ? personaNameIndex.get(customer.persona.toLowerCase())
    : null;
  if (legacyId) {
    personaIds.add(legacyId);
  }
  return [...personaIds];
}

async function loadPersonaCounts(
  client: BloomQueryClient,
  tenantId: string,
  personas: PersonaRecord[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>(
    personas.map((persona) => [persona.id, 0]),
  );
  const personaNameIndex = buildPersonaNameIndex(personas);
  const { data: customers, error: customerError } = await client
    .from("crm_customers")
    .select("id, persona, persona_id")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  if (customerError) {
    throw customerError;
  }

  const customerIds = (customers ?? []).map((customer) => customer.id);
  const assignmentsByCustomerId = new Map<string, CustomerPersonaRow[]>();
  for (const chunk of chunkStrings(customerIds)) {
    const { data, error } = await client
      .from("customer_personas")
      .select("customer_id, persona_id, predefined_persona_id")
      .in("customer_id", chunk);

    if (error) {
      throw error;
    }

    for (const assignment of (data ?? []) as CustomerPersonaRow[]) {
      const next = assignmentsByCustomerId.get(assignment.customer_id) ?? [];
      next.push(assignment);
      assignmentsByCustomerId.set(assignment.customer_id, next);
    }
  }

  for (const customer of customers ?? []) {
    const personaIds = customerPersonaIds(
      customer,
      assignmentsByCustomerId.get(customer.id) ?? [],
      personaNameIndex,
    );
    for (const personaId of personaIds) {
      if (counts.has(personaId)) {
        counts.set(personaId, (counts.get(personaId) ?? 0) + 1);
      }
    }
  }

  return counts;
}

function mapPersona(persona: PersonaRecord, count: number): JsonObject {
  const metadata = normalizePersonaMetadata(persona.metadata);
  const mapped: JsonObject = {
    id: persona.id,
    persona_name: persona.persona_name,
    persona_description: persona.persona_description ?? null,
    is_custom: persona.is_custom,
    customer_count: count,
    metadata: toJsonObject(metadata) ?? {},
    created_at: persona.created_at ?? null,
    updated_at: persona.updated_at ?? null,
    read_only: true,
  };

  if (persona.tenant_id) {
    mapped.tenant_id = persona.tenant_id;
  }

  return mapped;
}

export const queryPersonas: ToolImplementation = async (params, context) => {
  const client = getQueryClient(context);
  const search = readString(params.search)?.toLowerCase() ?? null;
  const includeSystem = readBoolean(params.include_system, true);
  const page = readPositiveInteger(params.page, 1);
  const pageSize = Math.min(readPositiveInteger(params.page_size, 10), 50);
  const { data, error } = await client
    .from("crm_personas")
    .select(
      "id, persona_name, persona_description, is_custom, created_at, updated_at, tenant_id, user_id, metadata",
    )
    .eq("tenant_id", context.tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const customPersonas = (data ?? []) as PersonaRow[];
  const personas: PersonaRecord[] = [
    ...(includeSystem ? SYSTEM_PERSONAS : []),
    ...customPersonas.map((persona) => ({
      id: persona.id,
      persona_name: persona.persona_name,
      persona_description: persona.persona_description,
      is_custom: persona.is_custom,
      created_at: persona.created_at,
      updated_at: persona.updated_at,
      tenant_id: persona.tenant_id,
      user_id: persona.user_id,
      metadata: normalizePersonaMetadata(persona.metadata),
    })),
  ];
  const counts = await loadPersonaCounts(client, context.tenantId, personas);
  const filtered = personas.filter((persona) => {
    if (!search) {
      return true;
    }
    const haystack = [persona.persona_name, persona.persona_description]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .toLowerCase();
    return haystack.includes(search);
  });
  const from = (page - 1) * pageSize;
  const pageItems = filtered.slice(from, from + pageSize);
  const items = pageItems.map((persona) =>
    mapPersona(persona, counts.get(persona.id) ?? 0),
  );

  return createResult({
    success: true,
    message: `Found ${filtered.length.toLocaleString()} personas. Personas are read-only in Bloom Assist.`,
    blockType: items.length === 1 ? "data_card" : "data_table",
    count: filtered.length,
    data:
      items.length === 1 ? items[0] : items.map((item) => item as JsonValue),
  });
};

export function segmentAudienceImplementation(
  toolName: ToolName,
): ToolImplementation | null {
  switch (toolName) {
    case "create_segment":
      return createSegment;
    case "update_segment":
      return updateSegment;
    case "assign_segment":
      return assignSegment;
    case "compute_audience_size":
      return computeAudienceSize;
    case "query_personas":
      return queryPersonas;
    default:
      return null;
  }
}
