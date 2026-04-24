import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import {
  createCampaignFilter,
  createContentTasksFilter,
  securityFilterCampaigns,
  securityFilterTasks,
  getCustomCampaigns,
  getCustomCampaignTasks,
  getSystemCampaignTasks,
  getApprovedTasks,
  deduplicateById,
  type FilterConfig,
} from "@/utils/dataFilters";
import {
  buildRealtimeScopeFilter,
  buildScopedStorageKey,
} from "@/utils/tenantScope";
import { Campaign } from "@/types/content";

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

interface CachedData {
  campaigns: Campaign[];
  tasks: any[];
  userCreatedCampaigns: Campaign[];
  systemTasks: any[];
  customTasks: any[];
  approvedTasks: any[];
  timestamp: number;
  isStale: boolean;
  scopeKey: string;
}

interface LoadingStates {
  campaigns: boolean;
  tasks: boolean;
  initial: boolean;
}

interface GlobalDataContextType {
  // Data
  campaigns: Campaign[];
  tasks: any[];
  systemTasks: any[];
  customTasks: any[];
  userCreatedCampaigns: Campaign[];
  approvedTasks: any[];

  // Loading states
  loading: boolean;
  loadingStates: LoadingStates;
  isRefreshing: boolean;

  // Error handling
  error: string | null;

  // Cache info
  isCached: boolean;
  lastUpdated: number | null;

  // Actions
  refreshData: (force?: boolean) => Promise<void>;
  invalidateCache: () => void;

  // Route state persistence
  routeStates: Record<string, any>;
  saveRouteState: (route: string, state: any) => void;
  getRouteState: (route: string) => any;
  clearRouteState: (route: string) => void;
}

const GlobalDataContext = createContext<GlobalDataContextType | undefined>(
  undefined,
);

export const useGlobalData = () => {
  const context = useContext(GlobalDataContext);
  if (context === undefined) {
    throw new Error("useGlobalData must be used within a GlobalDataProvider");
  }
  return context;
};

// Session storage keys
const CACHE_KEY_PREFIX = "globalDataCache:v4";
const ROUTE_STATES_KEY_PREFIX = "routeStates";

