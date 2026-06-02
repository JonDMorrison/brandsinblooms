import type {
  EntitySummary,
  JsonArray,
  JsonObject,
  JsonValue,
  PersistenceClient,
  ToolExecutionStatus,
} from "./types.ts";

type WorkspaceEntityType =
  | "customer"
  | "product"
  | "campaign"
  | "segment"
  | "order";

type WorkspaceActionType =
  | "created"
  | "updated"
  | "deleted"
  | "sent"
  | "scheduled";

type WorkspaceActionStatus = "completed" | "failed";
type ResponseDensityPreference = "concise" | "balanced" | "detailed";

type RecentEntity = {
  entityType: WorkspaceEntityType;
  entityId: string;
  displayName: string;
  lastAccessedAt: string;
};

type RecentAction = {
  actionType: WorkspaceActionType;
  entityType: WorkspaceEntityType;
  entityDisplayName: string;
  status: WorkspaceActionStatus;
  timestamp: string;
};

type PinnedContextEntity = {
  entityType: WorkspaceEntityType;
  entityId: string;
  displayName: string;
  pinnedAt: string;
};

type WorkspaceMemory = {
  recentEntities: RecentEntity[];
  recentActions: RecentAction[];
  pinnedContext: PinnedContextEntity[];
};

export type PostResponseToolExecution = {
  toolName: string;
  input: JsonObject;
  output: JsonValue | null;
  status: ToolExecutionStatus;
  errorMessage: string | null;
  executionTimeMs: number | null;
};

const MAX_RECENT_ENTITIES = 10;
const MAX_RECENT_ACTIONS = 5;
const MAX_PINNED_CONTEXT = 3;
const MAX_LIST_ENTITIES_PER_TOOL = 3;
const STAGE_ONE_THRESHOLD = 5;
const STAGE_TWO_THRESHOLD = 15;
const STAGE_THREE_THRESHOLD = 30;

const QUERY_ENTITY_BY_TOOL: Record<string, WorkspaceEntityType> = {
  query_customers: "customer",
  get_customer_detail: "customer",
  query_products: "product",
  get_product_detail: "product",
  query_campaigns: "campaign",
  query_segments: "segment",
  query_orders: "order",
};

const CONCISE_SIGNALS = [
  "concise",
  "shorter",
  "brief",
  "less detail",
  "too long",
  "verbose",
  "tl;dr",
];

const DETAILED_SIGNALS = [
  "explain",
  "detail",
  "elaborate",
  "more info",
  "why",
  "how does",
];

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

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readWorkspaceEntityType(value: unknown): WorkspaceEntityType | null {
  switch (value) {
    case "customer":
    case "product":
    case "campaign":
    case "segment":
    case "order":
      return value;
    default:
      return null;
  }
}

function readActionType(value: unknown): WorkspaceActionType | null {
  switch (value) {
    case "created":
    case "updated":
    case "deleted":
    case "sent":
    case "scheduled":
      return value;
    default:
      return null;
  }
}

function readActionStatus(value: unknown): WorkspaceActionStatus | null {
  return value === "completed" || value === "failed" ? value : null;
}

function parseRecentEntity(value: unknown): RecentEntity | null {
  if (!isRecord(value)) {
    return null;
  }

  const entityType = readWorkspaceEntityType(value.entity_type);
  const entityId = readString(value.entity_id);
  const displayName = readString(value.display_name);
  const lastAccessedAt = readString(value.last_accessed_at);

  if (!entityType || !entityId || !displayName || !lastAccessedAt) {
    return null;
  }

  return { entityType, entityId, displayName, lastAccessedAt };
}

function parseRecentAction(value: unknown): RecentAction | null {
  if (!isRecord(value)) {
    return null;
  }

  const actionType = readActionType(value.action_type);
  const entityType = readWorkspaceEntityType(value.entity_type);
  const entityDisplayName = readString(value.entity_display_name);
  const status = readActionStatus(value.status);
  const timestamp = readString(value.timestamp);

  if (
    !actionType ||
    !entityType ||
    !entityDisplayName ||
    !status ||
    !timestamp
  ) {
    return null;
  }

  return { actionType, entityType, entityDisplayName, status, timestamp };
}

function parsePinnedContextEntity(value: unknown): PinnedContextEntity | null {
  if (!isRecord(value)) {
    return null;
  }

  const entityType = readWorkspaceEntityType(value.entity_type);
  const entityId = readString(value.entity_id);
  const displayName = readString(value.display_name);
  const pinnedAt = readString(value.pinned_at);

  if (!entityType || !entityId || !displayName || !pinnedAt) {
    return null;
  }

  return { entityType, entityId, displayName, pinnedAt };
}

