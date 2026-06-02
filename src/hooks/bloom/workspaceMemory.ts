import type { BloomJsonObject, BloomPageEntityType } from "@/hooks/bloom/types";

export const MAX_PINNED_CONTEXT_ITEMS = 3;

export interface BloomWorkspaceMemoryEntity {
  entityType: string;
  entityId: string | null;
  displayName: string;
}

export interface BloomWorkspaceMemoryPinnedEntity extends BloomWorkspaceMemoryEntity {
  entityType: BloomPageEntityType;
  entityId: string;
  pinnedAt: string | null;
}

export interface BloomWorkspaceMemoryAction {
  actionType: string;
  entityType: string | null;
  entityDisplayName: string;
}

export interface BloomWorkspaceMemorySnapshot {
  pinnedContext: BloomWorkspaceMemoryPinnedEntity[];
  recentEntities: BloomWorkspaceMemoryEntity[];
  recentActions: BloomWorkspaceMemoryAction[];
}

const RECENT_ENTITY_LIMIT = 3;
const RECENT_ACTION_LIMIT = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function isBloomPageEntityType(value: unknown): value is BloomPageEntityType {
  return (
    value === "customer" ||
    value === "product" ||
    value === "campaign" ||
    value === "segment"
  );
}

function normalizeEntity(value: unknown): BloomWorkspaceMemoryEntity | null {
  if (!isRecord(value)) {
    return null;
  }

  const entityType =
    readString(value.entity_type) ?? readString(value.entityType);
  const entityId =
    readString(value.entity_id) ??
    readString(value.entityId) ??
    readString(value.id);
  const displayName =
    readString(value.display_name) ??
    readString(value.displayName) ??
    readString(value.name) ??
    readString(value.label);

  if (!entityType || !displayName) {
    return null;
  }

  return { entityType, entityId, displayName };
}

function normalizePinnedEntity(
  value: unknown,
): BloomWorkspaceMemoryPinnedEntity | null {
  if (!isRecord(value)) {
    return null;
  }

  const entity = normalizeEntity(value);
  if (
    !entity ||
    !isBloomPageEntityType(entity.entityType) ||
    !entity.entityId
  ) {
    return null;
  }

  return {
    entityType: entity.entityType,
    entityId: entity.entityId,
    displayName: entity.displayName,
    pinnedAt:
      readString(value.pinned_at) ??
      readString(value.pinnedAt) ??
      readString(value.created_at),
  };
}

function normalizeAction(value: unknown): BloomWorkspaceMemoryAction | null {
  if (!isRecord(value)) {
    return null;
  }

  const actionType =
    readString(value.action_type) ?? readString(value.actionType);
  const entityDisplayName =
    readString(value.entity_display_name) ??
    readString(value.entityDisplayName) ??
    readString(value.display_name) ??
    readString(value.displayName);

  if (!actionType || !entityDisplayName) {
    return null;
  }

  return {
    actionType,
    entityType: readString(value.entity_type) ?? readString(value.entityType),
    entityDisplayName,
  };
}

function normalizeArray<T>(
  value: unknown,
  parser: (entry: unknown) => T | null,
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const parsed = parser(entry);
    return parsed ? [parsed] : [];
  });
}

export function normalizeBloomWorkspaceMemory(
  memory: BloomJsonObject | null | undefined,
): BloomWorkspaceMemorySnapshot {
  const source = isRecord(memory) ? memory : {};

  return {
    pinnedContext: normalizeArray(
      source.pinned_context ?? source.pinnedContext,
      normalizePinnedEntity,
    ).slice(0, MAX_PINNED_CONTEXT_ITEMS),
    recentEntities: normalizeArray(
      source.recent_entities ?? source.recentEntities,
      normalizeEntity,
    ).slice(0, RECENT_ENTITY_LIMIT),
    recentActions: normalizeArray(
      source.recent_actions ?? source.recentActions,
      normalizeAction,
    ).slice(0, RECENT_ACTION_LIMIT),
  };
}

export function buildPinnedContextKey(entry: {
  entityType: BloomPageEntityType;
  entityId: string;
}) {
  return `${entry.entityType}:${entry.entityId}`;
}
