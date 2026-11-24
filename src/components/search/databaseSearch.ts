import {
  SEARCH_GROUP_METADATA,
  SEARCH_GROUP_ORDER,
  type SearchEntityType,
  type SearchGroupKey,
  type SearchResultGroup,
  type SearchResultItem,
} from "@/components/search/types";

export interface SearchEntitiesFunctionResponse {
  results?: unknown;
  groups?: unknown;
  warnings?: unknown;
  meta?: unknown;
}

const MAX_GROUP_RESULTS = 5;
const MAX_TOTAL_RESULTS = 30;
const DATABASE_SEARCH_CACHE_TTL_MS = 5_000;

type CachedDatabaseSearchGroups = {
  createdAt: number;
  groups: SearchResultGroup[];
};

const databaseSearchCache = new Map<string, CachedDatabaseSearchGroups>();

let databaseSearchCooldownUntil = 0;

function cloneGroups(groups: SearchResultGroup[]) {
  return groups.map((group) => ({
    ...group,
    results: group.results.map((result) => ({ ...result })),
  }));
}

function isSearchGroupKey(value: unknown): value is SearchGroupKey {
  return typeof value === "string" && value in SEARCH_GROUP_METADATA;
}

function isSearchEntityType(value: unknown): value is SearchEntityType {
  return typeof value === "string";
}

function normalizeSearchResultItem(
  value: unknown,
  group: SearchGroupKey,
): SearchResultItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<SearchResultItem>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.route !== "string" ||
    !isSearchEntityType(candidate.type)
  ) {
    return null;
  }

  return {
    id: candidate.id,
    type: candidate.type,
    title: candidate.title,
    subtitle:
      typeof candidate.subtitle === "string" ? candidate.subtitle : undefined,
    route: candidate.route,
    icon: typeof candidate.icon === "string" ? candidate.icon : undefined,
    categoryIcon: SEARCH_GROUP_METADATA[group].icon,
    metadata:
      typeof candidate.metadata === "string" ? candidate.metadata : undefined,
    keywords: Array.isArray(candidate.keywords)
      ? candidate.keywords.filter(
          (keyword): keyword is string => typeof keyword === "string",
        )
      : undefined,
    group,
  };
}

export function normalizeSearchGroups(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as SearchResultGroup[];
  }

  return value.flatMap((groupValue) => {
    if (!groupValue || typeof groupValue !== "object") {
      return [] as SearchResultGroup[];
    }

    const candidate = groupValue as Partial<SearchResultGroup>;

    if (!isSearchGroupKey(candidate.category)) {
      return [] as SearchResultGroup[];
    }

    const results = Array.isArray(candidate.results)
      ? candidate.results
          .map((item) => normalizeSearchResultItem(item, candidate.category!))
          .filter((item): item is SearchResultItem => Boolean(item))
      : [];

    if (results.length === 0) {
      return [] as SearchResultGroup[];
    }

    return [
      {
        category: candidate.category,
        title:
          typeof candidate.title === "string"
            ? candidate.title
            : SEARCH_GROUP_METADATA[candidate.category].title,
        icon:
          typeof candidate.icon === "string"
            ? candidate.icon
            : SEARCH_GROUP_METADATA[candidate.category].icon,
        results,
      },
    ];
  });
}

export function mergeSearchGroups(
  staticGroups: SearchResultGroup[],
  databaseGroups: SearchResultGroup[],
) {
  const mergedByGroup = new Map<SearchGroupKey, SearchResultItem[]>();
  const seenRoutes = new Set<string>();

  const appendGroups = (groups: SearchResultGroup[]) => {
    for (const group of groups) {
      for (const result of group.results) {
        if (seenRoutes.has(result.route)) {
          continue;
        }

        seenRoutes.add(result.route);

        const existing = mergedByGroup.get(result.group) ?? [];
        mergedByGroup.set(result.group, [...existing, result]);
      }
    }
  };

  appendGroups(staticGroups);
  appendGroups(databaseGroups);

  const mergedGroups = SEARCH_GROUP_ORDER.flatMap((groupKey) => {
    const results = mergedByGroup.get(groupKey)?.slice(0, MAX_GROUP_RESULTS) ?? [];

    if (results.length === 0) {
      return [] as SearchResultGroup[];
    }

    return [
      {
        category: groupKey,
        title: SEARCH_GROUP_METADATA[groupKey].title,
        icon: SEARCH_GROUP_METADATA[groupKey].icon,
        results,
      },
    ];
  });

  const cappedGroups: SearchResultGroup[] = [];
  let totalCount = 0;

  for (const group of mergedGroups) {
    if (totalCount >= MAX_TOTAL_RESULTS) {
      break;
    }

    const remaining = MAX_TOTAL_RESULTS - totalCount;
    const results = group.results.slice(0, remaining);

    if (results.length === 0) {
      continue;
    }

    cappedGroups.push({
      ...group,
      results,
    });
    totalCount += results.length;
  }

  return cappedGroups;
}