export const GlobalDataProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const {
    tenant,
    loading: tenantLoading,
    requiresTenantSelection,
  } = useTenant();

  // Core data state
  const [cachedData, setCachedData] = useState<CachedData | null>(null);
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    campaigns: false,
    tasks: false,
    initial: true,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Route state persistence
  const [routeStates, setRouteStates] = useState<Record<string, any>>({});
  const [storageReady, setStorageReady] = useState(false);

  // TODO: Move developer check to a database role/flag instead of hardcoded email.
  const isDeveloper = user?.email === "jon@getclear.ca";

  const storageScope = useMemo(() => {
    if (!user || tenantLoading || requiresTenantSelection) {
      return null;
    }

    return {
      cacheKey: buildScopedStorageKey(CACHE_KEY_PREFIX, {
        userId: user.id,
        tenantId: tenant?.id,
      }),
      routeStatesKey: buildScopedStorageKey(ROUTE_STATES_KEY_PREFIX, {
        userId: user.id,
        tenantId: tenant?.id,
      }),
    };
  }, [requiresTenantSelection, tenant?.id, tenantLoading, user]);

  // Load scoped cached data and route states from session storage.
  useEffect(() => {
    if (!user || tenantLoading || !storageScope) {
      setCachedData(null);
      setRouteStates({});
      setStorageReady(false);
      return;
    }

    setStorageReady(false);

    try {
      const cached = sessionStorage.getItem(storageScope.cacheKey);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        const isStale = Date.now() - parsedCache.timestamp > CACHE_DURATION;
        setCachedData({
          ...parsedCache,
          isStale,
          scopeKey: storageScope.cacheKey,
        });
      } else {
        setCachedData(null);
      }

      const routeStatesData = sessionStorage.getItem(
        storageScope.routeStatesKey,
      );
      if (routeStatesData) {
        setRouteStates(JSON.parse(routeStatesData));
      } else {
        setRouteStates({});
      }
    } catch (error) {
      console.error("Error loading cached data:", error);
      setCachedData(null);
      setRouteStates({});
    } finally {
      setStorageReady(true);
    }
  }, [storageScope, tenantLoading, user]);

  // Save route states to session storage when they change
  useEffect(() => {
    if (!storageScope || !storageReady) {
      return;
    }

    try {
      sessionStorage.setItem(
        storageScope.routeStatesKey,
        JSON.stringify(routeStates),
      );
    } catch (error) {
      console.error("Error saving route states:", error);
    }
  }, [routeStates, storageReady, storageScope]);

  const fetchData = useCallback(
    async (force = false) => {
      if (!user || tenantLoading || requiresTenantSelection || !storageScope) {
        setLoadingStates((prev) => ({ ...prev, initial: false }));
        return;
      }

      // Check if we can use cached data (if not forced and cache is fresh)
      if (
        !force &&
        cachedData &&
        cachedData.scopeKey === storageScope.cacheKey &&
        !cachedData.isStale
      ) {
        setLoadingStates((prev) => ({ ...prev, initial: false }));
        return;
      }

      try {
        setError(null);

        // Set appropriate loading states
        if (!cachedData) {
          setLoadingStates((prev) => ({ ...prev, initial: true }));
        } else {
          setIsRefreshing(true);
        }

        const filterConfig: FilterConfig = {
          userId: user.id,
          tenantId: tenant?.id,
          isDeveloper,
        };

        // Fetch campaigns and tasks in parallel
        const [campaignResult, taskResult] = await Promise.all([
          (async () => {
            setLoadingStates((prev) => ({ ...prev, campaigns: true }));
            const campaignQuery = createCampaignFilter(supabase, filterConfig);
            const { data: campaignsData, error: campaignError } =
              await campaignQuery.order("created_at", { ascending: false });

            if (campaignError) {
              throw new Error(
                `Failed to fetch campaigns: ${campaignError.message}`,
              );
            }

            const securedCampaigns = securityFilterCampaigns(
              campaignsData || [],
              filterConfig,
            );
            const deduplicatedCampaigns = deduplicateById(securedCampaigns);
            const customCampaigns = getCustomCampaigns(
              deduplicatedCampaigns,
              filterConfig,
            );

            setLoadingStates((prev) => ({ ...prev, campaigns: false }));
            return {
              campaigns: deduplicatedCampaigns,
              userCreatedCampaigns: customCampaigns,
            };
          })(),

          (async () => {
            setLoadingStates((prev) => ({ ...prev, tasks: true }));
            const taskQuery = createContentTasksFilter(supabase, filterConfig);
            const { data: tasksData, error: taskError } = await taskQuery;

            if (taskError) {
              throw new Error(`Failed to fetch tasks: ${taskError.message}`);
            }

            const securedTasks = securityFilterTasks(
              tasksData || [],
              filterConfig,
            );
            const deduplicatedTasks = deduplicateById(securedTasks);

            setLoadingStates((prev) => ({ ...prev, tasks: false }));
            return {
              tasks: deduplicatedTasks,
              approvedTasks: getApprovedTasks(deduplicatedTasks, filterConfig),
            };
          })(),
        ]);

        // Combine results and split tasks by campaign source
        const systemTasksList = getSystemCampaignTasks(
          taskResult.tasks,
          campaignResult.campaigns,
          filterConfig,
        );
        const customTasksList = getCustomCampaignTasks(
          taskResult.tasks,
          campaignResult.campaigns,
          filterConfig,
        );

        const newCachedData: CachedData = {
          campaigns: campaignResult.campaigns,
          userCreatedCampaigns: campaignResult.userCreatedCampaigns,
          tasks: taskResult.tasks,
          systemTasks: systemTasksList,
          customTasks: customTasksList,
          approvedTasks: taskResult.approvedTasks,
          timestamp: Date.now(),
          isStale: false,
          scopeKey: storageScope.cacheKey,
        };

        setCachedData(newCachedData);

        // Save to session storage
        try {
          sessionStorage.setItem(
            storageScope.cacheKey,
            JSON.stringify(newCachedData),
          );
        } catch (error) {
          console.error("Error saving to session storage:", error);
        }
      } catch (err: any) {
        console.error("GlobalDataProvider: Error fetching data:", err);
        setError(err.message || "Failed to load content data");
      } finally {
        setLoadingStates((prev) => ({ ...prev, initial: false }));
        setIsRefreshing(false);
      }
    },
    [
      cachedData,
      isDeveloper,
      requiresTenantSelection,
      storageScope,
      tenant,
      tenantLoading,
      user,
    ],
  );

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user || tenantLoading || requiresTenantSelection) return;

    const channelId = `${user.id}-${tenant?.id ?? "personal"}-${Date.now()}`;
    const scopedFilter = buildRealtimeScopeFilter({
      tenantId: tenant?.id,
      userId: user.id,
    });

    const markStaleAndRefresh = () => {
      setCachedData((prev) => (prev ? { ...prev, isStale: true } : null));
      void fetchData(true);
    };

    const campaignSubscription = supabase
      .channel(`global-campaigns-channel-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaigns",
          ...(scopedFilter ? { filter: scopedFilter } : {}),
        },
        markStaleAndRefresh,
      )
      .subscribe();

    const taskSubscription = supabase
      .channel(`global-content-tasks-channel-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "content_tasks",
          ...(scopedFilter ? { filter: scopedFilter } : {}),
        },
        markStaleAndRefresh,
      )
      .subscribe();

    // Subscribe to master template changes to invalidate cache
    const templateSubscription = supabase
      .channel(`global-templates-channel-${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "master_campaign_templates" },
        markStaleAndRefresh,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(campaignSubscription);
      supabase.removeChannel(taskSubscription);
      supabase.removeChannel(templateSubscription);
    };
  }, [fetchData, requiresTenantSelection, tenant?.id, tenantLoading, user]);

  // Route state management
  const saveRouteState = useCallback((route: string, state: any) => {
    setRouteStates((prev) => ({
      ...prev,
      [route]: { ...state, timestamp: Date.now() },
    }));
  }, []);

  const getRouteState = useCallback(
    (route: string) => {
      return routeStates[route] || null;
    },
    [routeStates],
  );

  const clearRouteState = useCallback((route: string) => {
    setRouteStates((prev) => {
      const newStates = { ...prev };
      delete newStates[route];
      return newStates;
    });
  }, []);

  const refreshData = useCallback(
    async (force = false) => {
      await fetchData(force);
    },
    [fetchData],
  );

  const invalidateCache = useCallback(() => {
    setCachedData(null);
    try {
      if (storageScope) {
        sessionStorage.removeItem(storageScope.cacheKey);
      }
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  }, [storageScope]);

  // Memoized computed values
  const value = useMemo(
    (): GlobalDataContextType => ({
      // Data
      campaigns: cachedData?.campaigns || [],
      tasks: cachedData?.tasks || [],
      systemTasks: cachedData?.systemTasks || [],
      customTasks: cachedData?.customTasks || [],
      userCreatedCampaigns: cachedData?.userCreatedCampaigns || [],
      approvedTasks: cachedData?.approvedTasks || [],

      // Loading states
      loading: loadingStates.initial,
      loadingStates,
      isRefreshing,

      // Error handling
      error,

      // Cache info
      isCached: !!cachedData && !cachedData.isStale,
      lastUpdated: cachedData?.timestamp || null,

      // Actions
      refreshData,
      invalidateCache,

      // Route state persistence
      routeStates,
      saveRouteState,
      getRouteState,
      clearRouteState,
    }),
    [
      cachedData,
      loadingStates,
      isRefreshing,
      error,
      refreshData,
      invalidateCache,
      routeStates,
      saveRouteState,
      getRouteState,
      clearRouteState,
    ],
  );

  return (
    <GlobalDataContext.Provider value={value}>
      {children}
    </GlobalDataContext.Provider>
  );
};
