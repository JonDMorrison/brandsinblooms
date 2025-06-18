
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CACHE_KEYS } from "@/constants/cache";
import { getCachedData, setCachedData } from "@/utils/cache";
import { handleError, logError, isNetworkError } from "@/utils/errorHandling";
import { Campaign, ContentTask } from "@/types/content";

const getCurrentWeekNumber = () => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
};

export const useDashboardData = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tasks, setTasks] = useState<ContentTask[]>([]);
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

      if (!navigator.onLine) {
        setIsOffline(true);
        
        const cachedCampaigns = getCachedData<Campaign[]>(CACHE_KEYS.campaigns);
        const cachedTasks = getCachedData<ContentTask[]>(CACHE_KEYS.tasks);
        
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

      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .order('start_date', { ascending: true });

      if (campaignsError) {
        if (isNetworkError(campaignsError)) {
          const cachedCampaigns = getCachedData<Campaign[]>(CACHE_KEYS.campaigns);
          if (cachedCampaigns) {
            setCampaigns(cachedCampaigns);
            toast.warning('Using cached campaigns due to connection issues');
          }
        } else {
          throw new Error(`Failed to load campaigns: ${campaignsError.message}`);
        }
      } else {
        const campaigns = campaignsData || [];
        setCampaigns(campaigns);
        setCachedData(CACHE_KEYS.campaigns, campaigns);
      }

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
        if (isNetworkError(tasksError)) {
          const cachedTasks = getCachedData<ContentTask[]>(CACHE_KEYS.tasks);
          if (cachedTasks) {
            setTasks(cachedTasks);
            toast.warning('Using cached tasks due to connection issues');
          }
        } else {
          throw new Error(`Failed to load content tasks: ${tasksError.message}`);
        }
      } else {
        // Type assertion to ensure status field matches our ContentTask interface
        const tasks = (tasksData || []).map(task => ({
          ...task,
          status: task.status as ContentTask['status']
        })) as ContentTask[];
        setTasks(tasks);
        setCachedData(CACHE_KEYS.tasks, tasks);
      }

    } catch (error: any) {
      logError(error, 'Dashboard data fetch');
      const appError = handleError(error, 'dashboard data loading');
      setError(appError.message);
      
      const cachedCampaigns = getCachedData<Campaign[]>(CACHE_KEYS.campaigns);
      const cachedTasks = getCachedData<ContentTask[]>(CACHE_KEYS.tasks);
      
      if (cachedCampaigns || cachedTasks) {
        setCampaigns(cachedCampaigns || []);
        setTasks(cachedTasks || []);
        toast.warning('Using cached data due to connection issues');
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
    if (navigator.onLine) {
      await fetchData();
    } else {
      toast.info('Task update will sync when you\'re back online');
    }
  };

  const handleCampaignCreated = async () => {
    if (navigator.onLine) {
      await fetchData();
    } else {
      toast.info('Campaign will sync when you\'re back online');
    }
  };

  const currentWeekNumber = getCurrentWeekNumber();
  
  const activeCampaign = campaigns.find(campaign => 
    campaign.week_number === currentWeekNumber
  );

  const userCreatedCampaigns = campaigns.filter(campaign => 
    campaign.source === 'quick_action'
  );

  // Fix status calculations to use correct valid status values
  const approvedTasksCount = tasks.filter(task => task.status === 'approved').length;
  const totalTasksCount = tasks.length;
  const reviewTasksCount = tasks.filter(task => task.status === 'review' || task.status === 'planned').length;

  return {
    campaigns,
    tasks,
    activeCampaign,
    userCreatedCampaigns,
    currentWeekNumber,
    completedTasksCount: approvedTasksCount, // Using approved as "completed"
    totalTasksCount,
    pendingTasksCount: reviewTasksCount, // Using review/planned as "pending"
    loading,
    error,
    isOffline,
    handleTaskUpdate,
    handleCampaignCreated,
    refetch: fetchData
  };
};
