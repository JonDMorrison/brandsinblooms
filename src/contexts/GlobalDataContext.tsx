import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
  type FilterConfig 
} from "@/utils/dataFilters";
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

const GlobalDataContext = createContext<GlobalDataContextType | undefined>(undefined);

export const useGlobalData = () => {
  const context = useContext(GlobalDataContext);
  if (context === undefined) {
    throw new Error('useGlobalData must be used within a GlobalDataProvider');
  }
  return context;
};

// Session storage keys
const CACHE_KEY = 'globalDataCache';
const ROUTE_STATES_KEY = 'routeStates';

export const GlobalDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  
  // Core data state
  const [cachedData, setCachedData] = useState<CachedData | null>(null);
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    campaigns: false,
    tasks: false,
    initial: true
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Route state persistence
  const [routeStates, setRouteStates] = useState<Record<string, any>>({});

  const isDeveloper = user?.email === 'jon@getclear.ca';

  // Load cached data and route states from session storage on mount
  useEffect(() => {
    try {
      // Load cached data
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        const isStale = Date.now() - parsedCache.timestamp > CACHE_DURATION;
        setCachedData({ ...parsedCache, isStale });
      }

      // Load route states
      const routeStatesData = sessionStorage.getItem(ROUTE_STATES_KEY);
      if (routeStatesData) {
        setRouteStates(JSON.parse(routeStatesData));
      }
    } catch (error) {
      console.error('Error loading cached data:', error);
    }
  }, []);

  // Save route states to session storage when they change
  useEffect(() => {
    try {
      sessionStorage.setItem(ROUTE_STATES_KEY, JSON.stringify(routeStates));
    } catch (error) {
      console.error('Error saving route states:', error);
    }
  }, [routeStates]);

  const fetchData = useCallback(async (force = false) => {
    if (!user || tenantLoading) {
      setLoadingStates(prev => ({ ...prev, initial: false }));
      return;
    }

    // Check if we can use cached data (if not forced and cache is fresh)
    if (!force && cachedData && !cachedData.isStale) {
      setLoadingStates(prev => ({ ...prev, initial: false }));
      return;
    }

    try {
      setError(null);
      
      // Set appropriate loading states
      if (!cachedData) {
        setLoadingStates(prev => ({ ...prev, initial: true }));
      } else {
        setIsRefreshing(true);
      }

      const filterConfig: FilterConfig = {
        userId: user.id,
        tenantId: tenant?.id,
        isDeveloper
      };

      // Fetch campaigns and tasks in parallel
      const [campaignResult, taskResult] = await Promise.all([
        (async () => {
          setLoadingStates(prev => ({ ...prev, campaigns: true }));
          const campaignQuery = createCampaignFilter(supabase, filterConfig);
          const { data: campaignsData, error: campaignError } = await campaignQuery
            .order('created_at', { ascending: false });

          if (campaignError) {
            throw new Error(`Failed to fetch campaigns: ${campaignError.message}`);
          }

          const securedCampaigns = securityFilterCampaigns(campaignsData || [], filterConfig);
          const deduplicatedCampaigns = deduplicateById(securedCampaigns);
          const customCampaigns = getCustomCampaigns(deduplicatedCampaigns, filterConfig);
          
          setLoadingStates(prev => ({ ...prev, campaigns: false }));
          return { campaigns: deduplicatedCampaigns, userCreatedCampaigns: customCampaigns };
        })(),
        
        (async () => {
          setLoadingStates(prev => ({ ...prev, tasks: true }));
          const taskQuery = createContentTasksFilter(supabase, filterConfig);
          const { data: tasksData, error: taskError } = await taskQuery;

          if (taskError) {
            throw new Error(`Failed to fetch tasks: ${taskError.message}`);
          }

          const securedTasks = securityFilterTasks(tasksData || [], filterConfig);
          const deduplicatedTasks = deduplicateById(securedTasks);
          
          setLoadingStates(prev => ({ ...prev, tasks: false }));
          return { 
            tasks: deduplicatedTasks,
            approvedTasks: getApprovedTasks(deduplicatedTasks, filterConfig)
          };
        })()
      ]);

      // Combine results and split tasks by campaign source
      const systemTasksList = getSystemCampaignTasks(taskResult.tasks, campaignResult.campaigns, filterConfig);
      const customTasksList = getCustomCampaignTasks(taskResult.tasks, campaignResult.campaigns, filterConfig);
      
      const newCachedData: CachedData = {
        campaigns: campaignResult.campaigns,
        userCreatedCampaigns: campaignResult.userCreatedCampaigns,
        tasks: taskResult.tasks,
        systemTasks: systemTasksList,
        customTasks: customTasksList,
        approvedTasks: taskResult.approvedTasks,
        timestamp: Date.now(),
        isStale: false
      };

      setCachedData(newCachedData);

      // Save to session storage
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(newCachedData));
      } catch (error) {
        console.error('Error saving to session storage:', error);
      }

    } catch (err: any) {
      console.error('GlobalDataProvider: Error fetching data:', err);
      setError(err.message || 'Failed to load content data');
    } finally {
      setLoadingStates(prev => ({ ...prev, initial: false }));
      setIsRefreshing(false);
    }
  }, [user, tenant, tenantLoading, isDeveloper, cachedData?.isStale]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return;

    const campaignSubscription = supabase
      .channel('global-campaigns-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'campaigns' },
        () => {
          // Mark cache as stale and trigger background refresh
          setCachedData(prev => prev ? { ...prev, isStale: true } : null);
          fetchData(false);
        }
      )
      .subscribe();

    const taskSubscription = supabase
      .channel('global-content-tasks-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'content_tasks' },
        () => {
          // Mark cache as stale and trigger background refresh
          setCachedData(prev => prev ? { ...prev, isStale: true } : null);
          fetchData(false);
        }
      )
      .subscribe();

    // Subscribe to master template changes to invalidate cache
    const templateSubscription = supabase
      .channel('global-templates-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'master_campaign_templates' },
        () => {
          // Mark cache as stale and trigger background refresh
          setCachedData(prev => prev ? { ...prev, isStale: true } : null);
          fetchData(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(campaignSubscription);
      supabase.removeChannel(taskSubscription);
      supabase.removeChannel(templateSubscription);
    };
  }, [user, fetchData]);

  // Route state management
  const saveRouteState = useCallback((route: string, state: any) => {
    setRouteStates(prev => ({
      ...prev,
      [route]: { ...state, timestamp: Date.now() }
    }));
  }, []);

  const getRouteState = useCallback((route: string) => {
    return routeStates[route] || null;
  }, [routeStates]);

  const clearRouteState = useCallback((route: string) => {
    setRouteStates(prev => {
      const newStates = { ...prev };
      delete newStates[route];
      return newStates;
    });
  }, []);

  const refreshData = useCallback(async (force = false) => {
    await fetchData(force);
  }, [fetchData]);

  const invalidateCache = useCallback(() => {
    setCachedData(null);
    try {
      sessionStorage.removeItem(CACHE_KEY);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }, []);

  // Memoized computed values
  const value = useMemo((): GlobalDataContextType => ({
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
    clearRouteState
  }), [
    cachedData, loadingStates, isRefreshing, error, refreshData, invalidateCache,
    routeStates, saveRouteState, getRouteState, clearRouteState
  ]);

  return (
    <GlobalDataContext.Provider value={value}>
      {children}
    </GlobalDataContext.Provider>
  );
};