
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

const getCurrentWeekNumber = () => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
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

      if (campaignsError) {
        console.error('Dashboard: Error fetching campaigns:', campaignsError);
        
        if (isNetworkError(campaignsError)) {
          const cachedCampaigns = getCachedData(CACHE_KEYS.campaigns);
          if (cachedCampaigns) {
            setCampaigns(cachedCampaigns);
            toast.warning('Using cached campaigns due to connection issues');
          }
        } else {
          throw new Error(`Failed to load campaigns: ${campaignsError.message}`);
        }
      } else {
        const campaigns = campaignsData || [];
        console.log('Dashboard: Loaded campaigns:', campaigns.length);
        setCampaigns(campaigns);
        setCachedData(CACHE_KEYS.campaigns, campaigns);
      }

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

      if (tasksError) {
        console.error('Dashboard: Error fetching tasks:', tasksError);
        
        if (isNetworkError(tasksError)) {
          const cachedTasks = getCachedData(CACHE_KEYS.tasks);
          if (cachedTasks) {
            setTasks(cachedTasks);
            toast.warning('Using cached tasks due to connection issues');
          }
        } else {
          throw new Error(`Failed to load content tasks: ${tasksError.message}`);
        }
      } else {
        const tasks = tasksData || [];
        console.log('Dashboard: Loaded tasks:', tasks.length);
        setTasks(tasks);
        setCachedData(CACHE_KEYS.tasks, tasks);
      }

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

  // Process the data to match what DashboardContent expects
  const currentWeekNumber = getCurrentWeekNumber();
  
  // Find active campaign for current week
  const activeCampaign = campaigns.find(campaign => 
    campaign.week_number === currentWeekNumber
  );

  // User created campaigns (non-template campaigns)
  const userCreatedCampaigns = campaigns.filter(campaign => 
    campaign.user_id || campaign.created_by || !campaign.is_template
  );

  // Calculate task counts
  const completedTasksCount = tasks.filter(task => task.status === 'completed').length;
  const totalTasksCount = tasks.length;
  const pendingTasksCount = tasks.filter(task => task.status === 'pending' || task.status === 'draft').length;

  return {
    campaigns,
    tasks,
    activeCampaign,
    userCreatedCampaigns,
    currentWeekNumber,
    completedTasksCount,
    totalTasksCount,
    pendingTasksCount,
    loading,
    error,
    isOffline,
    handleTaskUpdate,
    handleCampaignCreated,
    refetch: fetchData
  };
};