function parseWorkspaceMemory(value: unknown): WorkspaceMemory {
  const record = isRecord(value) ? value : {};
  const recentEntities = Array.isArray(record.recent_entities)
    ? record.recent_entities
        .map(parseRecentEntity)
        .filter((item): item is RecentEntity => item !== null)
    : [];
  const recentActions = Array.isArray(record.recent_actions)
    ? record.recent_actions
        .map(parseRecentAction)
        .filter((item): item is RecentAction => item !== null)
    : [];
  const pinnedContext = Array.isArray(record.pinned_context)
    ? record.pinned_context
        .map(parsePinnedContextEntity)
        .filter((item): item is PinnedContextEntity => item !== null)
    : [];

  return {
    recentEntities: recentEntities.slice(0, MAX_RECENT_ENTITIES),
    recentActions: recentActions.slice(0, MAX_RECENT_ACTIONS),
    pinnedContext: pinnedContext.slice(0, MAX_PINNED_CONTEXT),
  };
}

function entityToJson(entity: RecentEntity): JsonObject {
  return {
    entity_type: entity.entityType,
    entity_id: entity.entityId,
    display_name: entity.displayName,
    last_accessed_at: entity.lastAccessedAt,
  };
}

function actionToJson(action: RecentAction): JsonObject {
  return {
    action_type: action.actionType,
    entity_type: action.entityType,
    entity_display_name: action.entityDisplayName,
    status: action.status,
    timestamp: action.timestamp,
  };
}

function pinnedEntityToJson(entity: PinnedContextEntity): JsonObject {
  return {
    entity_type: entity.entityType,
    entity_id: entity.entityId,
    display_name: entity.displayName,
    pinned_at: entity.pinnedAt,
  };
}

function workspaceMemoryToJson(
  memory: WorkspaceMemory,
  baseMemory: JsonObject = {},
): JsonObject {
  return {
    ...baseMemory,
    recent_entities: memory.recentEntities.map(entityToJson),
    recent_actions: memory.recentActions.map(actionToJson),
    pinned_context: memory.pinnedContext.map(pinnedEntityToJson),
  };
}

function readOutputRecord(
  execution: PostResponseToolExecution,
): JsonObject | null {
  return isJsonObject(execution.output) ? execution.output : null;
}

function outputHasConfirmationRequirement(
  execution: PostResponseToolExecution,
): boolean {
  return readOutputRecord(execution)?.confirmation_required === true;
}

function readOutputData(
  execution: PostResponseToolExecution,
): JsonValue | null {
  const output = readOutputRecord(execution);
  return output?.data ?? null;
}

function fullNameFromRecord(record: Record<string, unknown>): string | null {
  const firstName = readString(record.first_name);
  const lastName = readString(record.last_name);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return fullName || null;
}

function displayNameFromRecord(
  entityType: WorkspaceEntityType,
  record: Record<string, unknown>,
  entityId: string,
): string {
  return (
    readString(record.display_name) ||
    readString(record.name) ||
    readString(record.title) ||
    fullNameFromRecord(record) ||
    readString(record.email) ||
    readString(record.subject_line) ||
    readString(record.sku) ||
    readString(record.external_id) ||
    readString(record.order_number) ||
    `${entityType} ${entityId.slice(0, 8)}`
  );
}

function readEntityId(
  entityType: WorkspaceEntityType,
  record: Record<string, unknown>,
): string | null {
  return (
    readString(record.id) ||
    readString(record[`${entityType}_id`]) ||
    (entityType === "order" ? readString(record.external_id) : null)
  );
}

function entityFromRecord(
  entityType: WorkspaceEntityType,
  value: unknown,
  timestamp: string,
): RecentEntity | null {
  if (!isRecord(value)) {
    return null;
  }

  const entityId = readEntityId(entityType, value);
  if (!entityId) {
    return null;
  }

  return {
    entityType,
    entityId,
    displayName: displayNameFromRecord(entityType, value, entityId),
    lastAccessedAt: timestamp,
  };
}

function entityFromToolInput(
  entityType: WorkspaceEntityType,
  input: JsonObject,
  timestamp: string,
): RecentEntity | null {
  return entityFromRecord(entityType, input, timestamp);
}

function inferEntityTypeFromToolName(
  toolName: string,
): WorkspaceEntityType | null {
  if (
    toolName.includes("customer") ||
    toolName.includes("consent") ||
    toolName.includes("tag_customers")
  ) {
    return "customer";
  }
  if (toolName.includes("product")) {
    return "product";
  }
  if (toolName.includes("campaign")) {
    return "campaign";
  }
  if (toolName.includes("segment")) {
    return "segment";
  }
  if (toolName.includes("order")) {
    return "order";
  }
  return null;
}

