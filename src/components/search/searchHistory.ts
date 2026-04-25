import { supabase } from "@/integrations/supabase/client";
import type {
  SearchEntityType,
  SearchGroupKey,
  SearchResultItem,
} from "@/components/search/types";

const STORAGE_KEY_PREFIX = "command-palette-history:v2";
const MAX_RECENT_SEARCHES = 10;
const MAX_RECENT_ITEMS = 8;

type StoredRecentSearch = {
  count: number;
  lastSearchedAt: string;
  normalizedQuery: string;
  query: string;
  selectedResultTitle?: string;
};

type StoredRecentItem = {
  count: number;
  item: SearchResultItem;
  lastVisitedAt: string;
};

type StoredSearchHistory = {
  recentItems: StoredRecentItem[];
  recentSearches: StoredRecentSearch[];
};

type RemoteRecentSearchRow = {
  normalized_query: string;
  query: string;
  searched_at: string;
  selected_result_title?: string | null;
  usage_count: number;
};

type RemoteRecentItemRow = {
  category_icon: string;
  entity_id: string;
  entity_type: string;
  group_key: string;
  icon?: string | null;
  keywords?: string[] | null;
  metadata?: string | null;
  route: string;
  subtitle?: string | null;
  title: string;
  visit_count: number;
  visited_at: string;
};

const EMPTY_SEARCH_HISTORY: StoredSearchHistory = {
  recentItems: [],
  recentSearches: [],
};

function getStorageKey(userId?: string | null) {
  return `${STORAGE_KEY_PREFIX}:${userId ?? "anonymous"}`;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function sanitizeSearchItem(item: SearchResultItem): SearchResultItem {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    subtitle: item.subtitle,
    route: item.route,
    icon: item.icon,
    categoryIcon: item.categoryIcon,
    metadata: item.metadata,
    keywords: item.keywords ? [...item.keywords] : undefined,
    group: item.group,
  };
}

function readStoredHistory(userId?: string | null): StoredSearchHistory {
  if (!canUseStorage()) {
    return EMPTY_SEARCH_HISTORY;
  }

  try {
    const rawValue = window.localStorage.getItem(getStorageKey(userId));

    if (!rawValue) {
      return EMPTY_SEARCH_HISTORY;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<StoredSearchHistory>;

    return {
      recentSearches: Array.isArray(parsedValue.recentSearches)
        ? parsedValue.recentSearches.filter(
            (entry): entry is StoredRecentSearch =>
              Boolean(entry) &&
              typeof entry.query === "string" &&
              typeof entry.normalizedQuery === "string" &&
              typeof entry.count === "number" &&
              typeof entry.lastSearchedAt === "string",
          )
        : [],
      recentItems: Array.isArray(parsedValue.recentItems)
        ? parsedValue.recentItems.filter(
            (entry): entry is StoredRecentItem =>
              Boolean(entry) &&
              typeof entry.count === "number" &&
              typeof entry.lastVisitedAt === "string" &&
              Boolean(entry.item) &&
              typeof entry.item.id === "string" &&
              typeof entry.item.route === "string",
          )
        : [],
    };
  } catch {
    return EMPTY_SEARCH_HISTORY;
  }
}

function writeStoredHistory(userId: string | null | undefined, history: StoredSearchHistory) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(history));
}

function sanitizeRecentSearchEntry(entry: StoredRecentSearch): RecentSearchQueryEntry {
  return {
    count: entry.count,
    lastSearchedAt: entry.lastSearchedAt,
    normalizedQuery: entry.normalizedQuery,
    query: entry.query,
    selectedResultTitle: entry.selectedResultTitle,
  };
}

function sanitizeStoredRecentSearches(entries: StoredRecentSearch[]) {
  return entries
    .slice(0, MAX_RECENT_SEARCHES)
    .map((entry) => sanitizeRecentSearchEntry(entry));
}

function extractSearchItemIdentity(item: SearchResultItem) {
  const parts = item.id.split(":");

  if (parts.length >= 3) {
    const [, type, ...rest] = parts;

    return {
      entityId: rest.join(":") || item.id,
      entityType: (type || item.type) as SearchEntityType,
    };
  }

  return {
    entityId: item.route || item.id,
    entityType: item.type,
  };
}

function applyRecentSearchEntries(
  userId: string | null | undefined,
  recentSearches: StoredRecentSearch[],
) {
  const history = readStoredHistory(userId);

  writeStoredHistory(userId, {
    ...history,
    recentSearches,
  });

  return sanitizeStoredRecentSearches(recentSearches);
}

function applyRecentItemEntries(
  userId: string | null | undefined,
  recentItems: StoredRecentItem[],
) {
  const history = readStoredHistory(userId);

  writeStoredHistory(userId, {
    ...history,
    recentItems,
  });

  return recentItems.slice(0, MAX_RECENT_ITEMS).map((entry): RecentSearchItemEntry => ({
    count: entry.count,
    item: sanitizeSearchItem(entry.item),
    lastVisitedAt: entry.lastVisitedAt,
  }));
}