export function applyRouteVisitBoost(
  groups: SearchResultGroup[],
  routeVisitCounts: Record<string, number>,
) {
  if (Object.keys(routeVisitCounts).length === 0) {
    return groups;
  }

  return groups.map((group) => ({
    ...group,
    results: [...group.results]
      .map((result, index) => ({
        index,
        result,
        boost: routeVisitCounts[result.route] ?? 0,
      }))
      .sort((left, right) => right.boost - left.boost || left.index - right.index)
      .map(({ result }) => result),
  }));
}

export function getRetryAfterSeconds(error: unknown) {
  const context = (error as { context?: { status?: number; body?: unknown; headers?: Headers } })
    ?.context;
  const status = context?.status ?? (error as { status?: number })?.status;

  if (status !== 429) {
    return null;
  }

  const retryAfterHeader = context?.headers?.get?.("Retry-After");
  const parsedHeader = Number(retryAfterHeader);

  if (Number.isFinite(parsedHeader) && parsedHeader > 0) {
    return parsedHeader;
  }

  let parsedBody: Record<string, unknown> | null = null;

  if (typeof context?.body === "string") {
    try {
      parsedBody = JSON.parse(context.body) as Record<string, unknown>;
    } catch {
      parsedBody = null;
    }
  } else if (context?.body && typeof context.body === "object") {
    parsedBody = context.body as Record<string, unknown>;
  }

  const parsedBodyRetryAfter = Number(parsedBody?.retry_after_seconds);

  if (Number.isFinite(parsedBodyRetryAfter) && parsedBodyRetryAfter > 0) {
    return parsedBodyRetryAfter;
  }

  return 60;
}

const ENTITY_ERROR_LABELS: Record<string, string> = {
  customer: "Customer",
  campaign: "Campaign",
  campaign_recipient: "Recipient",
  product: "Product",
  segment: "Segment",
  persona: "Persona",
  automation: "Automation",
  form: "Form",
  saved_block: "Saved block",
  sms_campaign: "SMS campaign",
  sms_automation: "SMS automation",
  activity: "Activity",
  ticket: "Ticket",
  integration: "Integration",
};

function readTypeList(meta: unknown, key: string) {
  if (!meta || typeof meta !== "object") return [] as string[];
  const value = (meta as Record<string, unknown>)[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * An error message when part of the search timed out or failed, so the
 * palette shows an error state instead of "No matches". Null otherwise.
 */
export function getSearchErrorFromResponse(
  response: SearchEntitiesFunctionResponse | null | undefined,
) {
  const timedOut = readTypeList(response?.meta, "timed_out_types");
  const failed = readTypeList(response?.meta, "failed_types");
  const describe = (types: string[]) =>
    types.map((type) => ENTITY_ERROR_LABELS[type] ?? type).join(", ").toLowerCase();
  if (timedOut.length > 0) {
    const label = describe(timedOut);
    return `Search took too long for ${label} records, so some results are missing. Try again or use a longer search term.`;
  }
  if (failed.length > 0) {
    return `Search failed for ${describe(failed)} records, so some results are missing. Try again.`;
  }
  return null;
}

export function getSearchWarningFromResponse(
  response: SearchEntitiesFunctionResponse | null | undefined,
) {
  return Array.isArray(response?.warnings) && response.warnings.length > 0
    ? "Some results may be missing."
    : null;
}

export function getCachedDatabaseSearchGroups(query: string) {
  const cachedEntry = databaseSearchCache.get(query);

  if (!cachedEntry) {
    return [];
  }

  if (Date.now() - cachedEntry.createdAt > DATABASE_SEARCH_CACHE_TTL_MS) {
    databaseSearchCache.delete(query);
    return [];
  }

  return cloneGroups(cachedEntry.groups);
}

export function setCachedDatabaseSearchGroups(
  query: string,
  groups: SearchResultGroup[],
) {
  databaseSearchCache.set(query, {
    createdAt: Date.now(),
    groups: cloneGroups(groups),
  });
}

export function isDatabaseSearchRateLimited() {
  return Date.now() < databaseSearchCooldownUntil;
}

export function setDatabaseSearchCooldown(retryAfterSeconds: number) {
  databaseSearchCooldownUntil = Date.now() + retryAfterSeconds * 1_000;
}