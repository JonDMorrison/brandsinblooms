import type { Database } from "../../../../../src/integrations/supabase/types.ts";
import type { JsonArray, JsonObject, JsonValue } from "../../types.ts";
import type {
  ConfirmationDetails,
  ToolExecutionContext,
  ToolImplementation,
  ToolName,
  ToolResult,
  ToolRiskLevel,
} from "../types.ts";
import {
  getQueryClient,
  isRecord,
  uniqueStrings,
  type BloomQueryClient,
} from "./shared.ts";

type CampaignRow = Database["public"]["Tables"]["crm_campaigns"]["Row"];
type CampaignInsert = Database["public"]["Tables"]["crm_campaigns"]["Insert"];
type CampaignUpdate = Database["public"]["Tables"]["crm_campaigns"]["Update"];
type CampaignBlockRow = Database["public"]["Tables"]["campaign_blocks"]["Row"];
type CampaignBlockInsert =
  Database["public"]["Tables"]["campaign_blocks"]["Insert"];
type SegmentRow = Pick<
  Database["public"]["Tables"]["crm_segments"]["Row"],
  "id" | "name" | "customer_count"
>;
type PersonaRow = Pick<
  Database["public"]["Tables"]["crm_personas"]["Row"],
  "id" | "persona_name" | "persona_description"
>;

type CampaignMutationToolName =
  | "create_campaign"
  | "update_campaign"
  | "clone_campaign"
  | "schedule_campaign"
  | "send_campaign"
  | "pause_resume_campaign";

type PendingConfirmation = {
  messageId: string;
  expiresAt: number;
};

type AudienceSelection = {
  segments: SegmentRow[];
  personas: PersonaRow[];
  includeAllCustomers: boolean;
  additionalCustomerIds: string[];
  warnings: string[];
  audienceSize: number;
};

type ExistingAudience = {
  segmentIds: string[];
  personaIds: string[];
  includeAllCustomers: boolean;
  additionalCustomerIds: string[];
};