function actionTypeFromToolName(toolName: string): WorkspaceActionType | null {
  if (toolName === "send_campaign") {
    return "sent";
  }
  if (toolName === "schedule_campaign") {
    return "scheduled";
  }
  if (toolName.startsWith("create_") || toolName === "clone_campaign") {
    return "created";
  }
  if (toolName.startsWith("delete_")) {
    return "deleted";
  }
  if (
    toolName.startsWith("update_") ||
    toolName.startsWith("toggle_") ||
    toolName.startsWith("pause_resume_") ||
    toolName.startsWith("assign_") ||
    toolName.startsWith("bulk_tag_") ||
    toolName.startsWith("manage_")
  ) {
    return "updated";
  }
  return null;
}

function extractQueryEntities(
  execution: PostResponseToolExecution,
  timestamp: string,
): RecentEntity[] {
  if (execution.status !== "completed") {
    return [];
  }

  if (execution.toolName === "get_segment_members") {
    const segmentEntity = entityFromToolInput(
      "segment",
      execution.input,
      timestamp,
    );
    const outputData = readOutputData(execution);
    const memberEntities = Array.isArray(outputData)
      ? outputData
          .slice(0, MAX_LIST_ENTITIES_PER_TOOL)
          .map((item) => entityFromRecord("customer", item, timestamp))
          .filter((item): item is RecentEntity => item !== null)
      : [];

    return [segmentEntity, ...memberEntities]
      .filter((item): item is RecentEntity => item !== null)
      .slice(0, MAX_LIST_ENTITIES_PER_TOOL);
  }

  const entityType = QUERY_ENTITY_BY_TOOL[execution.toolName];
  if (!entityType) {
    return [];
  }

  const data = readOutputData(execution);
  if (Array.isArray(data)) {
    return data
      .slice(0, MAX_LIST_ENTITIES_PER_TOOL)
      .map((item) => entityFromRecord(entityType, item, timestamp))
      .filter((item): item is RecentEntity => item !== null);
  }

  const entity = entityFromRecord(entityType, data, timestamp);
  return entity ? [entity] : [];
}

function extractMutationEntity(
  execution: PostResponseToolExecution,
  entityType: WorkspaceEntityType,
  timestamp: string,
): RecentEntity | null {
  const data = readOutputData(execution);
  const outputEntity = Array.isArray(data)
    ? entityFromRecord(entityType, data[0], timestamp)
    : entityFromRecord(entityType, data, timestamp);

  return (
    outputEntity || entityFromToolInput(entityType, execution.input, timestamp)
  );
}

function extractEntities(
  toolExecutions: PostResponseToolExecution[],
  timestamp: string,
): RecentEntity[] {
  const entities: RecentEntity[] = [];

  for (const execution of toolExecutions) {
    entities.push(...extractQueryEntities(execution, timestamp));

    const actionType = actionTypeFromToolName(execution.toolName);
    const entityType = inferEntityTypeFromToolName(execution.toolName);
    if (
      actionType &&
      entityType &&
      execution.status === "completed" &&
      !outputHasConfirmationRequirement(execution)
    ) {
      const entity = extractMutationEntity(execution, entityType, timestamp);
      if (entity) {
        entities.push(entity);
      }
    }
  }

  return entities;
}

function extractActions(
  toolExecutions: PostResponseToolExecution[],
  timestamp: string,
): RecentAction[] {
  const actions: RecentAction[] = [];

  for (const execution of toolExecutions) {
    const actionType = actionTypeFromToolName(execution.toolName);
    const entityType = inferEntityTypeFromToolName(execution.toolName);
    if (
      !actionType ||
      !entityType ||
      outputHasConfirmationRequirement(execution)
    ) {
      continue;
    }

    if (execution.status !== "completed" && execution.status !== "failed") {
      continue;
    }

    const entity = extractMutationEntity(execution, entityType, timestamp);
    const fallbackName = execution.toolName.replace(/_/g, " ");

    actions.push({
      actionType,
      entityType,
      entityDisplayName: entity?.displayName ?? fallbackName,
      status: execution.status === "completed" ? "completed" : "failed",
      timestamp,
    });
  }

  return actions;
}

