import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import Box from "@mui/joy/Box";
import Modal from "@mui/joy/Modal";
import Sheet from "@mui/joy/Sheet";
import { useColorScheme } from "@mui/joy/styles";
import { CommandPaletteFilterBar } from "@/components/search/CommandPaletteFilterBar";
import { useLocation, useNavigate } from "react-router-dom";
import { CommandPaletteFooter } from "@/components/search/CommandPaletteFooter";
import { CommandPaletteInput } from "@/components/search/CommandPaletteInput";
import { CommandPaletteResults } from "@/components/search/CommandPaletteResults";
import { BloomCompactMode } from "@/components/bloom/BloomCompactMode";
import { applyRouteVisitBoost } from "@/components/search/databaseSearch";
import {
  coerceSearchFilter,
  filterSearchGroups,
  getContextualSearchFilter,
  getFilterResultCount,
  getVisibleSearchFilters,
  type SearchFilterValue,
} from "@/components/search/searchFilters";
import {
  getStaticSearchItemById,
  getContextualJumpToEntries,
  getQuickActionEntries,
  scoreStaticSearchItem,
} from "@/components/search/staticSearchRegistry";
import {
  getCommandIdFromSearchItem,
  getCommandModeSearchTerm,
  getCommandSearchItems,
  getResolvedCommandAction,
  getResultActionItems,
  getRouteAwareSuggestionItems,
  isCommandModeQuery,
  type PaletteExecutableAction,
} from "@/components/search/searchActionRegistry";
import {
  clearRecentSearches,
  clearRecentSearchesRemote,
  getRecentItems,
  getRecentSearchEntries,
  recordRecentItem,
  recordRecentItemRemote,
  removeRecentSearch,
  removeRecentSearchRemote,
  saveRecentSearch,
  type RecentSearchItemEntry,
  type RecentSearchQueryEntry,
  syncRecentItemsFromServer,
  syncRecentSearchesFromServer,
  persistRecentSearchRemote,
} from "@/components/search/searchHistory";
import {
  trackSearchActionUsed,
  trackSearchClosed,
  trackSearchCommandUsed,
  trackSearchNoResults,
  trackSearchOpened,
  trackSearchQueryChanged,
  trackSearchResultSelected,
  type SearchOpenSource,
} from "@/components/search/searchAnalytics";
import { buildSearchSuggestions } from "@/components/search/searchPresentation";
import {
  SEARCH_GROUP_METADATA,
  type SearchResultGroup,
  type SearchResultItem,
} from "@/components/search/types";
import { useCommandPaletteSearch } from "@/components/search/useCommandPaletteSearch";
import { useCommandPaletteNavigation } from "@/components/search/useCommandPaletteNavigation";
import {
  useBloomCompactMode,
  type BloomCompactActivationRequest,
} from "@/hooks/bloom/useBloomCompactMode";
import { useDebounce } from "@/hooks/useDebounce";
import { useCampaignCloning } from "@/hooks/useCampaignCloning";
import useMediaQuery from "@/hooks/use-media-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/utils/toast";

const PALETTE_EXIT_DURATION_MS = 150;
const COMPACT_VIEW_TRANSITION_MS = 100;
const ACTION_SUCCESS_DURATION_MS = 1500;
const ASK_BLOOM_COMMAND_ID = "ask-bloom";
const ASK_BLOOM_ITEM_ID = "command:ask-bloom";
const ASK_BLOOM_FALLBACK_PREFIX = "Ask Bloom:";
const STRONG_MATCH_STATIC_SCORE_THRESHOLD = 3.5;
const SUPPORTED_SYNC_PROVIDERS = new Set([
  "square",
  "clover",
  "lightspeed",
  "shopify",
]);

interface CommandPaletteProps {
  compactActivationRequest?: BloomCompactActivationRequest | null;
  open: boolean;
  openSource?: SearchOpenSource;
  onClose: () => void;
}

