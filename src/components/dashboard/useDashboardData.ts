
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const CACHE_KEYS = {
  campaigns: 'dashboard_campaigns_cache',
  tasks: 'dashboard_tasks_cache'
};

const getCachedData = (key: string) => {
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      // Use cache if less than 1 hour old
      if (Date.now() - timestamp < 3600000) {
        return data;
      }
    }
  } catch (error) {
    console.error('Error reading cache:', error);
  }
  return null;
};

const setCachedData = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Error setting cache:', error);
  }
};

const isNetworkError = (error: any) => {
  return !navigator.onLine || 
         error?.message?.includes('Failed to fetch') ||
         error?.message?.includes('Network Error') ||
         error?.message?.includes('ERR_INTERNET_DISCONNECTED');
};

export const useDashboardData = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const fetchData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      console.log('Dashboard: Fetching campaigns and tasks for user:', user.id);

      // Check if we're offline
      if (!navigator.onLine) {
        setIsOffline(true);
        
        // Try to load from cache
        const cachedCampaigns = getCachedData(CACHE_KEYS.campaigns);
        const cachedTasks = getCachedData(CACHE_KEYS.tasks);
        
        if (cachedCampaigns || cachedTasks) {
          setCampaigns(cachedCampaigns || []);
          setTasks(cachedTasks || []);
          toast.info('Loaded cached data - you are offline');
          setLoading(false);
          return;
        } else {
          throw new Error('No internet connection and no cached data available');
        }
      }

      setIsOffline(false);

      // Fetch campaigns with error handling
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .order('start_date', { ascending: true });

      if (campaignsError && !isNetworkError(campaignsError)) {
        console.error('Dashboard: Error fetching campaigns:', campaignsError);
        throw new Error(`Failed to load campaigns: ${campaignsError.message}`);
      }

      const campaigns = campaignsData || getCachedData(CACHE_KEYS.campaigns) || [];
      console.log('Dashboard: Loaded campaigns:', campaigns.length);
      setCampaigns(campaigns);
      if (campaignsData) setCachedData(CACHE_KEYS.campaigns, campaigns);

      // Fetch content tasks with campaign info
      const { data: tasksData, error: tasksError } = await supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns (
            title,
            week_number,
            start_date
          )
        `)
        .order('scheduled_date', { ascending: true });

      if (tasksError && !isNetworkError(tasksError)) {
        console.error('Dashboard: Error fetching tasks:', tasksError);
        throw new Error(`Failed to load content tasks: ${tasksError.message}`);
      }

      const tasks = tasksData || getCachedData(CACHE_KEYS.tasks) || [];
      console.log('Dashboard: Loaded tasks:', tasks.length);
      setTasks(tasks);
      if (tasksData) setCachedData(CACHE_KEYS.tasks, tasks);

    } catch (error: any) {
      console.error('Dashboard: Error in fetchData:', error);
      setError(error.message || 'Failed to load dashboard data');
      
      // Try to load cached data as fallback
      const cachedCampaigns = getCachedData(CACHE_KEYS.campaigns);
      const cachedTasks = getCachedData(CACHE_KEYS.tasks);
      
      if (cachedCampaigns || cachedTasks) {
        setCampaigns(cachedCampaigns || []);
        setTasks(cachedTasks || []);
        toast.warning('Using cached data due to connection issues');
      } else {
        toast.error(error.message || 'Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      fetchData();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user]);

  const handleTaskUpdate = async () => {
    console.log('Dashboard: Task update triggered, refreshing data');
    if (navigator.onLine) {
      await fetchData();
    } else {
      toast.info('Task update will sync when you\'re back online');
    }
  };

  const handleCampaignCreated = async () => {
    console.log('Dashboard: Campaign created, refreshing data');
    if (navigator.onLine) {
      await fetchData();
    } else {
      toast.info('Campaign will sync when you\'re back online');
    }
  };

  return {
    campaigns,
    tasks,
    loading,
    error,
    isOffline,
    handleTaskUpdate,
    handleCampaignCreated,
    refetch: fetchData
  };
};