function mergeRecentEntities(
  current: RecentEntity[],
  incoming: RecentEntity[],
): RecentEntity[] {
  const seen = new Set<string>();
  const merged: RecentEntity[] = [];

  for (const entity of [...incoming, ...current]) {
    const key = `${entity.entityType}:${entity.entityId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(entity);
    if (merged.length >= MAX_RECENT_ENTITIES) {
      break;
    }
  }

  return merged;
}

function mergeRecentActions(
  current: RecentAction[],
  incoming: RecentAction[],
): RecentAction[] {
  return [...incoming, ...current].slice(0, MAX_RECENT_ACTIONS);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function entityFromPrefetchedSummary(
  summary: EntitySummary,
  timestamp: string,
): RecentEntity {
  return {
    entityType: summary.entityType,
    entityId: summary.entityId,
    displayName: summary.name,
    lastAccessedAt: timestamp,
  };
}

function messageReferencesPrefetchedEntity(
  message: string,
  entityType: EntitySummary["entityType"],
): boolean {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    return false;
  }

  const escapedEntityType = escapeRegExp(entityType);
  const patterns = [
    /\bthis\b/i,
    /\bit\b/i,
    new RegExp(`\\bthis\\s+${escapedEntityType}\\b`, "i"),
    new RegExp(`\\b(?:the\\s+)?current\\s+${escapedEntityType}\\b`, "i"),
  ];

  return patterns.some((pattern) => pattern.test(normalizedMessage));
}

function detectDensityPreference(
  message: string,
): ResponseDensityPreference | null {
  const normalized = message.toLowerCase();
  const hasConciseSignal = CONCISE_SIGNALS.some((signal) =>
    normalized.includes(signal),
  );
  const hasDetailedSignal = DETAILED_SIGNALS.some((signal) =>
    normalized.includes(signal),
  );

  if (hasConciseSignal === hasDetailedSignal) {
    return null;
  }

  return hasConciseSignal ? "concise" : "detailed";
}

function mergePreferences(
  value: unknown,
  densityPreference: ResponseDensityPreference | null,
): JsonObject {
  const preferences = isJsonObject(value) ? { ...value } : {};

  if (densityPreference) {
    preferences.response_density = densityPreference;
  }

  return preferences;
}

function advanceOnboardingStage(
  currentStage: number,
  interactionCount: number,
): number {
  if (currentStage === 0 && interactionCount >= STAGE_ONE_THRESHOLD) {
    return 1;
  }

  if (currentStage === 1 && interactionCount >= STAGE_TWO_THRESHOLD) {
    return 2;
  }

  if (currentStage === 2 && interactionCount >= STAGE_THREE_THRESHOLD) {
    return 3;
  }

  return currentStage;
}

export async function processPostResponse(
  serviceClient: PersistenceClient,
  tenantId: string,
  userId: string,
  toolExecutions: PostResponseToolExecution[],
  userMessage: string,
  resolvedEntitySummary: EntitySummary | null = null,
): Promise<void> {
  const timestamp = new Date().toISOString();
  const incomingEntities = extractEntities(toolExecutions, timestamp);
  const prefetchedEntity =
    resolvedEntitySummary &&
    messageReferencesPrefetchedEntity(
      userMessage,
      resolvedEntitySummary.entityType,
    )
      ? entityFromPrefetchedSummary(resolvedEntitySummary, timestamp)
      : null;
  const incomingActions = extractActions(toolExecutions, timestamp);
  const densityPreference = detectDensityPreference(userMessage);
  const nextIncomingEntities = prefetchedEntity
    ? [prefetchedEntity, ...incomingEntities]
    : incomingEntities;

  const { data, error: selectError } = await serviceClient
    .from("bloom_user_profiles")
    .select(
      "interaction_count, onboarding_stage, workspace_memory, preferences",
    )
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (selectError) {
    throw new Error(
      `Failed to load Bloom workspace memory: ${selectError.message}`,
    );
  }

  const currentRecord: Record<string, unknown> = isRecord(data) ? data : {};
  const currentMemoryJson = isJsonObject(currentRecord.workspace_memory)
    ? currentRecord.workspace_memory
    : {};
  const currentMemory = parseWorkspaceMemory(currentRecord.workspace_memory);
  const nextInteractionCount =
    readNumber(currentRecord.interaction_count, 0) + 1;
  const nextOnboardingStage = advanceOnboardingStage(
    readNumber(currentRecord.onboarding_stage, 0),
    nextInteractionCount,
  );
  const hasWorkspaceMemoryUpdates =
    nextIncomingEntities.length > 0 || incomingActions.length > 0;
  const nextMemory = hasWorkspaceMemoryUpdates
    ? workspaceMemoryToJson(
        {
          recentEntities: mergeRecentEntities(
            currentMemory.recentEntities,
            nextIncomingEntities,
          ),
          recentActions: mergeRecentActions(
            currentMemory.recentActions,
            incomingActions,
          ),
          pinnedContext: currentMemory.pinnedContext,
        },
        currentMemoryJson,
      )
    : currentMemoryJson;
  const nextPreferences = mergePreferences(
    currentRecord.preferences,
    densityPreference,
  );

  const { error: updateError } = await serviceClient
    .from("bloom_user_profiles")
    .upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        interaction_count: nextInteractionCount,
        onboarding_stage: nextOnboardingStage,
        workspace_memory: nextMemory,
        preferences: nextPreferences,
      },
      { onConflict: "tenant_id,user_id" },
    );

  if (updateError) {
    throw new Error(
      `Failed to update Bloom profile after response: ${updateError.message}`,
    );
  }
}
