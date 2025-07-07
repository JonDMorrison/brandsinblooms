import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { 
  createCampaignFilter, 
  createContentTasksFilter, 
  securityFilterCampaigns, 
  securityFilterTasks,
  getCustomCampaigns,
  getApprovedTasks,
  deduplicateById,
  type FilterConfig 
} from "@/utils/dataFilters";
import { Campaign } from "@/types/content";

interface ContentContextType {
  campaigns: Campaign[];
  tasks: any[];
  userCreatedCampaigns: Campaign[];
  approvedTasks: any[];
  loading: boolean;
  error: string | null;
  refreshData: () => void;
}

const ContentContext = createContext<ContentContextType | undefined>(undefined);

export const useContent = () => {
  const context = useContext(ContentContext);
  if (context === undefined) {
    throw new Error('useContent must be used within a ContentProvider');
  }
  return context;
};

export const ContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [userCreatedCampaigns, setUserCreatedCampaigns] = useState<Campaign[]>([]);
  const [approvedTasks, setApprovedTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isDeveloper = user?.email === 'jon@getclear.ca';

  const fetchData = useCallback(async () => {
    if (!user || tenantLoading) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);

      const filterConfig: FilterConfig = {
        userId: user.id,
        tenantId: tenant?.id,
        isDeveloper
      };

      // Fetch campaigns with unified filter
      const campaignQuery = createCampaignFilter(supabase, filterConfig);
      const { data: campaignsData, error: campaignError } = await campaignQuery
        .order('created_at', { ascending: false });

      if (campaignError) {
        throw new Error(`Failed to fetch campaigns: ${campaignError.message}`);
      }

      // Apply security filtering and deduplication
      const securedCampaigns = securityFilterCampaigns(campaignsData || [], filterConfig);
      const deduplicatedCampaigns = deduplicateById(securedCampaigns);
      setCampaigns(deduplicatedCampaigns);

      // Get custom campaigns
      const customCampaigns = getCustomCampaigns(deduplicatedCampaigns, filterConfig);
      setUserCreatedCampaigns(customCampaigns);

      // Fetch tasks with unified filter
      const taskQuery = createContentTasksFilter(supabase, filterConfig);
      const { data: tasksData, error: taskError } = await taskQuery;

      if (taskError) {
        throw new Error(`Failed to fetch tasks: ${taskError.message}`);
      }

      // Apply security filtering and deduplication
      const securedTasks = securityFilterTasks(tasksData || [], filterConfig);
      const deduplicatedTasks = deduplicateById(securedTasks);
      setTasks(deduplicatedTasks);

      // Get approved tasks
      const approvedTasksList = getApprovedTasks(deduplicatedTasks, filterConfig);
      setApprovedTasks(approvedTasksList);

    } catch (err: any) {
      console.error('ContentProvider: Error fetching data:', err);
      setError(err.message || 'Failed to load content data');
    } finally {
      setLoading(false);
    }
  }, [user, tenant, tenantLoading, isDeveloper]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set up real-time subscriptions for data updates
  useEffect(() => {
    if (!user) return;

    const campaignSubscription = supabase
      .channel('campaigns-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'campaigns' },
        () => fetchData()
      )
      .subscribe();

    const taskSubscription = supabase
      .channel('content-tasks-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'content_tasks' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(campaignSubscription);
      supabase.removeChannel(taskSubscription);
    };
  }, [user, fetchData]);

  const refreshData = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const value: ContentContextType = {
    campaigns,
    tasks,
    userCreatedCampaigns,
    approvedTasks,
    loading,
    error,
    refreshData
  };

  return (
    <ContentContext.Provider value={value}>
      {children}
    </ContentContext.Provider>
  );
};