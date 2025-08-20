import { useCallback, useMemo } from 'react';
import { useGlobalData } from '@/contexts/GlobalDataContext';
import { Campaign } from '@/types/content';

interface Task {
  id: string;
  campaign_id?: string;
  scheduled_date?: string;
  status: string;
  ai_output?: string;
  hashtags?: string;
  image_url?: string;
  campaigns?: {
    title: string;
    week_number: number;
    start_date: string;
    user_id: string;
    tenant_id: string;
  };
}

export const useGlobalCalendarData = () => {
  const {
    campaigns,
    tasks,
    loading,
    error,
    refreshData,
    invalidateCache,
    isCached,
    isRefreshing,
    lastUpdated
  } = useGlobalData();

  // Calculate stats using useMemo for performance
  const stats = useMemo(() => {
    const upcomingCampaigns = campaigns.filter(campaign => 
      new Date(campaign.start_date) > new Date()
    ).length;

    const completedTasks = tasks.filter(task => 
      task.status === 'completed'
    ).length;

    const totalTasks = tasks.length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      upcomingCampaigns,
      completedTasks,
      totalTasks,
      completionRate
    };
  }, [campaigns, tasks]);

  const refetch = useCallback(() => {
    refreshData(true);
  }, [refreshData]);

  const hardRefresh = useCallback(() => {
    invalidateCache();
    refreshData(true);
  }, [invalidateCache, refreshData]);

  return {
    campaigns: campaigns as Campaign[],
    tasks: tasks as Task[],
    loading,
    error,
    stats,
    refetch,
    hardRefresh,
    isCached,
    isRefreshing,
    lastUpdated
  };
};