function getPaletteOptionId(itemId: string) {
  return `command-palette-option-${itemId.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function getAskBloomPromptFromItem(item: SearchResultItem): string | null {
  if (!item.title.startsWith(ASK_BLOOM_FALLBACK_PREFIX)) {
    return null;
  }

  const prompt = item.title.slice(ASK_BLOOM_FALLBACK_PREFIX.length).trim();
  return prompt || null;
}

function hasStrongSearchMatch(
  groups: SearchResultGroup[],
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return false;
  }

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  return groups.some((group) =>
    group.results.some((item) => {
      if (getCommandIdFromSearchItem(item) === ASK_BLOOM_COMMAND_ID) {
        return false;
      }

      const title = item.title.toLowerCase();
      const subtitle = item.subtitle?.toLowerCase() ?? "";
      const metadata = item.metadata?.toLowerCase() ?? "";
      const keywords =
        item.keywords?.map((keyword) => keyword.toLowerCase()) ?? [];

      if (title === normalizedQuery || title.startsWith(normalizedQuery)) {
        return true;
      }

      if (
        queryTokens.length > 0 &&
        queryTokens.every(
          (token) =>
            title.includes(token) ||
            subtitle.includes(token) ||
            metadata.includes(token) ||
            keywords.some((keyword) => keyword.includes(token)),
        )
      ) {
        return true;
      }

      return (
        scoreStaticSearchItem(item, normalizedQuery) >=
        STRONG_MATCH_STATIC_SCORE_THRESHOLD
      );
    }),
  );
}

function prependActionResult(
  groups: SearchResultGroup[],
  item: SearchResultItem,
): SearchResultGroup[] {
  const actionsGroupIndex = groups.findIndex(
    (group) => group.category === "actions",
  );

  if (actionsGroupIndex === -1) {
    return [
      {
        category: "actions",
        title: SEARCH_GROUP_METADATA.actions.title,
        icon: SEARCH_GROUP_METADATA.actions.icon,
        results: [item],
      },
      ...groups,
    ];
  }

  return groups.map((group, index) =>
    index === actionsGroupIndex
      ? {
          ...group,
          results: [item, ...group.results],
        }
      : group,
  );
}

export function CommandPalette({
  compactActivationRequest = null,
  open,
  openSource = "click",
  onClose,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const filterChipRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const copiedActionTimeoutRef = useRef<number | null>(null);
  const announcementTimeoutRef = useRef<number | null>(null);
  const lifecycleOpenRef = useRef(open);
  const handledCompactRequestIdRef = useRef<number | null>(null);
  const trackedQueryKeyRef = useRef<string | null>(null);
  const trackedNoResultsKeyRef = useRef<string | null>(null);
  const closeSnapshotRef = useRef({ query: "", resultCount: 0 });
  const compactViewInitializedRef = useRef(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { mode, setMode } = useColorScheme();
  const { cloneCampaign } = useCampaignCloning();
  const compactMode = useBloomCompactMode();
  const { activateCompact, dismissCompact } = compactMode;
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );
  const dialogLabelId = useId();
  const listboxId = useId();
  const filterTabListId = useId();

  const [query, setQuery] = useState("");
  const [debouncedStaticQuery, setDebouncedStaticQuery] = useState("");
  const [debouncedDatabaseQuery, setDebouncedDatabaseQuery] = useState("");
  const [analyticsQuery, setAnalyticsQuery] = useState("");
  const [isMounted, setIsMounted] = useState(open);
  const [isVisible, setIsVisible] = useState(open);
  const [isCompactViewVisible, setIsCompactViewVisible] = useState(false);
  const [isCompactViewSwitching, setIsCompactViewSwitching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<
    RecentSearchQueryEntry[]
  >([]);
  const [recentItems, setRecentItems] = useState<RecentSearchItemEntry[]>([]);
  const [selectedFilter, setSelectedFilter] =
    useState<SearchFilterValue>("all");
  const [hasUserSelectedFilter, setHasUserSelectedFilter] = useState(false);
  const [focusedFilterIndex, setFocusedFilterIndex] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [copiedActionId, setCopiedActionId] = useState<string | null>(null);
  const [pendingCompactAutoSendPrompt, setPendingCompactAutoSendPrompt] =
    useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [itemOverrides, setItemOverrides] = useState<
    Record<string, Partial<SearchResultItem>>
  >({});
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const isCommandMode = isCommandModeQuery(query);
  const trimmedSearchQuery = isCommandMode
    ? getCommandModeSearchTerm(query)
    : query.trim();
  const recentSearchTerms = useMemo(
    () => recentSearches.map((entry) => entry.query),
    [recentSearches],
  );

  const announce = (message: string) => {
    if (announcementTimeoutRef.current !== null) {
      window.clearTimeout(announcementTimeoutRef.current);
    }

    setLiveAnnouncement("");
    announcementTimeoutRef.current = window.setTimeout(() => {
      setLiveAnnouncement(message);
      announcementTimeoutRef.current = null;
    }, 0);
  };

  useEffect(() => {
    return () => {
      if (copiedActionTimeoutRef.current !== null) {
        window.clearTimeout(copiedActionTimeoutRef.current);
      }

      if (announcementTimeoutRef.current !== null) {
        window.clearTimeout(announcementTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (open) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setIsMounted(true);

      const animationFrame = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });

      const isJsdom = /jsdom/i.test(window.navigator.userAgent);

      if (!isJsdom && typeof window.scrollTo === "function") {
        try {
          window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        } catch {
          // jsdom exposes scrollTo but does not implement it.
        }
      }

      const shellContent = document.querySelector<HTMLElement>(
        "[data-testid='dashboard-shell-content']",
      );
      shellContent?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });

      return () => {
        window.cancelAnimationFrame(animationFrame);
      };
    }

    if (!isMounted) {
      return;
    }

    setIsVisible(false);

    const timeoutId = window.setTimeout(() => {
      setIsMounted(false);
      setQuery("");
      setDebouncedStaticQuery("");
      setDebouncedDatabaseQuery("");
      setAnalyticsQuery("");
      setSelectedFilter("all");
      setHasUserSelectedFilter(false);
      setFocusedFilterIndex(0);
      setShowShortcuts(false);
      setCopiedActionId(null);
      setPendingCompactAutoSendPrompt(null);
      setPendingActionId(null);
      setActionErrors({});
      setItemOverrides({});
      dismissCompact();
      previousFocusRef.current?.focus?.();
    }, PALETTE_EXIT_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dismissCompact, isMounted, open]);

  useEffect(() => {
    if (!open || !compactActivationRequest) {
      return;
    }

    if (handledCompactRequestIdRef.current === compactActivationRequest.id) {
      return;
    }

    handledCompactRequestIdRef.current = compactActivationRequest.id;
    compactMode.setActiveMode("standard");
    activateCompact(
      compactActivationRequest.prompt,
      compactActivationRequest.entityContext,
    );
    setPendingCompactAutoSendPrompt(
      compactActivationRequest.autoSend
        ? compactActivationRequest.prompt.trim() || null
        : null,
    );
    setShowShortcuts(false);
  }, [activateCompact, compactActivationRequest, compactMode, open]);

  useEffect(() => {
    if (
      !pendingCompactAutoSendPrompt ||
      !compactMode.isActive ||
      compactMode.isStreaming ||
      compactMode.draftPrompt.trim() !== pendingCompactAutoSendPrompt
    ) {
      return;
    }

    let cancelled = false;

    void compactMode
      .sendCompactMessage(pendingCompactAutoSendPrompt)
      .then((sent) => {
        if (!cancelled && sent) {
          setPendingCompactAutoSendPrompt(null);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [
    compactMode.draftPrompt,
    compactMode.isActive,
    compactMode.isStreaming,
    compactMode.sendCompactMessage,
    pendingCompactAutoSendPrompt,
  ]);

  useEffect(() => {
    if (!compactViewInitializedRef.current) {
      compactViewInitializedRef.current = true;
      setIsCompactViewVisible(compactMode.isActive);
      return;
    }

    const transitionDelay = prefersReducedMotion
      ? 0
      : COMPACT_VIEW_TRANSITION_MS;
    setIsCompactViewSwitching(true);

    const timeoutId = window.setTimeout(() => {
      setIsCompactViewVisible(compactMode.isActive);
      setIsCompactViewSwitching(false);
    }, transitionDelay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [compactMode.isActive, prefersReducedMotion]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setRecentSearches(getRecentSearchEntries(user?.id));
    setRecentItems(getRecentItems(user?.id));

    void syncRecentSearchesFromServer(user?.id).then((entries) => {
      setRecentSearches(entries);
    });
    void syncRecentItemsFromServer(user?.id).then((entries) => {
      setRecentItems(entries);
    });

    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open, user?.id]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedStaticQuery(query);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedDatabaseQuery(query);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAnalyticsQuery(query.trim());
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open, query]);

  const contextualFilter = useMemo(
    () => getContextualSearchFilter(pathname),
    [pathname],
  );
  const staticSearchQuery = isCommandMode ? "" : debouncedStaticQuery;
  const databaseSearchQuery = isCommandMode ? "" : debouncedDatabaseQuery;
  const requestedFilter = trimmedSearchQuery
    ? hasUserSelectedFilter
      ? selectedFilter
      : contextualFilter
    : "all";
  const {
    results: rawResults,
    databaseMeta,
    isDatabaseLoading,
    warning,
  } = useCommandPaletteSearch(
    staticSearchQuery,
    databaseSearchQuery,
    requestedFilter,
    pathname,
    user?.id ?? "anonymous",
  );
  const quickActions = useMemo(() => getQuickActionEntries(6), []);
  const jumpTo = useMemo(
    () => getContextualJumpToEntries(pathname, 6),
    [pathname],
  );
  const applyItemOverride = (item: SearchResultItem): SearchResultItem => {
    const override = itemOverrides[item.id];

    if (!override) {
      return item;
    }

    return {
      ...item,
      ...override,
    };
  };
  const applyOverridesToItems = (items: SearchResultItem[]) =>
    items.map((item) => applyItemOverride(item));
  const applyOverridesToGroups = (groups: SearchResultGroup[]) =>
    groups.map((group) => ({
      ...group,
      results: applyOverridesToItems(group.results),
    }));
  const recentItemsWithOverrides = useMemo(
    () =>
      recentItems.map((entry) => ({
        ...entry,
        item: applyItemOverride(entry.item),
      })),
    [recentItems, itemOverrides],
  );
  const recentItemRoutes = useMemo(
    () => new Set(recentItemsWithOverrides.map((entry) => entry.item.route)),
    [recentItemsWithOverrides],
  );
  const visibleQuickActions = useMemo(
    () => quickActions.filter((item) => !recentItemRoutes.has(item.route)),
    [quickActions, recentItemRoutes],
  );
  const visibleJumpTo = useMemo(
    () => jumpTo.filter((item) => !recentItemRoutes.has(item.route)),
    [jumpTo, recentItemRoutes],
  );
  const routeAwareSuggestions = useMemo(() => {
    const contextualSuggestions = getRouteAwareSuggestionItems(pathname);
    const suggestionItems =
      contextualSuggestions.length > 0
        ? contextualSuggestions
        : visibleQuickActions.slice(0, 4);

    return applyOverridesToItems(suggestionItems);
  }, [pathname, visibleQuickActions, itemOverrides]);
  const effectiveFilter = useMemo(
    () => coerceSearchFilter(requestedFilter, rawResults, pathname),
    [pathname, rawResults, requestedFilter],
  );
  const filterCounts = useMemo(() => {
    const nextCounts: Partial<Record<SearchFilterValue, number>> = {
      all: getFilterResultCount("all", rawResults, pathname),
    };

    for (const filter of getVisibleSearchFilters(rawResults, pathname)) {
      nextCounts[filter] = getFilterResultCount(filter, rawResults, pathname);
    }

    return nextCounts;
  }, [pathname, rawResults]);
  const visibleFilters = useMemo(
    () =>
      trimmedSearchQuery && !isCommandMode
        ? getVisibleSearchFilters(rawResults, pathname)
        : [],
    [isCommandMode, pathname, rawResults, trimmedSearchQuery],
  );
  const boostedResults = useMemo(
    () =>
      applyRouteVisitBoost(
        rawResults,
        recentItemsWithOverrides.reduce<Record<string, number>>(
          (counts, entry) => {
            counts[entry.item.route] = entry.count;
            return counts;
          },
          {},
        ),
      ),
    [rawResults, recentItemsWithOverrides],
  );
  const filteredResults = useMemo(
    () => filterSearchGroups(boostedResults, effectiveFilter, pathname),
    [boostedResults, effectiveFilter, pathname],
  );
  const results = useMemo(
    () => applyOverridesToGroups(filteredResults),
    [filteredResults, itemOverrides],
  );
  const askBloomFallbackItem = useMemo(() => {
    if (isCommandMode || !trimmedSearchQuery) {
      return null;
    }

    if (
      results.some((group) =>
        group.results.some(
          (item) => getCommandIdFromSearchItem(item) === ASK_BLOOM_COMMAND_ID,
        ),
      )
    ) {
      return null;
    }

    if (hasStrongSearchMatch(results, trimmedSearchQuery)) {
      return null;
    }

    const baseItem = getStaticSearchItemById(ASK_BLOOM_ITEM_ID);

    if (!baseItem) {
      return null;
    }

    return {
      ...baseItem,
      title: `${ASK_BLOOM_FALLBACK_PREFIX} ${trimmedSearchQuery}`,
      subtitle: "Send this prompt to Bloom without leaving the current page.",
      route: pathname,
      keywords: [...(baseItem.keywords ?? []), trimmedSearchQuery],
    } satisfies SearchResultItem;
  }, [isCommandMode, pathname, results, trimmedSearchQuery]);
  const queryResults = useMemo(
    () =>
      askBloomFallbackItem
        ? prependActionResult(results, askBloomFallbackItem)
        : results,
    [askBloomFallbackItem, results],
  );
  const commandResults = useMemo<SearchResultGroup[]>(() => {
    if (!isCommandMode || !debouncedQuery.trim()) {
      return [];
    }

    const items = applyOverridesToItems(
      getCommandSearchItems(debouncedQuery, pathname),
    );

    if (items.length === 0) {
      return [];
    }

    return [
      {
        category: "actions",
        title: "Commands",
        icon: "actions",
        results: items,
      },
    ];
  }, [debouncedQuery, isCommandMode, itemOverrides, pathname]);
  const displayedResults = isCommandMode ? commandResults : queryResults;
  const suggestions = useMemo(
    () =>
      isCommandMode
        ? []
        : buildSearchSuggestions({
            query,
            recentItems: recentItemsWithOverrides,
            recentSearches: recentSearchTerms,
            results,
          }),
    [
      isCommandMode,
      query,
      recentItemsWithOverrides,
      recentSearchTerms,
      results,
    ],
  );
  const showFilterBar =
    !isCommandMode &&
    trimmedSearchQuery.length > 0 &&
    visibleFilters.length > 0;

  useEffect(() => {
    if (!trimmedSearchQuery) {
      setSelectedFilter("all");
      setHasUserSelectedFilter(false);
      setFocusedFilterIndex(0);
    }
  }, [trimmedSearchQuery]);

  useEffect(() => {
    if (trimmedSearchQuery) {
      setShowShortcuts(false);
    }
  }, [trimmedSearchQuery]);

  useEffect(() => {
    if (!copiedActionId) {
      return;
    }

    if (copiedActionTimeoutRef.current !== null) {
      window.clearTimeout(copiedActionTimeoutRef.current);
    }

    copiedActionTimeoutRef.current = window.setTimeout(() => {
      setCopiedActionId(null);
      copiedActionTimeoutRef.current = null;
    }, ACTION_SUCCESS_DURATION_MS);

    return () => {
      if (copiedActionTimeoutRef.current !== null) {
        window.clearTimeout(copiedActionTimeoutRef.current);
        copiedActionTimeoutRef.current = null;
      }
    };
  }, [copiedActionId]);

  useEffect(() => {
    if (!showFilterBar) {
      filterChipRefs.current = [];
      setFocusedFilterIndex(0);
      return;
    }

    const nextIndex = Math.max(0, visibleFilters.indexOf(effectiveFilter));
    setFocusedFilterIndex(nextIndex);
  }, [effectiveFilter, showFilterBar, visibleFilters]);

  const navigableGroups = useMemo<SearchResultGroup[]>(() => {
    if (showShortcuts) {
      return [];
    }

    if (trimmedSearchQuery) {
      return displayedResults;
    }

    const nextGroups: SearchResultGroup[] = [];

    if (routeAwareSuggestions.length > 0) {
      nextGroups.push({
        category: "actions",
        title: "Suggested Actions",
        icon: "actions",
        results: routeAwareSuggestions,
      });
    }

    if (recentItemsWithOverrides.length > 0) {
      nextGroups.push({
        category: "activity",
        title: "Recently Visited",
        icon: "activity",
        results: recentItemsWithOverrides.map((entry) => entry.item),
      });
    }

    if (visibleJumpTo.length > 0) {
      nextGroups.push({
        category: "pages",
        title: "Jump To",
        icon: "pages",
        results: applyOverridesToItems(visibleJumpTo),
      });
    }

    return nextGroups;
  }, [
    displayedResults,
    recentItemsWithOverrides,
    routeAwareSuggestions,
    showShortcuts,
    trimmedSearchQuery,
    visibleJumpTo,
  ]);

  const persistRecentSearch = (value: string) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return;
    }

    const nextEntries = saveRecentSearch(user?.id, trimmedValue);
    setRecentSearches(nextEntries);
    void persistRecentSearchRemote(user?.id, trimmedValue);
  };

  const persistRecentSearchSelection = (
    value: string,
    options?: { selectedResultTitle?: string },
  ) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return;
    }

    const nextEntries = saveRecentSearch(user?.id, trimmedValue, options);
    setRecentSearches(nextEntries);
    void persistRecentSearchRemote(user?.id, trimmedValue, options);
  };

  const handleClearRecentSearches = () => {
    clearRecentSearches(user?.id);
    setRecentSearches([]);
    void clearRecentSearchesRemote(user?.id);
    announce("Recent searches cleared.");
  };

  const handleRemoveRecentSearch = (recentQuery: string) => {
    const nextEntries = removeRecentSearch(user?.id, recentQuery);
    setRecentSearches(nextEntries);
    void removeRecentSearchRemote(user?.id, recentQuery);
    announce(`Removed ${recentQuery} from recent searches.`);
  };

  const setActionError = (itemId: string, message: string | null) => {
    setActionErrors((currentErrors) => {
      if (!message) {
        const { [itemId]: _removed, ...remainingErrors } = currentErrors;
        return remainingErrors;
      }

      return {
        ...currentErrors,
        [itemId]: message,
      };
    });
  };

  const shouldRecordRecentItem = (item: SearchResultItem) =>
    !getStaticSearchItemById(item.id) && !getCommandIdFromSearchItem(item);

  const recordItemVisit = (item: SearchResultItem) => {
    if (!shouldRecordRecentItem(item)) {
      return;
    }

    setRecentItems(recordRecentItem(user?.id, item));
    void recordRecentItemRemote(user?.id, item);
  };

  const handleOpenInNewTab = (item: SearchResultItem) => {
    const commandId = getCommandIdFromSearchItem(item);

    if (commandId) {
      const action = getResolvedCommandAction(commandId, pathname);

      if (
        !action ||
        (action.execution.type !== "navigate" &&
          action.execution.type !== "open-new-tab")
      ) {
        return;
      }
    }

    if (trimmedSearchQuery) {
      persistRecentSearchSelection(trimmedSearchQuery, {
        selectedResultTitle: item.title,
      });
    }

    recordItemVisit(item);
    window.open(item.route, "_blank", "noopener,noreferrer");
  };

  const resolveSyncTarget = async (route?: string) => {
    const activeRoute = route ?? pathname;
    const routeMatch = activeRoute.match(/^\/integrations\/([^/?#]+)/);
    const routeProvider = routeMatch?.[1] ?? null;
    const queryString = activeRoute.split("?")[1] ?? "";
    const params = new URLSearchParams(queryString);
    const routeConnectionId = params.get("connection");

    if (
      routeProvider &&
      routeConnectionId &&
      SUPPORTED_SYNC_PROVIDERS.has(routeProvider)
    ) {
      return {
        provider: routeProvider,
        connectionId: routeConnectionId,
      };
    }

    const { data, error } = await supabase
      .from("pos_connections")
      .select("id, platform, is_active")
      .eq("user_id", user?.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    const supportedConnection = (data ?? []).find((connection) =>
      SUPPORTED_SYNC_PROVIDERS.has(connection.platform),
    );

    if (!supportedConnection) {
      throw new Error("No active POS connection is available for sync.");
    }

    return {
      provider: supportedConnection.platform,
      connectionId: supportedConnection.id,
    };
  };

  const executePaletteAction = async (
    item: SearchResultItem,
    action: PaletteExecutableAction,
  ) => {
    setActionError(item.id, null);
    setPendingActionId(action.id);

    try {
      const trackAction = () => {
        void trackSearchActionUsed({
          actionLabel: action.label,
          actionType: action.execution.type,
          currentRoute: pathname,
          query: trimmedSearchQuery,
          resultTitle: item.title,
        });
      };

      switch (action.execution.type) {
        case "activate-bloom-compact": {
          activateCompact(action.execution.prefilledPrompt ?? undefined);
          announce("Bloom is ready.");
          trackAction();
          return;
        }
        case "navigate": {
          if (trimmedSearchQuery) {
            persistRecentSearchSelection(trimmedSearchQuery, {
              selectedResultTitle: item.title,
            });
          }

          recordItemVisit(item);
          trackAction();
          onClose();
          navigate(action.execution.route);
          return;
        }
        case "open-new-tab": {
          if (trimmedSearchQuery) {
            persistRecentSearchSelection(trimmedSearchQuery, {
              selectedResultTitle: item.title,
            });
          }

          recordItemVisit(item);
          trackAction();
          window.open(action.execution.route, "_blank", "noopener,noreferrer");
          return;
        }
        case "copy": {
          if (!navigator.clipboard?.writeText) {
            toast({
              title: "Clipboard unavailable",
              description: action.execution.value,
            });
            return;
          }

          await navigator.clipboard.writeText(action.execution.value);
          setCopiedActionId(action.id);
          announce(
            `${action.label.replace(/^Copy\s+/i, "") || action.label} copied to clipboard.`,
          );
          trackAction();
          return;
        }
        case "toggle-automation": {
          const { error } = await supabase
            .from("crm_automations")
            .update({ is_active: action.execution.nextIsActive })
            .eq("id", action.execution.automationId);

          if (error) {
            throw error;
          }

          setItemOverrides((currentOverrides) => ({
            ...currentOverrides,
            [item.id]: {
              metadata: action.execution.nextIsActive ? "Active" : "Inactive",
            },
          }));
          announce(
            `${item.title} ${action.execution.nextIsActive ? "enabled" : "disabled"}.`,
          );
          trackAction();
          return;
        }
        case "duplicate-campaign": {
          const duplicatedCampaignId = await cloneCampaign(
            action.execution.campaignId,
            { clearScheduling: true },
          );

          if (!duplicatedCampaignId) {
            throw new Error("BloomSuite could not duplicate this campaign.");
          }

          trackAction();
          onClose();
          navigate(`/crm/campaigns/${duplicatedCampaignId}`);
          return;
        }
        case "clear-search-history": {
          clearRecentSearches(user?.id);
          setRecentSearches([]);
          void clearRecentSearchesRemote(user?.id);
          announce("Recent searches cleared.");
          trackAction();
          return;
        }
        case "toggle-theme": {
          setMode(mode === "dark" ? "light" : "dark");
          announce(`Switched to ${mode === "dark" ? "light" : "dark"} mode.`);
          trackAction();
          return;
        }
        case "show-shortcuts": {
          setShowShortcuts(true);
          trackAction();
          return;
        }
        case "send-test-email": {
          window.dispatchEvent(
            new CustomEvent("command-palette:send-test-email", {
              detail: {
                campaignRoute: action.execution.campaignRoute,
              },
            }),
          );
          trackAction();
          onClose();
          return;
        }
        case "sync-pos": {
          const syncTarget = await resolveSyncTarget(
            action.execution.integrationRoute,
          );
          const { error } = await supabase.functions.invoke(
            `${syncTarget.provider}-sync`,
            {
              body: {
                connection_id: syncTarget.connectionId,
              },
            },
          );

          if (error) {
            throw error;
          }

          toast({
            title: "Sync started",
            description: `BloomSuite started a ${syncTarget.provider} sync.`,
          });
          announce(`${syncTarget.provider} sync started.`);
          trackAction();
          return;
        }
      }
    } catch (error) {
      const description =
        error instanceof Error
          ? error.message
          : "The action could not be completed.";
      setActionError(item.id, description);
    } finally {
      setPendingActionId((currentActionId) =>
        currentActionId === action.id ? null : currentActionId,
      );
    }
  };

  const resolveItemAction = useCallback(
    (
      item: SearchResultItem,
      action: PaletteExecutableAction,
    ): PaletteExecutableAction => {
      if (action.execution.type !== "activate-bloom-compact") {
        return action;
      }

      const prompt = getAskBloomPromptFromItem(item);

      if (!prompt || action.execution.prefilledPrompt === prompt) {
        return action;
      }

      return {
        ...action,
        execution: {
          ...action.execution,
          prefilledPrompt: prompt,
        },
      };
    },
    [],
  );

  const handleSelectItem = (item: SearchResultItem) => {
    const commandId = getCommandIdFromSearchItem(item);
    const rankedGroups = trimmedSearchQuery
      ? displayedResults
      : navigableGroups;
    const resultRankPosition = rankedGroups.reduce((position, group) => {
      if (position > 0) {
        return position;
      }

      const itemIndex = group.results.findIndex(
        (candidate) => candidate.id === item.id,
      );

      if (itemIndex === -1) {
        return 0;
      }

      const previousCount = rankedGroups
        .slice(0, rankedGroups.indexOf(group))
        .reduce(
          (count, currentGroup) => count + currentGroup.results.length,
          0,
        );

      return previousCount + itemIndex + 1;
    }, 0);

    if (commandId) {
      if (trimmedSearchQuery) {
        persistRecentSearchSelection(trimmedSearchQuery, {
          selectedResultTitle: item.title,
        });
      }

      void trackSearchCommandUsed({
        commandLabel: item.title,
        currentRoute: pathname,
        query: trimmedSearchQuery,
      });

      const action = getResolvedCommandAction(commandId, pathname);

      if (action) {
        void executePaletteAction(item, resolveItemAction(item, action));
      }

      return;
    }

    if (trimmedSearchQuery) {
      persistRecentSearchSelection(trimmedSearchQuery, {
        selectedResultTitle: item.title,
      });
    }

    recordItemVisit(item);
    void trackSearchResultSelected({
      activeFilter: effectiveFilter,
      currentRoute: pathname,
      entityType: item.type,
      query: trimmedSearchQuery,
      rankPosition: resultRankPosition || 1,
      resultRoute: item.route,
      resultTitle: item.title,
    });

    onClose();
    navigate(item.route);
  };

  const getItemActions = useCallback(
    (item: SearchResultItem) =>
      getResultActionItems(item).map((action) =>
        resolveItemAction(item, action),
      ),
    [resolveItemAction],
  );

  const {
    activeActionIndex,
    activeItem,
    handleKeyDown,
    openActionItemId,
    openActionMenu,
    closeActionMenu,
    setActiveActionByIndex,
    setActiveItemById,
  } = useCommandPaletteNavigation({
    getItemActions,
    groups: navigableGroups,
    enabled: isMounted,
    onClose,
    onOpenInNewTab: handleOpenInNewTab,
    onSelectAction: (item, action) => {
      void executePaletteAction(item, action);
    },
    onSelect: handleSelectItem,
  });

  const focusFilterChip = (index: number) => {
    if (visibleFilters.length === 0) {
      return;
    }

    const normalizedIndex =
      (index + visibleFilters.length) % visibleFilters.length;

    setFocusedFilterIndex(normalizedIndex);
    window.requestAnimationFrame(() => {
      filterChipRefs.current[normalizedIndex]?.focus();
    });
  };

  const handleSelectFilter = (filter: SearchFilterValue) => {
    setSelectedFilter(filter);
    setHasUserSelectedFilter(true);
    announce(
      `${filter === "all" ? "All results" : SEARCH_GROUP_METADATA[filter].title} filter selected.`,
    );
  };

  const handleFilterKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    event.stopPropagation();

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      focusFilterChip(index + 1);
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      focusFilterChip(index - 1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelectFilter(visibleFilters[index]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      inputRef.current?.focus();
    }
  };

  const resultCount = query.trim()
    ? displayedResults.reduce((count, group) => count + group.results.length, 0)
    : navigableGroups.reduce((count, group) => count + group.results.length, 0);

  const compactStreamState = useMemo(
    () => ({
      activeToolCall: compactMode.activeToolCall,
      connectionState: compactMode.connectionState,
      isResearchComplete: compactMode.isResearchComplete,
      isResearchSynthesizing: compactMode.isResearchSynthesizing,
      researchConversationId: compactMode.researchConversationId,
      researchPlan: compactMode.researchPlan,
      researchSteps: compactMode.researchSteps,
      streamError: compactMode.streamError,
      streamingBlocks: compactMode.streamingBlocks,
      streamingContent: compactMode.streamingContent,
      streamingThinking: compactMode.streamingThinking,
    }),
    [
      compactMode.activeToolCall,
      compactMode.connectionState,
      compactMode.isResearchComplete,
      compactMode.isResearchSynthesizing,
      compactMode.researchConversationId,
      compactMode.researchPlan,
      compactMode.researchSteps,
      compactMode.streamError,
      compactMode.streamingBlocks,
      compactMode.streamingContent,
      compactMode.streamingThinking,
    ],
  );

  closeSnapshotRef.current = {
    query: trimmedSearchQuery,
    resultCount,
  };

  useEffect(() => {
    if (open && !lifecycleOpenRef.current) {
      void trackSearchOpened(openSource, pathname);
      announce("Search opened. Type to search BloomSuite.");
    }

    if (!open && lifecycleOpenRef.current) {
      void trackSearchClosed({
        currentRoute: pathname,
        query: closeSnapshotRef.current.query,
        resultCount: closeSnapshotRef.current.resultCount,
        source: openSource,
      });
    }

    lifecycleOpenRef.current = open;
  }, [open, openSource, pathname]);

  useEffect(() => {
    if (!open || !isCommandMode) {
      return;
    }

    announce("Command mode active. Type a command.");
  }, [isCommandMode, open]);

  useEffect(() => {
    if (!open || !trimmedSearchQuery || isDatabaseLoading) {
      return;
    }

    const filterLabel =
      effectiveFilter === "all"
        ? "all results"
        : SEARCH_GROUP_METADATA[effectiveFilter].title;

    announce(
      resultCount > 0
        ? `${resultCount} results in ${filterLabel}.`
        : `No results for ${trimmedSearchQuery}.`,
    );
  }, [
    effectiveFilter,
    isDatabaseLoading,
    open,
    resultCount,
    trimmedSearchQuery,
  ]);

  useEffect(() => {
    if (!open || !analyticsQuery || showShortcuts) {
      return;
    }

    const analyticsKey = `${analyticsQuery}|${effectiveFilter}|${pathname}|${openSource}`;

    if (trackedQueryKeyRef.current === analyticsKey) {
      return;
    }

    trackedQueryKeyRef.current = analyticsKey;

    void trackSearchQueryChanged({
      activeFilter: effectiveFilter,
      currentRoute: pathname,
      hasDatabaseResults: databaseMeta.total > 0,
      isFuzzyMatch: databaseMeta.fuzzy,
      query: analyticsQuery,
      resultCount,
      source: openSource,
    });
  }, [
    analyticsQuery,
    databaseMeta.fuzzy,
    databaseMeta.total,
    effectiveFilter,
    open,
    openSource,
    pathname,
    resultCount,
    showShortcuts,
  ]);

  useEffect(() => {
    if (
      !open ||
      !analyticsQuery ||
      isDatabaseLoading ||
      resultCount > 0 ||
      showShortcuts
    ) {
      return;
    }

    const noResultsKey = `${analyticsQuery}|${effectiveFilter}|${pathname}|${openSource}`;

    if (trackedNoResultsKeyRef.current === noResultsKey) {
      return;
    }

    trackedNoResultsKeyRef.current = noResultsKey;

    void trackSearchNoResults({
      activeFilter: effectiveFilter,
      currentRoute: pathname,
      query: analyticsQuery,
      source: openSource,
    });
  }, [
    analyticsQuery,
    effectiveFilter,
    isDatabaseLoading,
    open,
    openSource,
    pathname,
    resultCount,
    showShortcuts,
  ]);

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "?" && !trimmedSearchQuery) {
      event.preventDefault();
      setShowShortcuts((currentValue) => !currentValue);
      return;
    }

    if (event.key === "Tab" && !event.shiftKey && showFilterBar) {
      event.preventDefault();
      focusFilterChip(focusedFilterIndex);
      return;
    }

    handleKeyDown(event);
    event.stopPropagation();
  };

  const handlePaletteKeyDownCapture = (
    event: KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = paletteRef.current
      ? Array.from(
          paletteRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => !element.closest("[aria-hidden='true']"))
      : [];

    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const activeElement = document.activeElement as HTMLElement | null;
    const currentIndex = activeElement
      ? focusableElements.indexOf(activeElement)
      : -1;
    const nextIndex = event.shiftKey
      ? currentIndex <= 0
        ? focusableElements.length - 1
        : currentIndex - 1
      : currentIndex === -1 || currentIndex === focusableElements.length - 1
        ? 0
        : currentIndex + 1;

    event.preventDefault();
    focusableElements[nextIndex]?.focus();
  };

  if (!isMounted) {
    return null;
  }

  return (
    <Modal
      open={isMounted}
      onClose={onClose}
      keepMounted={false}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: "hsl(var(--card) / 0.6)",
            backdropFilter: "blur(20px)",
            opacity: isVisible ? 1 : 0,
            transition: `opacity ${PALETTE_EXIT_DURATION_MS}ms ease`,
          },
        },
      }}
    >
      <Box
        ref={paletteRef}
        onKeyDownCapture={handlePaletteKeyDownCapture}
        sx={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          px: { xs: 1, sm: 2 },
          pt: { xs: "8px", md: "max(20vh, 64px)" },
        }}
      >
        <Sheet
          component="section"
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogLabelId}
          variant="plain"
          sx={{
            width: "min(680px, calc(100vw - 16px))",
            overflow: "hidden",
            borderRadius: "var(--joy-radius-lg)",
            backgroundColor: "hsl(var(--card))",
            border:
              "1px solid rgba(var(--joy-palette-neutral-mainChannel) / 0.1)",
            boxShadow: "0 28px 80px rgba(15, 23, 42, 0.18)",
            opacity: isVisible ? 1 : 0,
            transform: isVisible
              ? "translateY(0) scale(1)"
              : "translateY(-8px) scale(0.97)",
            transformOrigin: "center top",
            transition: prefersReducedMotion
              ? "none"
              : `opacity ${PALETTE_EXIT_DURATION_MS}ms ease, transform ${PALETTE_EXIT_DURATION_MS}ms ease`,
          }}
        >
          <Box
            id={dialogLabelId}
            sx={{
              position: "absolute",
              width: 1,
              height: 1,
              p: 0,
              m: -1,
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
              whiteSpace: "nowrap",
              border: 0,
            }}
          >
            Command palette
          </Box>
          <Box
            aria-atomic="true"
            aria-live="polite"
            sx={{
              position: "absolute",
              width: 1,
              height: 1,
              p: 0,
              m: -1,
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
              whiteSpace: "nowrap",
              border: 0,
            }}
          >
            {liveAnnouncement}
          </Box>
          {isCompactViewVisible ? (
            <Box
              sx={{
                opacity: isCompactViewSwitching ? 0 : 1,
                transition: prefersReducedMotion
                  ? "none"
                  : `opacity ${COMPACT_VIEW_TRANSITION_MS}ms ease`,
              }}
            >
              <BloomCompactMode
                activeMode={compactMode.activeMode}
                connectionState={compactMode.connectionState}
                draftPrompt={compactMode.draftPrompt}
                isStreaming={compactMode.isStreaming}
                onBack={() => {
                  setPendingCompactAutoSendPrompt(null);
                  compactMode.dismissCompact();
                  announce("Command palette restored.");
                }}
                onCancelStream={compactMode.cancelStream}
                onContinueInBloom={() => {
                  const didContinue = compactMode.continueInBloom();

                  if (didContinue) {
                    setPendingCompactAutoSendPrompt(null);
                    onClose();
                  }

                  return didContinue;
                }}
                onDraftPromptChange={compactMode.setDraftPrompt}
                onModeChange={compactMode.setActiveMode}
                onSendPrompt={(prompt) => {
                  void compactMode
                    .sendCompactMessage(prompt)
                    .catch(() => undefined);
                }}
                streamState={compactStreamState}
                submittedPrompt={compactMode.submittedPrompt}
              />
            </Box>
          ) : (
            <Box
              sx={{
                opacity: isCompactViewSwitching ? 0 : 1,
                transition: prefersReducedMotion
                  ? "none"
                  : `opacity ${COMPACT_VIEW_TRANSITION_MS}ms ease`,
                animation:
                  prefersReducedMotion || isCompactViewSwitching
                    ? "none"
                    : "commandPaletteStandardIn 100ms ease both",
                "@keyframes commandPaletteStandardIn": {
                  from: { opacity: 0 },
                  to: { opacity: 1 },
                },
              }}
            >
              <CommandPaletteInput
                activeDescendantId={
                  activeItem ? getPaletteOptionId(activeItem.id) : undefined
                }
                ariaControlsId={listboxId}
                dialogLabelId={dialogLabelId}
                inputRef={inputRef}
                isCommandMode={isCommandMode}
                isLoading={!isCommandMode && isDatabaseLoading}
                onClose={onClose}
                onKeyDown={handleInputKeyDown}
                onQueryChange={(nextQuery) => {
                  setQuery(nextQuery);
                }}
                onSuggestionSelect={setQuery}
                query={query}
                suggestions={suggestions}
              />

              {showFilterBar ? (
                <CommandPaletteFilterBar
                  activeFilter={effectiveFilter}
                  counts={filterCounts}
                  filterRefs={filterChipRefs}
                  filters={visibleFilters}
                  onFocusFilter={setFocusedFilterIndex}
                  onKeyDownFilter={handleFilterKeyDown}
                  onSelectFilter={handleSelectFilter}
                  tabListId={filterTabListId}
                />
              ) : null}

              <Box
                sx={{
                  minHeight: 0,
                  maxHeight: "min(60vh, 520px)",
                  overflowY: "auto",
                  overflowX: "hidden",
                  overscrollBehavior: "contain",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                <CommandPaletteResults
                  activeItemId={activeItem?.id}
                  activeActionIndex={activeActionIndex}
                  copiedActionId={copiedActionId}
                  currentPathname={pathname}
                  errorByItemId={actionErrors}
                  getItemActions={getItemActions}
                  isDatabaseLoading={isDatabaseLoading}
                  jumpTo={visibleJumpTo}
                  listboxId={listboxId}
                  onCloseActionMenu={closeActionMenu}
                  onClearRecentSearches={handleClearRecentSearches}
                  onHoverAction={setActiveActionByIndex}
                  onHoverItem={setActiveItemById}
                  onOpenActionMenu={openActionMenu}
                  onRemoveRecentSearch={handleRemoveRecentSearch}
                  onSelectAction={(item, action) => {
                    void executePaletteAction(item, action);
                  }}
                  onSelectItem={handleSelectItem}
                  onSuggestQuery={setQuery}
                  openActionItemId={openActionItemId}
                  pendingActionId={pendingActionId}
                  query={query}
                  recentItems={recentItemsWithOverrides}
                  recentSearches={recentSearches}
                  results={displayedResults}
                  routeAwareSuggestions={routeAwareSuggestions}
                  showShortcuts={showShortcuts}
                  warning={warning}
                />
              </Box>

              <CommandPaletteFooter
                activeFilter={effectiveFilter}
                onToggleShortcuts={() =>
                  setShowShortcuts((currentValue) => !currentValue)
                }
                resultCount={resultCount}
                shortcutsOpen={showShortcuts}
              />
            </Box>
          )}
        </Sheet>
      </Box>
    </Modal>
  );
}
