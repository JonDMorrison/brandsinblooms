import type {
  ActivityDescription,
  ActivityEvent,
  ActivityLink,
} from "@/types/activity";

function normalizeDescription(value: unknown): ActivityDescription {
  if (
    value &&
    typeof value === "object" &&
    "parts" in value &&
    Array.isArray((value as ActivityDescription).parts)
  ) {
    return value as ActivityDescription;
  }

  return { parts: [] };
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function normalizeLinks(value: unknown): ActivityLink[] {
  if (Array.isArray(value)) {
    return value as ActivityLink[];
  }

  return [];
}

export function normalizeActivityEventRow(row: any): ActivityEvent {
  return {
    id: String(row?.id ?? ""),
    timestamp: String(row?.timestamp ?? ""),
    customer_id: row?.customer_id ?? null,
    actor_type: row?.actor_type ?? "system",
    actor_id: row?.actor_id ?? null,
    source: row?.source ?? "sync",
    integration_name: row?.integration_name ?? null,
    activity_type: row?.activity_type ?? "unknown",
    status: row?.status ?? "success",
    title: row?.title ?? "",
    description: normalizeDescription(row?.description),
    metadata: normalizeRecord(row?.metadata),
    related_entities: normalizeRecord(row?.related_entities),
    links: normalizeLinks(row?.links),
    error_message: row?.error_message ?? null,
  };
}
