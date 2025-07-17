import { useCallback } from 'react';
import { useGlobalData } from '@/contexts/GlobalDataContext';

/**
 * Hook that provides content data from the global context
 * Compatible with the existing ContentContext interface
 */
export const useGlobalContentData = () => {
  const {
    campaigns,
    tasks,
    systemTasks,
    customTasks,
    userCreatedCampaigns,
    approvedTasks,
    loading,
    error,
    refreshData,
    isCached,
    isRefreshing
  } = useGlobalData();

  const refreshDataCallback = useCallback(() => {
    refreshData(true);
  }, [refreshData]);

  return {
    campaigns,
    tasks,
    systemTasks,
    customTasks,
    userCreatedCampaigns,
    approvedTasks,
    loading,
    error,
    refreshData: refreshDataCallback,
    isCached,
    isRefreshing
  };
};