function mapRemoteRecentItem(entry: RemoteRecentItemRow): StoredRecentItem {
  return {
    count: entry.visit_count,
    item: sanitizeSearchItem({
      id: `remote:${entry.entity_type}:${entry.entity_id}`,
      type: entry.entity_type as SearchEntityType,
      title: entry.title,
      subtitle: typeof entry.subtitle === "string" ? entry.subtitle : undefined,
      route: entry.route,
      icon: typeof entry.icon === "string" ? entry.icon : undefined,
      categoryIcon: entry.category_icon,
      metadata: typeof entry.metadata === "string" ? entry.metadata : undefined,
      keywords: Array.isArray(entry.keywords)
        ? entry.keywords.filter(
            (keyword): keyword is string => typeof keyword === "string",
          )
        : undefined,
      group: entry.group_key as SearchGroupKey,
    }),
    lastVisitedAt: entry.visited_at,
  };
}

export type SearchHistoryUsageSnapshot = {
  queryCounts: Record<string, number>;
  recentItemRoutes: Record<string, number>;
};

export type RecentSearchQueryEntry = {
  count: number;
  lastSearchedAt: string;
  normalizedQuery: string;
  query: string;
  selectedResultTitle?: string;
};

export type RecentSearchItemEntry = {
  count: number;
  item: SearchResultItem;
  lastVisitedAt: string;
};

export function getRecentSearchEntries(userId?: string | null) {
  return sanitizeStoredRecentSearches(readStoredHistory(userId).recentSearches);
}

export function getRecentSearches(userId?: string | null) {
  return getRecentSearchEntries(userId).map((entry) => entry.query);
}

export function saveRecentSearch(
  userId: string | null | undefined,
  query: string,
  options?: { selectedResultTitle?: string },
) {
  const trimmedQuery = query.trim();
  const normalizedQuery = normalizeQuery(trimmedQuery);

  if (!normalizedQuery) {
    return getRecentSearchEntries(userId);
  }

  const history = readStoredHistory(userId);
  const now = new Date().toISOString();
  const existingEntry = history.recentSearches.find(
    (entry) => entry.normalizedQuery === normalizedQuery,
  );
  const nextRecentSearches = [
    {
      count: (existingEntry?.count ?? 0) + 1,
      lastSearchedAt: now,
      normalizedQuery,
      query: trimmedQuery,
      selectedResultTitle:
        options?.selectedResultTitle?.trim() || existingEntry?.selectedResultTitle,
    },
    ...history.recentSearches.filter(
      (entry) => entry.normalizedQuery !== normalizedQuery,
    ),
  ].slice(0, MAX_RECENT_SEARCHES);

  return applyRecentSearchEntries(userId, nextRecentSearches);
}

export function clearRecentSearches(userId?: string | null) {
  applyRecentSearchEntries(userId, []);
}

export function removeRecentSearch(userId: string | null | undefined, query: string) {
  const normalizedQuery = normalizeQuery(query);

  if (!normalizedQuery) {
    return getRecentSearchEntries(userId);
  }

  const history = readStoredHistory(userId);

  return applyRecentSearchEntries(
    userId,
    history.recentSearches.filter(
      (entry) => entry.normalizedQuery !== normalizedQuery,
    ),
  );
}

export function getRecentItems(userId?: string | null) {
  return readStoredHistory(userId).recentItems
    .slice(0, MAX_RECENT_ITEMS)
    .map((entry): RecentSearchItemEntry => ({
      count: entry.count,
      item: sanitizeSearchItem(entry.item),
      lastVisitedAt: entry.lastVisitedAt,
    }));
}

export function recordRecentItem(
  userId: string | null | undefined,
  item: SearchResultItem,
) {
  const history = readStoredHistory(userId);
  const now = new Date().toISOString();
  const itemIdentity = extractSearchItemIdentity(item);
  const existingEntry = history.recentItems.find((entry) => {
    const existingIdentity = extractSearchItemIdentity(entry.item);

    return (
      existingIdentity.entityType === itemIdentity.entityType &&
      existingIdentity.entityId === itemIdentity.entityId
    );
  });
  const nextRecentItems = [
    {
      count: (existingEntry?.count ?? 0) + 1,
      item: sanitizeSearchItem(item),
      lastVisitedAt: now,
    },
    ...history.recentItems.filter((entry) => {
      const existingIdentity = extractSearchItemIdentity(entry.item);

      return !(
        existingIdentity.entityType === itemIdentity.entityType &&
        existingIdentity.entityId === itemIdentity.entityId
      );
    }),
  ].slice(0, MAX_RECENT_ITEMS);

  return applyRecentItemEntries(userId, nextRecentItems);
}