const CONFIRMATION_TTL_MS = 15 * 60 * 1000;
const PAGE_SIZE = 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MUTABLE_CAMPAIGN_STATUSES = new Set(["draft", "paused"]);
const SENDABLE_CAMPAIGN_STATUSES = new Set(["draft", "scheduled"]);
const PAUSABLE_CAMPAIGN_STATUSES = new Set([
  "scheduled",
  "sending",
  "queued",
  "partially_queued",
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

function readBoolean(value: unknown): boolean {
  return value === true;
}

function readChanges(params: JsonObject): JsonObject {
  return isRecord(params.changes) ? (params.changes as JsonObject) : {};
}

function toJsonObject(value: unknown): JsonObject {
  return isRecord(value) ? (value as JsonObject) : {};
}

function jsonArray(values: string[]): JsonArray {
  return values.map((value) => value);
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
  toolName: CampaignMutationToolName,
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
  toolName: CampaignMutationToolName,
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
  toolName: CampaignMutationToolName,
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
  error = "campaign_mutation_error",
): ToolResult {
  return createResult({
    success: false,
    message,
    error,
    blockType: "text",
  });
}

function confirmationResult(args: {
  toolName: CampaignMutationToolName;
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

function mapCampaignCard(row: CampaignRow): JsonObject {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    subject_line: row.subject_line,
    preheader_text: row.preheader_text ?? row.preheader,
    delivery_method: row.delivery_method,
    status: row.status,
    scheduled_at: row.scheduled_at,
    sent_at: row.sent_at,
    sender_name: row.sender_display_name ?? row.sender_name,
    sender_email: row.actual_sender_email ?? row.sender_email,
    segment_id: row.segment_id,
    persona_ids: row.persona_ids ?? [],
    projected_recipient_count: row.projected_recipient_count,
    total_recipients: row.total_recipients,
    updated_at: row.updated_at,
  };
}

function campaignStatus(row: CampaignRow): string {
  return (row.status ?? "draft").toLowerCase();
}

function getServiceClient(context: ToolExecutionContext): BloomQueryClient {
  return context.serviceClient as BloomQueryClient;
}

function getAuthenticatedClient(
  context: ToolExecutionContext,
): BloomQueryClient | null {
  return context.dataClient ? (context.dataClient as BloomQueryClient) : null;
}

async function fetchCampaign(
  context: ToolExecutionContext,
  campaignId: string,
): Promise<CampaignRow | null> {
  const client = getQueryClient(context);
  const { data, error } = await client
    .from("crm_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("tenant_id", context.tenantId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as CampaignRow | null;
}

async function fetchCampaignSegments(
  context: ToolExecutionContext,
  campaignId: string,
): Promise<string[]> {
  const client = getQueryClient(context);
  const { data, error } = await client
    .from("campaign_segments")
    .select("segment_id")
    .eq("campaign_id", campaignId);

  if (error) {
    throw error;
  }

  return uniqueStrings(
    (data ?? []).map((row: { segment_id: string | null }) => row.segment_id),
  );
}

async function fetchCampaignPersonas(
  context: ToolExecutionContext,
  campaignId: string,
): Promise<string[]> {
  const client = getQueryClient(context);
  const { data, error } = await client
    .from("campaign_personas")
    .select("persona_id")
    .eq("campaign_id", campaignId);

  if (error) {
    throw error;
  }

  return uniqueStrings(
    (data ?? []).map((row: { persona_id: string | null }) => row.persona_id),
  );
}

async function fetchExistingAudience(
  context: ToolExecutionContext,
  campaign: CampaignRow,
): Promise<ExistingAudience> {
  const metadata = toJsonObject(campaign.metadata);
  const segmentIds = uniqueStrings([
    campaign.segment_id,
    ...(await fetchCampaignSegments(context, campaign.id)),
  ]);
  const personaIds = uniqueStrings([
    ...((campaign.persona_ids ?? []) as string[]),
    ...(await fetchCampaignPersonas(context, campaign.id)),
  ]);
  const metadataAdditional = readStringArray(metadata.additionalCustomerIds);

  return {
    segmentIds,
    personaIds,
    includeAllCustomers:
      typeof metadata.includeAllCustomers === "boolean"
        ? metadata.includeAllCustomers
        : campaign.include_all_customers,
    additionalCustomerIds: uniqueStrings([
      ...metadataAdditional,
      ...(campaign.additional_customer_ids ?? []),
    ]).filter(isUuid),
  };
}

function getSegmentIdsFromParams(params: JsonObject): string[] {
  return uniqueStrings([
    readString(params.segment_id),
    ...readStringArray(params.segment_ids),
  ]).filter(isUuid);
}

function getSegmentNamesFromParams(params: JsonObject): string[] {
  return uniqueStrings(readStringArray(params.segment_names));
}

function getPersonaIdsFromParams(params: JsonObject): string[] {
  return uniqueStrings([...readStringArray(params.persona_ids)]).filter(
    (value) => value.length > 0,
  );
}

function getPersonaNamesFromParams(params: JsonObject): string[] {
  return uniqueStrings(readStringArray(params.persona_names));
}

function getAdditionalCustomerIdsFromParams(params: JsonObject): string[] {
  return uniqueStrings(readStringArray(params.additional_customer_ids)).filter(
    isUuid,
  );
}

async function resolveSegments(
  client: BloomQueryClient,
  tenantId: string,
  ids: string[],
  names: string[],
): Promise<{ segments: SegmentRow[]; warnings: string[] }> {
  const warnings: string[] = [];
  const resolved = new Map<string, SegmentRow>();

  if (ids.length > 0) {
    const { data, error } = await client
      .from("crm_segments")
      .select("id, name, customer_count")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .in("id", ids);

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      resolved.set(row.id, row as SegmentRow);
    }

    for (const id of ids) {
      if (!resolved.has(id)) {
        warnings.push(`Segment was not found for ID ${id}.`);
      }
    }
  }

  for (const name of names) {
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

    const segment = data?.[0] as SegmentRow | undefined;
    if (!segment) {
      warnings.push(`Segment name did not match an active segment: ${name}.`);
      continue;
    }

    resolved.set(segment.id, segment);
  }

  return { segments: [...resolved.values()], warnings };
}

async function resolvePersonas(
  client: BloomQueryClient,
  tenantId: string,
  ids: string[],
  names: string[],
): Promise<{ personas: PersonaRow[]; warnings: string[] }> {
  const warnings: string[] = [];
  const resolved = new Map<string, PersonaRow>();
  const uuidIds = ids.filter(isUuid);
  const predefinedIds = ids.filter((id) => !isUuid(id));

  if (uuidIds.length > 0) {
    const { data, error } = await client
      .from("crm_personas")
      .select("id, persona_name, persona_description")
      .eq("tenant_id", tenantId)
      .in("id", uuidIds);

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      resolved.set(row.id, row as PersonaRow);
    }

    for (const id of uuidIds) {
      if (!resolved.has(id)) {
        warnings.push(`Persona was not found for ID ${id}.`);
      }
    }
  }

  for (const predefinedId of predefinedIds) {
    resolved.set(predefinedId, {
      id: predefinedId,
      persona_name: predefinedId,
      persona_description: null,
    });
  }

  for (const name of names) {
    const { data, error } = await client
      .from("crm_personas")
      .select("id, persona_name, persona_description")
      .eq("tenant_id", tenantId)
      .ilike("persona_name", name)
      .limit(1);

    if (error) {
      throw error;
    }

    const persona = data?.[0] as PersonaRow | undefined;
    if (!persona) {
      warnings.push(`Persona name did not match a tenant persona: ${name}.`);
      continue;
    }

    resolved.set(persona.id, persona);
  }

  return { personas: [...resolved.values()], warnings };
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

async function fetchSegmentCustomerIds(
  client: BloomQueryClient,
  segmentIds: string[],
): Promise<Set<string>> {
  if (segmentIds.length === 0) {
    return new Set();
  }

  return await fetchIdsPaged(
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
}

async function fetchPersonaCustomerIds(
  client: BloomQueryClient,
  tenantId: string,
  personaIds: string[],
): Promise<Set<string>> {
  if (personaIds.length === 0) {
    return new Set();
  }

  const uuidPersonas = personaIds.filter(isUuid);
  const predefinedPersonas = personaIds.filter((id) => !isUuid(id));
  const candidateIds = new Set<string>();

  if (uuidPersonas.length > 0) {
    const junctionIds = await fetchIdsPaged(
      (from, to) =>
        client
          .from("customer_personas")
          .select("customer_id")
          .in("persona_id", uuidPersonas)
          .range(from, to),
      (row) =>
        isRecord(row) && typeof row.customer_id === "string"
          ? row.customer_id
          : null,
    );
    junctionIds.forEach((id) => candidateIds.add(id));

    const legacyIds = await fetchIdsPaged(
      (from, to) =>
        client
          .from("crm_customers")
          .select("id")
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .in("persona_id", uuidPersonas)
          .range(from, to),
      (row) => (isRecord(row) && typeof row.id === "string" ? row.id : null),
    );
    legacyIds.forEach((id) => candidateIds.add(id));
  }

  if (predefinedPersonas.length > 0) {
    const predefinedIds = await fetchIdsPaged(
      (from, to) =>
        client
          .from("customer_personas")
          .select("customer_id")
          .in("predefined_persona_id", predefinedPersonas)
          .range(from, to),
      (row) =>
        isRecord(row) && typeof row.customer_id === "string"
          ? row.customer_id
          : null,
    );
    predefinedIds.forEach((id) => candidateIds.add(id));

    const legacyIds = await fetchIdsPaged(
      (from, to) =>
        client
          .from("crm_customers")
          .select("id")
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .in("persona_id", predefinedPersonas)
          .range(from, to),
      (row) => (isRecord(row) && typeof row.id === "string" ? row.id : null),
    );
    legacyIds.forEach((id) => candidateIds.add(id));
  }

  if (candidateIds.size === 0) {
    return candidateIds;
  }

  const validatedIds = new Set<string>();
  const ids = [...candidateIds];
  for (let index = 0; index < ids.length; index += 200) {
    const chunk = ids.slice(index, index + 200);
    const { data, error } = await client
      .from("crm_customers")
      .select("id")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .in("id", chunk);

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      if (typeof row.id === "string") {
        validatedIds.add(row.id);
      }
    }
  }

  return validatedIds;
}

async function fetchValidatedAdditionalCustomerIds(
  client: BloomQueryClient,
  tenantId: string,
  customerIds: string[],
): Promise<Set<string>> {
  const validatedIds = new Set<string>();
  for (let index = 0; index < customerIds.length; index += 200) {
    const chunk = customerIds.slice(index, index + 200);
    const { data, error } = await client
      .from("crm_customers")
      .select("id")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .in("id", chunk);

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      if (typeof row.id === "string") {
        validatedIds.add(row.id);
      }
    }
  }

  return validatedIds;
}

async function computeAudienceRecipientCount(
  client: BloomQueryClient,
  tenantId: string,
  audience: Omit<ExistingAudience, "additionalCustomerIds"> & {
    additionalCustomerIds: string[];
  },
): Promise<number> {
  if (audience.includeAllCustomers) {
    return (await fetchTenantCustomerIds(client, tenantId)).size;
  }

  const segmentIds = audience.segmentIds.filter(isUuid);
  const personaIds = audience.personaIds.filter((id) => id.length > 0);
  const segmentCustomerIds = await fetchSegmentCustomerIds(client, segmentIds);
  const personaCustomerIds = await fetchPersonaCustomerIds(
    client,
    tenantId,
    personaIds,
  );
  let resolvedIds: Set<string>;

  if (segmentCustomerIds.size > 0 && personaCustomerIds.size > 0) {
    const [small, large] =
      segmentCustomerIds.size <= personaCustomerIds.size
        ? [segmentCustomerIds, personaCustomerIds]
        : [personaCustomerIds, segmentCustomerIds];
    resolvedIds = new Set([...small].filter((id) => large.has(id)));
  } else if (segmentCustomerIds.size > 0) {
    resolvedIds = new Set(segmentCustomerIds);
  } else if (personaCustomerIds.size > 0) {
    resolvedIds = new Set(personaCustomerIds);
  } else {
    resolvedIds = new Set();
  }

  const additionalIds = await fetchValidatedAdditionalCustomerIds(
    client,
    tenantId,
    audience.additionalCustomerIds,
  );
  additionalIds.forEach((id) => resolvedIds.add(id));

  return resolvedIds.size;
}

async function resolveAudienceSelection(
  context: ToolExecutionContext,
  source: JsonObject,
  fallback?: ExistingAudience,
): Promise<AudienceSelection> {
  const client = getQueryClient(context);
  const explicitSegmentIds = getSegmentIdsFromParams(source);
  const explicitPersonaIds = getPersonaIdsFromParams(source);
  const hasAudienceFields =
    explicitSegmentIds.length > 0 ||
    getSegmentNamesFromParams(source).length > 0 ||
    explicitPersonaIds.length > 0 ||
    getPersonaNamesFromParams(source).length > 0 ||
    "include_all_customers" in source ||
    "additional_customer_ids" in source;

  if (!hasAudienceFields && fallback) {
    const { segments, warnings: segmentWarnings } = await resolveSegments(
      client,
      context.tenantId,
      fallback.segmentIds,
      [],
    );
    const { personas, warnings: personaWarnings } = await resolvePersonas(
      client,
      context.tenantId,
      fallback.personaIds,
      [],
    );
    const audienceSize = await computeAudienceRecipientCount(
      client,
      context.tenantId,
      fallback,
    );
    return {
      segments,
      personas,
      includeAllCustomers: fallback.includeAllCustomers,
      additionalCustomerIds: fallback.additionalCustomerIds,
      warnings: [...segmentWarnings, ...personaWarnings],
      audienceSize,
    };
  }

  const { segments, warnings: segmentWarnings } = await resolveSegments(
    client,
    context.tenantId,
    explicitSegmentIds,
    getSegmentNamesFromParams(source),
  );
  const { personas, warnings: personaWarnings } = await resolvePersonas(
    client,
    context.tenantId,
    explicitPersonaIds,
    getPersonaNamesFromParams(source),
  );
  const additionalCustomerIds = getAdditionalCustomerIdsFromParams(source);
  const includeAllCustomers = readBoolean(source.include_all_customers);
  const audienceSize = await computeAudienceRecipientCount(
    client,
    context.tenantId,
    {
      segmentIds: segments.map((segment) => segment.id),
      personaIds: personas.map((persona) => persona.id),
      includeAllCustomers,
      additionalCustomerIds,
    },
  );

  return {
    segments,
    personas,
    includeAllCustomers,
    additionalCustomerIds,
    warnings: [...segmentWarnings, ...personaWarnings],
    audienceSize,
  };
}

async function syncCampaignAudience(
  context: ToolExecutionContext,
  campaignId: string,
  audience: AudienceSelection,
): Promise<void> {
  const client = getServiceClient(context);
  const segmentRows = audience.segments.map((segment) => ({
    campaign_id: campaignId,
    segment_id: segment.id,
  }));
  const personaRows = audience.personas.map((persona) => ({
    campaign_id: campaignId,
    persona_id: persona.id,
  }));

  const { error: deleteSegmentsError } = await client
    .from("campaign_segments")
    .delete()
    .eq("campaign_id", campaignId);
  if (deleteSegmentsError) {
    throw deleteSegmentsError;
  }

  if (segmentRows.length > 1) {
    const { error } = await client
      .from("campaign_segments")
      .insert(segmentRows);
    if (error) {
      throw error;
    }
  }

  const { error: deletePersonasError } = await client
    .from("campaign_personas")
    .delete()
    .eq("campaign_id", campaignId);
  if (deletePersonasError) {
    throw deletePersonasError;
  }

  if (personaRows.length > 0) {
    const { error } = await client
      .from("campaign_personas")
      .insert(personaRows);
    if (error) {
      throw error;
    }
  }
}

async function findDuplicateCampaignName(
  context: ToolExecutionContext,
  name: string,
  excludeCampaignId?: string,
): Promise<string | null> {
  let query = getQueryClient(context)
    .from("crm_campaigns")
    .select("id, name")
    .eq("tenant_id", context.tenantId)
    .ilike("name", name.trim())
    .limit(1);

  if (excludeCampaignId) {
    query = query.neq("id", excludeCampaignId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return data?.[0]?.name ?? null;
}

function senderName(params: JsonObject, context: ToolExecutionContext): string {
  return (
    readString(params.sender_name) ||
    readString(params.sender_display_name) ||
    context.userName ||
    "BloomSuite"
  );
}

function senderEmail(params: JsonObject): string | null {
  return (
    readString(params.sender_email) || readString(params.actual_sender_email)
  );
}

function deliveryMethod(params: JsonObject): "email" | "sms" {
  const method =
    readString(params.delivery_method) || readString(params.campaign_type);
  return method === "sms" ? "sms" : "email";
}

function campaignContent(params: JsonObject, method: "email" | "sms"): string {
  const content = readString(params.content);
  if (content) {
    return content;
  }

  return method === "sms"
    ? ""
    : "<p>Draft campaign content will be added later.</p>";
}

function buildCampaignMetadata(
  existingMetadata: JsonObject,
  args: {
    campaignType: "email" | "sms";
    replyTo: string | null;
    smsMessage: string;
    includeAllCustomers: boolean;
    additionalCustomerIds: string[];
    sourceSegmentId: string | null;
    sourcePersonaId: string | null;
  },
): JsonObject {
  return {
    ...existingMetadata,
    campaignType: args.campaignType,
    replyTo: args.replyTo,
    smsMessage: args.smsMessage,
    includeAllCustomers: args.includeAllCustomers,
    additionalCustomerIds: jsonArray(args.additionalCustomerIds),
    sourceSegmentId: args.sourceSegmentId,
    sourcePersonaId: args.sourcePersonaId,
    contentBlocks: [],
  };
}

function taskPlanAudience(audience: AudienceSelection): JsonObject {
  return {
    include_all_customers: audience.includeAllCustomers,
    segments: audience.segments.map((segment) => ({
      id: segment.id,
      name: segment.name,
      customer_count: segment.customer_count ?? 0,
    })),
    personas: audience.personas.map((persona) => ({
      id: persona.id,
      name: persona.persona_name,
      description: persona.persona_description,
    })),
    additional_customer_count: audience.additionalCustomerIds.length,
    total_audience_size: audience.audienceSize,
  };
}

async function createCampaignExecution(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const client = getServiceClient(context);
  const name = readString(params.name);
  if (!name) {
    return errorResult("Campaign name is required.", "validation_error");
  }

  const method = deliveryMethod(params);
  const audience = await resolveAudienceSelection(context, params);
  const nowIso = new Date().toISOString();
  const email = senderEmail(params);
  const smsMessage = method === "sms" ? campaignContent(params, method) : "";
  const segmentIds = audience.segments.map((segment) => segment.id);
  const personaIds = audience.personas.map((persona) => persona.id);
  const insertPayload: CampaignInsert = {
    tenant_id: context.tenantId,
    user_id: context.userId,
    name,
    subject_line: readString(params.subject_line) ?? "",
    preheader_text: readString(params.preheader_text) ?? "",
    preheader: readString(params.preheader_text) ?? "",
    sender_name: senderName(params, context),
    sender_display_name: senderName(params, context),
    sender_email: email,
    actual_sender_email: email,
    content: campaignContent(params, method),
    status: "draft",
    delivery_method: method,
    scheduled_at: null,
    send_blocked_reason: null,
    projected_recipient_count: audience.audienceSize,
    include_all_customers: audience.includeAllCustomers,
    additional_customer_ids: audience.additionalCustomerIds,
    segment_id: segmentIds[0] ?? null,
    persona_ids: personaIds,
    metadata: buildCampaignMetadata(
      {},
      {
        campaignType: method,
        replyTo: email,
        smsMessage,
        includeAllCustomers: audience.includeAllCustomers,
        additionalCustomerIds: audience.additionalCustomerIds,
        sourceSegmentId: segmentIds[0] ?? null,
        sourcePersonaId: personaIds[0] ?? null,
      },
    ),
    metrics: {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0,
      revenue: 0,
    },
    updated_at: nowIso,
  };

  const { data, error } = await client
    .from("crm_campaigns")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const campaign = data as CampaignRow;
  await syncCampaignAudience(context, campaign.id, audience);

  return createResult({
    success: true,
    message: `Created campaign draft "${campaign.name}".`,
    blockType: "data_card",
    data: mapCampaignCard(campaign),
    count: 1,
  });
}

export const createCampaign: ToolImplementation = async (params, context) => {
  if (shouldExecuteAfterConfirmation(context, "create_campaign", params)) {
    return await createCampaignExecution(params, context);
  }

  const name = readString(params.name);
  if (!name) {
    return errorResult("Campaign name is required.", "validation_error");
  }

  const duplicateName = await findDuplicateCampaignName(context, name);
  const audience = await resolveAudienceSelection(context, params);
  const warnings = [...audience.warnings];
  if (duplicateName) {
    warnings.push(
      `A campaign with a similar name already exists: "${duplicateName}". Create anyway?`,
    );
  }

  const approvalKey = rememberConfirmation(context, "create_campaign", params);
  return confirmationResult({
    toolName: "create_campaign",
    riskLevel: "low",
    action: `Create campaign draft "${name}".`,
    affectedCount: 1,
    reversible: true,
    warnings,
    approvalKey,
    taskPlan: {
      operation: "create_campaign",
      campaign: {
        name,
        delivery_method: deliveryMethod(params),
        subject_line: readString(params.subject_line),
        preheader_text: readString(params.preheader_text),
        sender_name: senderName(params, context),
        sender_email: senderEmail(params),
      },
      audience: taskPlanAudience(audience),
      steps: [
        "Insert a draft crm_campaigns row scoped to the current tenant and user.",
        "Sync campaign audience links using the campaign editor delete-then-insert pattern.",
        "Return the new campaign draft.",
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

function updatePayloadFromChanges(
  changes: JsonObject,
  campaign: CampaignRow,
  audience: AudienceSelection | null,
): CampaignUpdate {
  const metadata = toJsonObject(campaign.metadata);
  const method = deliveryMethod({
    delivery_method:
      changes.delivery_method ?? campaign.delivery_method ?? "email",
  });
  const content = readString(changes.content);
  const preheader = readString(changes.preheader_text);
  const sender =
    readString(changes.sender_name) || readString(changes.sender_display_name);
  const email =
    readString(changes.sender_email) || readString(changes.actual_sender_email);
  const update: CampaignUpdate = {
    updated_at: new Date().toISOString(),
  };

  if (readString(changes.name))
    update.name = readString(changes.name) ?? undefined;
  if (readString(changes.subject_line) !== null)
    update.subject_line = readString(changes.subject_line);
  if (preheader !== null) {
    update.preheader_text = preheader;
    update.preheader = preheader;
  }
  if (content !== null) update.content = content;
  if (readString(changes.delivery_method)) update.delivery_method = method;
  if (sender) {
    update.sender_name = sender;
    update.sender_display_name = sender;
  }
  if (email) {
    update.sender_email = email;
    update.actual_sender_email = email;
  }
  if (readString(changes.scheduled_at) !== null)
    update.scheduled_at = readString(changes.scheduled_at);

  if (audience) {
    const segmentIds = audience.segments.map((segment) => segment.id);
    const personaIds = audience.personas.map((persona) => persona.id);
    update.segment_id = segmentIds[0] ?? null;
    update.persona_ids = personaIds;
    update.include_all_customers = audience.includeAllCustomers;
    update.additional_customer_ids = audience.additionalCustomerIds;
    update.projected_recipient_count = audience.audienceSize;
    update.metadata = buildCampaignMetadata(metadata, {
      campaignType: method,
      replyTo: email ?? readString(metadata.replyTo) ?? campaign.sender_email,
      smsMessage:
        method === "sms"
          ? (content ?? campaign.content ?? "")
          : (readString(metadata.smsMessage) ?? ""),
      includeAllCustomers: audience.includeAllCustomers,
      additionalCustomerIds: audience.additionalCustomerIds,
      sourceSegmentId: segmentIds[0] ?? null,
      sourcePersonaId: personaIds[0] ?? null,
    });
  }

  return update;
}

function hasAudienceChange(changes: JsonObject): boolean {
  return (
    "segment_id" in changes ||
    "segment_ids" in changes ||
    "segment_names" in changes ||
    "persona_ids" in changes ||
    "persona_names" in changes ||
    "include_all_customers" in changes ||
    "additional_customer_ids" in changes
  );
}

async function updateCampaignExecution(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const campaignId = readString(params.campaign_id);
  if (!campaignId) {
    return errorResult("campaign_id is required.", "validation_error");
  }

  const campaign = await fetchCampaign(context, campaignId);
  if (!campaign) {
    return errorResult("Campaign not found for this tenant.", "not_found");
  }

  if (!MUTABLE_CAMPAIGN_STATUSES.has(campaignStatus(campaign))) {
    return errorResult(
      "Only draft or paused campaigns can be updated.",
      "invalid_status",
    );
  }

  const changes = readChanges(params);
  const audience = hasAudienceChange(changes)
    ? await resolveAudienceSelection(context, changes)
    : null;
  const payload = updatePayloadFromChanges(changes, campaign, audience);
  const { data, error } = await getServiceClient(context)
    .from("crm_campaigns")
    .update(payload)
    .eq("id", campaignId)
    .eq("tenant_id", context.tenantId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  if (audience) {
    await syncCampaignAudience(context, campaignId, audience);
  }

  return createResult({
    success: true,
    message: `Updated campaign "${(data as CampaignRow).name}".`,
    blockType: "data_card",
    data: mapCampaignCard(data as CampaignRow),
    count: 1,
  });
}

export const updateCampaign: ToolImplementation = async (params, context) => {
  if (shouldExecuteAfterConfirmation(context, "update_campaign", params)) {
    return await updateCampaignExecution(params, context);
  }

  const campaignId = readString(params.campaign_id);
  if (!campaignId) {
    return errorResult("campaign_id is required.", "validation_error");
  }

  const campaign = await fetchCampaign(context, campaignId);
  if (!campaign) {
    return errorResult("Campaign not found for this tenant.", "not_found");
  }

  if (!MUTABLE_CAMPAIGN_STATUSES.has(campaignStatus(campaign))) {
    return errorResult(
      "Only draft or paused campaigns can be updated.",
      "invalid_status",
    );
  }

  const changes = readChanges(params);
  const existingAudience = await fetchExistingAudience(context, campaign);
  const audience = hasAudienceChange(changes)
    ? await resolveAudienceSelection(context, changes, existingAudience)
    : null;
  const diffs = [
    fieldDiff("Name", campaign.name, changes.name),
    fieldDiff("Subject", campaign.subject_line, changes.subject_line),
    fieldDiff(
      "Preheader",
      campaign.preheader_text ?? campaign.preheader,
      changes.preheader_text,
    ),
    fieldDiff(
      "Sender name",
      campaign.sender_display_name ?? campaign.sender_name,
      changes.sender_name,
    ),
    fieldDiff(
      "Sender email",
      campaign.actual_sender_email ?? campaign.sender_email,
      changes.sender_email,
    ),
    fieldDiff(
      "Delivery method",
      campaign.delivery_method,
      changes.delivery_method,
    ),
    fieldDiff("Scheduled time", campaign.scheduled_at, changes.scheduled_at),
  ].filter((diff): diff is JsonObject => Boolean(diff));
  const warnings = audience?.warnings ?? [];
  const approvalKey = rememberConfirmation(context, "update_campaign", params);

  return confirmationResult({
    toolName: "update_campaign",
    riskLevel: "medium",
    action: `Update campaign "${campaign.name}".`,
    affectedCount: 1,
    reversible: true,
    warnings,
    approvalKey,
    taskPlan: {
      operation: "update_campaign",
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      status: campaign.status,
      field_diffs: diffs,
      audience: audience
        ? {
            current: existingAudience,
            proposed: taskPlanAudience(audience),
          }
        : null,
      steps: [
        "Update crm_campaigns with only the non-null requested fields.",
        "If audience changed, delete existing campaign audience links and insert the proposed links.",
        "Return the updated campaign.",
      ],
    },
  });
};

async function cloneCampaignExecution(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const campaignId = readString(params.campaign_id);
  if (!campaignId) {
    return errorResult("campaign_id is required.", "validation_error");
  }

  const source = await fetchCampaign(context, campaignId);
  if (!source) {
    return errorResult("Campaign not found for this tenant.", "not_found");
  }

  const client = getServiceClient(context);
  const newName = readString(params.new_name) || `${source.name} (Copy)`;
  const metadata = toJsonObject(source.metadata);
  const insertPayload: CampaignInsert = {
    name: newName,
    subject_line: source.subject_line,
    preheader_text: source.preheader_text,
    preheader: source.preheader,
    content: source.content,
    status: "draft",
    delivery_method: source.delivery_method,
    sender_display_name: source.sender_display_name,
    sender_name: source.sender_name,
    actual_sender_email: source.actual_sender_email,
    sender_email: source.sender_email,
    from_email_domain_id: source.from_email_domain_id,
    user_id: context.userId,
    tenant_id: context.tenantId,
    source_campaign_id: source.id,
    template_id: source.template_id,
    metadata: {
      ...metadata,
      cloned_from: source.id,
      cloned_at: new Date().toISOString(),
    },
    scheduled_at: null,
    sent_at: null,
    synced_from: source.synced_from,
    segment_id: source.segment_id,
    persona_ids: source.persona_ids,
    include_all_customers: source.include_all_customers,
    additional_customer_ids: source.additional_customer_ids,
    projected_recipient_count: source.projected_recipient_count,
    metrics: {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0,
    },
    total_sent: 0,
    total_opens: 0,
    total_clicks: 0,
    open_rate: 0,
    click_rate: 0,
    messages_sent: 0,
    messages_failed: 0,
    messages_skipped: 0,
  };

  const { data: cloned, error: cloneError } = await client
    .from("crm_campaigns")
    .insert(insertPayload)
    .select("*")
    .single();

  if (cloneError) {
    throw cloneError;
  }

  const clonedCampaign = cloned as CampaignRow;
  const { data: blocks, error: blocksError } = await client
    .from("campaign_blocks")
    .select("*")
    .eq("campaign_id", source.id)
    .order("order_index", { ascending: true });

  if (blocksError) {
    throw blocksError;
  }

  const blockRows: CampaignBlockInsert[] = (
    (blocks ?? []) as CampaignBlockRow[]
  ).map((block) => ({
    campaign_id: clonedCampaign.id,
    order_index: block.order_index,
    block_type: block.block_type,
    content: block.content,
    image_url: block.image_url,
    cta_url: block.cta_url,
    cta_text: block.cta_text,
    source: "cloned",
    persona_tag: block.persona_tag,
    headline: block.headline,
    layout_settings: block.layout_settings,
    overlay_color: block.overlay_color,
    overlay_opacity: block.overlay_opacity,
    dark_overlay_opacity: block.dark_overlay_opacity,
  }));

  if (blockRows.length > 0) {
    const { error } = await client.from("campaign_blocks").insert(blockRows);
    if (error) {
      throw error;
    }
  }

  const segmentIds = await fetchCampaignSegments(context, source.id);
  const personaIds = await fetchCampaignPersonas(context, source.id);
  if (segmentIds.length > 0) {
    const { error } = await client.from("campaign_segments").insert(
      segmentIds.map((segmentId) => ({
        campaign_id: clonedCampaign.id,
        segment_id: segmentId,
      })),
    );
    if (error) {
      throw error;
    }
  }
  if (personaIds.length > 0) {
    const { error } = await client.from("campaign_personas").insert(
      personaIds.map((personaId) => ({
        campaign_id: clonedCampaign.id,
        persona_id: personaId,
      })),
    );
    if (error) {
      throw error;
    }
  }

  return createResult({
    success: true,
    message: `Cloned campaign "${source.name}" as "${clonedCampaign.name}".`,
    blockType: "data_card",
    data: mapCampaignCard(clonedCampaign),
    count: 1,
  });
}

export const cloneCampaign: ToolImplementation = async (params, context) => {
  if (shouldExecuteAfterConfirmation(context, "clone_campaign", params)) {
    return await cloneCampaignExecution(params, context);
  }

  const campaignId = readString(params.campaign_id);
  if (!campaignId) {
    return errorResult("campaign_id is required.", "validation_error");
  }

  const source = await fetchCampaign(context, campaignId);
  if (!source) {
    return errorResult("Campaign not found for this tenant.", "not_found");
  }

  const existingAudience = await fetchExistingAudience(context, source);
  const approvalKey = rememberConfirmation(context, "clone_campaign", params);
  return confirmationResult({
    toolName: "clone_campaign",
    riskLevel: "low",
    action: `Clone campaign "${source.name}" into a fresh draft.`,
    affectedCount: 1,
    reversible: true,
    warnings: [],
    approvalKey,
    taskPlan: {
      operation: "clone_campaign",
      source_campaign: {
        id: source.id,
        name: source.name,
        status: source.status,
      },
      new_name: readString(params.new_name) || `${source.name} (Copy)`,
      cloned: [
        "campaign settings",
        "audience",
        "campaign blocks",
        "template source",
      ],
      not_cloned: ["send history", "metrics", "sent status", "queue state"],
      audience: existingAudience,
    },
  });
};

function formatInTimezone(value: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(value));
  }
}

async function scheduleCampaignExecution(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const campaignId = readString(params.campaign_id);
  const scheduledAt = readString(params.scheduled_at);
  if (!campaignId || !scheduledAt) {
    return errorResult(
      "campaign_id and scheduled_at are required.",
      "validation_error",
    );
  }

  const scheduledDate = new Date(scheduledAt);
  if (
    Number.isNaN(scheduledDate.getTime()) ||
    scheduledDate.getTime() <= Date.now()
  ) {
    return errorResult(
      "scheduled_at must be a future ISO datetime.",
      "validation_error",
    );
  }

  const campaign = await fetchCampaign(context, campaignId);
  if (!campaign) {
    return errorResult("Campaign not found for this tenant.", "not_found");
  }

  if (!MUTABLE_CAMPAIGN_STATUSES.has(campaignStatus(campaign))) {
    return errorResult(
      "Only draft or paused campaigns can be scheduled.",
      "invalid_status",
    );
  }

  const { data, error } = await getQueryClient(context).rpc(
    "set_campaign_schedule",
    {
      p_campaign_id: campaignId,
      p_scheduled_at: scheduledAt,
      p_timezone: context.timezone,
    },
  );

  if (error) {
    throw error;
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.success) {
    return errorResult(
      result?.error_message || "Campaign schedule update failed.",
      "schedule_failed",
    );
  }

  const updatedCampaign = await fetchCampaign(context, campaignId);
  return createResult({
    success: true,
    message: `Scheduled campaign for ${formatInTimezone(scheduledAt, context.timezone)}.`,
    blockType: "data_card",
    data: updatedCampaign
      ? mapCampaignCard(updatedCampaign)
      : { id: campaignId, scheduled_at: scheduledAt, status: "scheduled" },
    count: 1,
  });
}

export const scheduleCampaign: ToolImplementation = async (params, context) => {
  if (shouldExecuteAfterConfirmation(context, "schedule_campaign", params)) {
    return await scheduleCampaignExecution(params, context);
  }

  const campaignId = readString(params.campaign_id);
  const scheduledAt = readString(params.scheduled_at);
  if (!campaignId || !scheduledAt) {
    return errorResult(
      "campaign_id and scheduled_at are required.",
      "validation_error",
    );
  }

  const scheduledDate = new Date(scheduledAt);
  if (
    Number.isNaN(scheduledDate.getTime()) ||
    scheduledDate.getTime() <= Date.now()
  ) {
    return errorResult(
      "scheduled_at must be a future ISO datetime.",
      "validation_error",
    );
  }

  const campaign = await fetchCampaign(context, campaignId);
  if (!campaign) {
    return errorResult("Campaign not found for this tenant.", "not_found");
  }

  if (!MUTABLE_CAMPAIGN_STATUSES.has(campaignStatus(campaign))) {
    return errorResult(
      "Only draft or paused campaigns can be scheduled.",
      "invalid_status",
    );
  }

  const audience = await resolveAudienceSelection(
    context,
    {},
    await fetchExistingAudience(context, campaign),
  );
  const approvalKey = rememberConfirmation(
    context,
    "schedule_campaign",
    params,
  );
  return confirmationResult({
    toolName: "schedule_campaign",
    riskLevel: "medium",
    action: `Schedule campaign "${campaign.name}" for ${formatInTimezone(scheduledAt, context.timezone)}.`,
    affectedCount: audience.audienceSize,
    reversible: true,
    warnings: audience.warnings,
    approvalKey,
    taskPlan: {
      operation: "schedule_campaign",
      campaign: {
        id: campaign.id,
        name: campaign.name,
        subject_line: campaign.subject_line,
      },
      scheduled_at: scheduledAt,
      scheduled_time_user_timezone: formatInTimezone(
        scheduledAt,
        context.timezone,
      ),
      audience_size: audience.audienceSize,
      rpc: "set_campaign_schedule",
    },
  });
};

async function recoverPersistedQueueState(
  context: ToolExecutionContext,
  campaignId: string,
): Promise<{
  handled: boolean;
  queuedRecipients: number;
  status: string | null;
}> {
  const { data, error } = await getQueryClient(context)
    .from("crm_campaigns")
    .select("status, total_recipients")
    .eq("id", campaignId)
    .eq("tenant_id", context.tenantId)
    .maybeSingle();

  if (error) {
    return { handled: false, queuedRecipients: 0, status: null };
  }

  const status = data?.status ?? null;
  return status === "queued" || status === "partially_queued"
    ? {
        handled: true,
        queuedRecipients: Number(data?.total_recipients || 0),
        status,
      }
    : { handled: false, queuedRecipients: 0, status };
}

function readSendFunctionError(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  return readString(value.error) || readString(value.message);
}

async function sendCampaignExecution(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const campaignId = readString(params.campaign_id);
  if (!campaignId) {
    return errorResult("campaign_id is required.", "validation_error");
  }

  const campaign = await fetchCampaign(context, campaignId);
  if (!campaign) {
    return errorResult("Campaign not found for this tenant.", "not_found");
  }

  if (!SENDABLE_CAMPAIGN_STATUSES.has(campaignStatus(campaign))) {
    return errorResult(
      "Only draft or scheduled campaigns can be sent now.",
      "invalid_status",
    );
  }

  if (!readString(campaign.subject_line)) {
    return errorResult(
      "Campaign must have a subject line before sending.",
      "missing_content",
    );
  }

  if (!readString(campaign.content)) {
    return errorResult(
      "Campaign must have body content before sending.",
      "missing_content",
    );
  }

  const { data: claimData, error: claimError } = await getQueryClient(
    context,
  ).rpc("claim_campaign_for_send", { campaign_id: campaignId });

  if (claimError) {
    throw claimError;
  }

  const claimResult = Array.isArray(claimData) ? claimData[0] : null;
  if (!claimResult?.success) {
    return errorResult(
      claimResult?.error_message || "Failed to claim campaign for sending.",
      "send_claim_failed",
    );
  }

  await getServiceClient(context)
    .from("crm_campaigns")
    .update({ scheduled_at: null })
    .eq("id", campaignId)
    .eq("tenant_id", context.tenantId);

  const authenticatedClient = getAuthenticatedClient(context);
  if (!authenticatedClient) {
    return errorResult(
      "Authenticated campaign send client was unavailable.",
      "authentication_required",
    );
  }

  const { data: sendResult, error: sendError } =
    await authenticatedClient.functions.invoke("send-email-campaign", {
      body: { campaignId },
    });

  const sendResultError = readSendFunctionError(sendResult);
  if (sendError || sendResultError) {
    const recovered = await recoverPersistedQueueState(context, campaignId);
    if (!recovered.handled) {
      await getServiceClient(context)
        .from("crm_campaigns")
        .update({
          status: "failed",
          send_error: sendError?.message ?? sendResultError,
        })
        .eq("id", campaignId)
        .eq("tenant_id", context.tenantId);
      return errorResult(
        sendError?.message ?? sendResultError ?? "Campaign send failed.",
        "send_failed",
      );
    }

    return createResult({
      success: true,
      message:
        recovered.status === "partially_queued"
          ? "Campaign queue build partially completed. The queue will resume automatically."
          : `Campaign queued - sending to ${recovered.queuedRecipients} recipients.`,
      blockType: "data_card",
      data: {
        id: campaignId,
        status: recovered.status,
        queued_recipients: recovered.queuedRecipients,
      },
      count: recovered.queuedRecipients,
    });
  }

  const queuedRecipients =
    isRecord(sendResult) && typeof sendResult.total_recipients === "number"
      ? sendResult.total_recipients
      : 0;
  const queuedCampaign = await fetchCampaign(context, campaignId);
  return createResult({
    success: true,
    message: `Campaign queued - sending to ${queuedRecipients} recipients.`,
    blockType: "data_card",
    data: queuedCampaign
      ? mapCampaignCard(queuedCampaign)
      : { id: campaignId, queued_recipients: queuedRecipients },
    count: queuedRecipients,
  });
}

export const sendCampaign: ToolImplementation = async (params, context) => {
  if (shouldExecuteAfterConfirmation(context, "send_campaign", params)) {
    return await sendCampaignExecution(params, context);
  }

  const campaignId = readString(params.campaign_id);
  if (!campaignId) {
    return errorResult("campaign_id is required.", "validation_error");
  }

  const campaign = await fetchCampaign(context, campaignId);
  if (!campaign) {
    return errorResult("Campaign not found for this tenant.", "not_found");
  }

  if (!SENDABLE_CAMPAIGN_STATUSES.has(campaignStatus(campaign))) {
    return errorResult(
      "Only draft or scheduled campaigns can be sent now.",
      "invalid_status",
    );
  }

  if (!readString(campaign.subject_line)) {
    return errorResult(
      "Campaign must have a subject line before sending.",
      "missing_content",
    );
  }

  if (!readString(campaign.content)) {
    return errorResult(
      "Campaign must have body content before sending.",
      "missing_content",
    );
  }

  const audience = await resolveAudienceSelection(
    context,
    {},
    await fetchExistingAudience(context, campaign),
  );
  const senderDisplayName =
    campaign.sender_display_name ?? campaign.sender_name;
  const senderEmailValue =
    campaign.actual_sender_email ?? campaign.sender_email;
  const senderIdentity =
    senderDisplayName && senderEmailValue
      ? `${senderDisplayName} <${senderEmailValue}>`
      : (senderDisplayName ?? senderEmailValue ?? null);
  const approvalKey = rememberConfirmation(context, "send_campaign", params);

  return confirmationResult({
    toolName: "send_campaign",
    riskLevel: "high",
    action: `Send campaign "${campaign.name}" now.`,
    affectedCount: audience.audienceSize,
    reversible: false,
    warnings: [
      ...audience.warnings,
      `This will send real emails to ${audience.audienceSize} recipients. This action cannot be undone.`,
    ],
    approvalKey,
    taskPlan: {
      operation: "send_campaign",
      risk: "high",
      campaign: {
        id: campaign.id,
        name: campaign.name,
        subject_line: campaign.subject_line,
        sender_identity: senderIdentity || null,
      },
      audience_size: audience.audienceSize,
      estimated_send_time: "immediate",
      irreversible_notice: `This will send real emails to ${audience.audienceSize} recipients. This action cannot be undone.`,
      pipeline: [
        "claim_campaign_for_send",
        "send-email-campaign Edge Function",
      ],
    },
  });
};

async function pauseResumeCampaignExecution(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const campaignId = readString(params.campaign_id);
  const action = readString(params.action);
  if (!campaignId || !action) {
    return errorResult(
      "campaign_id and action are required.",
      "validation_error",
    );
  }

  const campaign = await fetchCampaign(context, campaignId);
  if (!campaign) {
    return errorResult("Campaign not found for this tenant.", "not_found");
  }

  const status = campaignStatus(campaign);
  if (action === "pause" && !PAUSABLE_CAMPAIGN_STATUSES.has(status)) {
    return errorResult(
      "Only scheduled or actively sending campaigns can be paused.",
      "invalid_status",
    );
  }
  if (action === "resume" && status !== "paused") {
    return errorResult(
      "Only paused campaigns can be resumed.",
      "invalid_status",
    );
  }

  if (action === "pause") {
    const { data, error } = await getQueryClient(context).rpc(
      "pause_email_campaign_sending",
      {
        p_campaign_id: campaignId,
      },
    );
    if (error) {
      throw error;
    }
    const result = Array.isArray(data) ? data[0] : null;
    return createResult({
      success: true,
      message: "Campaign sending paused.",
      blockType: "data_card",
      data: {
        id: campaignId,
        status: "paused",
        messages_paused: result?.messages_paused ?? 0,
        jobs_paused: result?.jobs_paused ?? 0,
      },
      count: result?.messages_paused ?? 0,
    });
  }

  const { data, error } = await getQueryClient(context).rpc(
    "resume_email_campaign_sending",
    {
      p_campaign_id: campaignId,
    },
  );
  if (error) {
    throw error;
  }
  const result = Array.isArray(data) ? data[0] : null;
  return createResult({
    success: true,
    message: "Campaign sending resumed.",
    blockType: "data_card",
    data: {
      id: campaignId,
      status: "sending",
      messages_resumed: result?.messages_resumed ?? 0,
      jobs_resumed: result?.jobs_resumed ?? 0,
    },
    count: result?.messages_resumed ?? 0,
  });
}

export const pauseResumeCampaign: ToolImplementation = async (
  params,
  context,
) => {
  if (
    shouldExecuteAfterConfirmation(context, "pause_resume_campaign", params)
  ) {
    return await pauseResumeCampaignExecution(params, context);
  }

  const campaignId = readString(params.campaign_id);
  const requestedAction = readString(params.action);
  if (!campaignId || !requestedAction) {
    return errorResult(
      "campaign_id and action are required.",
      "validation_error",
    );
  }

  const campaign = await fetchCampaign(context, campaignId);
  if (!campaign) {
    return errorResult("Campaign not found for this tenant.", "not_found");
  }

  const status = campaignStatus(campaign);
  const proposedAction = requestedAction === "resume" ? "resume" : "pause";
  if (proposedAction === "pause" && !PAUSABLE_CAMPAIGN_STATUSES.has(status)) {
    return errorResult(
      "Only scheduled or actively sending campaigns can be paused.",
      "invalid_status",
    );
  }
  if (proposedAction === "resume" && status !== "paused") {
    return errorResult(
      "Only paused campaigns can be resumed.",
      "invalid_status",
    );
  }

  const approvalKey = rememberConfirmation(
    context,
    "pause_resume_campaign",
    params,
  );
  return confirmationResult({
    toolName: "pause_resume_campaign",
    riskLevel: "medium",
    action: `${proposedAction === "pause" ? "Pause" : "Resume"} campaign "${campaign.name}".`,
    affectedCount: 1,
    reversible: true,
    warnings: [],
    approvalKey,
    taskPlan: {
      operation: "pause_resume_campaign",
      campaign: { id: campaign.id, name: campaign.name },
      current_status: status,
      proposed_status: proposedAction === "pause" ? "paused" : "sending",
      rpc:
        proposedAction === "pause"
          ? "pause_email_campaign_sending"
          : "resume_email_campaign_sending",
    },
  });
};

export function campaignMutationImplementation(
  toolName: ToolName,
): ToolImplementation | null {
  switch (toolName) {
    case "create_campaign":
      return createCampaign;
    case "update_campaign":
      return updateCampaign;
    case "clone_campaign":
      return cloneCampaign;
    case "schedule_campaign":
      return scheduleCampaign;
    case "send_campaign":
      return sendCampaign;
    case "pause_resume_campaign":
      return pauseResumeCampaign;
    default:
      return null;
  }
}