export async function syncRecentSearchesFromServer(userId?: string | null) {
  if (!userId) {
    return getRecentSearchEntries(userId);
  }

  try {
    const { data, error } = await supabase.rpc(
      "get_user_recent_searches" as any,
      {
        p_limit: MAX_RECENT_SEARCHES,
      } as any,
    );

    if (error) {
      throw error;
    }

    const nextRecentSearches = Array.isArray(data)
      ? data
          .filter(
            (entry): entry is RemoteRecentSearchRow =>
              Boolean(entry) &&
              typeof entry.normalized_query === "string" &&
              typeof entry.query === "string" &&
              typeof entry.searched_at === "string" &&
              typeof entry.usage_count === "number",
          )
          .map((entry) => ({
            count: entry.usage_count,
            lastSearchedAt: entry.searched_at,
            normalizedQuery: entry.normalized_query,
            query: entry.query,
            selectedResultTitle:
              typeof entry.selected_result_title === "string"
                ? entry.selected_result_title
                : undefined,
          }))
      : [];

    return applyRecentSearchEntries(userId, nextRecentSearches);
  } catch (error) {
    console.error("[searchHistory] Failed to sync recent searches:", error);
    return getRecentSearchEntries(userId);
  }
}

export async function syncRecentItemsFromServer(userId?: string | null) {
  if (!userId) {
    return getRecentItems(userId);
  }

  try {
    const { data, error } = await supabase.rpc(
      "get_user_recent_items" as any,
      {
        p_limit: MAX_RECENT_ITEMS,
      } as any,
    );

    if (error) {
      throw error;
    }

    const nextRecentItems = Array.isArray(data)
      ? data
          .filter(
            (entry): entry is RemoteRecentItemRow =>
              Boolean(entry) &&
              typeof entry.entity_id === "string" &&
              typeof entry.entity_type === "string" &&
              typeof entry.group_key === "string" &&
              typeof entry.route === "string" &&
              typeof entry.title === "string" &&
              typeof entry.category_icon === "string" &&
              typeof entry.visited_at === "string" &&
              typeof entry.visit_count === "number",
          )
          .map((entry) => mapRemoteRecentItem(entry))
      : [];

    return applyRecentItemEntries(userId, nextRecentItems);
  } catch (error) {
    console.error("[searchHistory] Failed to sync recent items:", error);
    return getRecentItems(userId);
  }
}

export async function persistRecentSearchRemote(
  userId: string | null | undefined,
  query: string,
  options?: { selectedResultTitle?: string },
) {
  if (!userId || !normalizeQuery(query)) {
    return false;
  }

  try {
    const { error } = await supabase.rpc(
      "upsert_user_recent_search" as any,
      {
        p_query: query,
        p_selected_result_title: options?.selectedResultTitle ?? null,
      } as any,
    );

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error("[searchHistory] Failed to persist recent search:", error);
    return false;
  }
}

export async function removeRecentSearchRemote(
  userId: string | null | undefined,
  query: string,
) {
  if (!userId || !normalizeQuery(query)) {
    return false;
  }

  try {
    const { error } = await supabase.rpc(
      "delete_user_recent_search" as any,
      {
        p_normalized_query: query,
      } as any,
    );

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error("[searchHistory] Failed to delete recent search:", error);
    return false;
  }
}

export async function clearRecentSearchesRemote(userId?: string | null) {
  if (!userId) {
    return false;
  }

  try {
    const { error } = await supabase.rpc("clear_user_recent_searches" as any);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error("[searchHistory] Failed to clear recent searches:", error);
    return false;
  }
}

export async function recordRecentItemRemote(
  userId: string | null | undefined,
  item: SearchResultItem,
) {
  if (!userId) {
    return false;
  }

  const identity = extractSearchItemIdentity(item);

  try {
    const { error } = await supabase.rpc(
      "upsert_user_recent_item" as any,
      {
        p_entity_type: identity.entityType,
        p_entity_id: identity.entityId,
        p_route: item.route,
        p_title: item.title,
        p_subtitle: item.subtitle ?? null,
        p_icon: item.icon ?? null,
        p_category_icon: item.categoryIcon,
        p_metadata: item.metadata ?? null,
        p_group_key: item.group,
        p_keywords: item.keywords ?? [],
      } as any,
    );

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error("[searchHistory] Failed to persist recent item:", error);
    return false;
  }
}

export function getSearchHistoryUsageSnapshot(
  userId?: string | null,
): SearchHistoryUsageSnapshot {
  const history = readStoredHistory(userId);

  return {
    queryCounts: history.recentSearches.reduce<Record<string, number>>((counts, entry) => {
      counts[entry.normalizedQuery] = entry.count;
      return counts;
    }, {}),
    recentItemRoutes: history.recentItems.reduce<Record<string, number>>((counts, entry) => {
      counts[entry.item.route] = entry.count;
      return counts;
    }, {}),
  };
}